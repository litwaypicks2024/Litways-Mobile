import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  AppState,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressStepper } from '@/components/ui/ProgressStepper';
import { color, font, radius, shadow } from '@/theme/tokens';
import { LIBERIAN_COUNTIES } from '@/constants/counties';
import { momoAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { normalizeLiberianPhone, isValidLiberianMobile } from '@/lib/phone';
import { pendingPayment } from '@/lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CheckoutForm } from '@/types';

type PaymentStatus = 'idle' | 'processing' | 'polling' | 'success' | 'failed';
type Step = 1 | 2;

const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const reconcile = useCartStore((s) => s.reconcile);
  const total = useCartStore((s) => s.subtotal());
  const mergeNotice = useCartStore((s) => s.mergeNotice);
  const dismissMergeNotice = useCartStore((s) => s.dismissMergeNotice);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<CheckoutForm>({
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    email: user?.email ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    county: '',
  });
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Return-key focus chain through the delivery form, mirroring login.tsx.
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'polling';

  // Header back button (above) is already disabled while processing, but that
  // only covers a tap on our own IconButton. Android hardware back and iOS
  // swipe-back bypass it entirely and can still unmount this screen mid
  // payment, tearing down the realtime/poll tracking before we know whether
  // the MoMo charge succeeded. Intercept navigation-away at the router level
  // while processing/polling and require an explicit confirmation.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isProcessing) return;
      e.preventDefault();
      Alert.alert(
        'Payment in progress',
        'Leaving now can abandon it. Are you sure you want to leave?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave anyway',
            style: 'destructive',
            onPress: () => {
              // Wave 5: pending-payment persistence (lib/storage.ts
              // pendingPayment, written right after initiatePayment()
              // succeeds below) means this reference isn't lost just because
              // this screen unmounts here — app/_layout.tsx checks for an
              // unresolved pending payment on the next cold start and offers
              // to resume checking its status.
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, isProcessing]);

  // If the shopper signs in during checkout, backfill any details they haven't
  // typed yet — without clobbering what they've already entered as a guest.
  useEffect(() => {
    if (!user && !profile) return;
    setForm((s) => ({
      ...s,
      firstName: s.firstName || profile?.first_name || '',
      lastName: s.lastName || profile?.last_name || '',
      email: s.email || user?.email || '',
      phone: s.phone || profile?.phone || '',
      address: s.address || profile?.address || '',
      city: s.city || profile?.city || '',
    }));
  }, [user, profile]);

  useEffect(() => {
    if (!referenceId) return;

    let resolved = false;

    // Guests have no order history to point at, so give them their reference
    // id (plus the confirmation email) instead — and both audiences get a
    // direct "Check status" action to confirmation.tsx rather than having to
    // hunt for it, since that screen already knows how to poll/refresh a
    // still-pending order (see its "Check again" affordance).
    function showPaymentAlert(title: string, base: string) {
      Alert.alert(
        title,
        user
          ? `${base} Check your order history for the latest status.`
          : `${base} Your reference is ${referenceId} — keep it, and check the email we sent you.`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Check status',
            onPress: () => router.push({ pathname: '/confirmation', params: { referenceId } }),
          },
        ]
      );
    }

    // Single settle path shared by the realtime subscription, the polling
    // fallback, and the app-foreground re-check — runs at most once.
    function finalize(rawStatus: string) {
      if (resolved) return;
      const status = (rawStatus ?? '').toUpperCase();
      if (status === 'SUCCESSFUL' || status === 'COMPLETED') {
        resolved = true;
        cleanup();
        clearCart();
        void pendingPayment.clear();
        setPaymentStatus('success');
        router.replace({ pathname: '/confirmation', params: { referenceId } });
      } else if (status === 'FAILED' || status === 'DISPUTED') {
        resolved = true;
        cleanup();
        void pendingPayment.clear();
        setPaymentStatus('failed');
        showPaymentAlert('Payment failed', 'Your payment was declined.');
      }
    }

    const channel = supabase
      .channel(`checkout-order-${referenceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `external_id=eq.${referenceId}`,
        },
        (payload) => finalize((payload.new as any).payment_status ?? '')
      )
      .on(
        // The backend's payment webhook could resolve fast enough to INSERT
        // the order row already in a terminal payment_status rather than
        // INSERT-then-later-UPDATE — listen for both so realtime confirmation
        // doesn't silently depend on the 6s poll fallback for that ordering.
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `external_id=eq.${referenceId}`,
        },
        (payload) => finalize((payload.new as any).payment_status ?? '')
      )
      .subscribe();

    // Fallback poll — covers a dropped realtime socket or a wrong realtime
    // filter (see B-02): the backend resolves the reference itself.
    const pollId = setInterval(() => {
      momoAPI.checkStatus(referenceId).then((r) => finalize(r.status)).catch(() => {});
    }, 6000);

    // Re-check immediately when the app returns to the foreground.
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        momoAPI.checkStatus(referenceId).then((r) => finalize(r.status)).catch(() => {});
      }
    });

    function cleanup() {
      channel.unsubscribe();
      clearInterval(pollId);
      appStateSub.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (resolved) return;
      cleanup();
      setPaymentStatus('failed');
      showPaymentAlert('Payment timeout', 'Payment confirmation timed out.');
    }, PAYMENT_TIMEOUT_MS);

    return () => cleanup();
  }, [referenceId]);

  function validateDelivery(): boolean {
    if (!form.firstName || !form.email || !form.phone || !form.address || !form.county) {
      Alert.alert('Missing fields', 'Please fill in all required delivery information.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return false;
    }
    if (!isValidLiberianMobile(form.phone)) {
      Alert.alert('Invalid phone number', 'Enter a valid Liberian mobile number, e.g. 0888 640 502.');
      return false;
    }
    return true;
  }

  async function handlePlaceOrder() {
    if (items.length === 0) {
      Alert.alert('Empty cart', 'Your cart is empty.');
      return;
    }
    setPaymentStatus('processing');
    try {
      // Re-validate price & stock against the live catalog before charging —
      // the cart persists locally and may hold stale prices or sold-out items.
      const ids = [...new Set(items.map((i) => i.productId))];
      const { data: fresh, error: freshError } = await supabase
        .from('products_with_categories')
        .select('id, price, sale_price, stock')
        .in('id', ids);
      if (freshError) throw freshError;

      const freshMap = new Map((fresh ?? []).map((p) => [p.id, p]));
      const stockIssues: string[] = [];
      const priceChanges: string[] = [];
      const updates: { productId: string; price: number; stock: number }[] = [];

      for (const item of items) {
        const p = freshMap.get(item.productId);
        if (!p) {
          stockIssues.push(`${item.name} is no longer available`);
          updates.push({ productId: item.productId, price: item.price, stock: 0 });
          continue;
        }
        const currentPrice = p.sale_price ?? p.price ?? 0;
        const currentStock = p.stock ?? 0;
        if (currentStock <= 0) stockIssues.push(`${item.name} is now out of stock`);
        else if (currentStock < item.quantity) stockIssues.push(`${item.name}: only ${currentStock} left`);
        if (currentPrice !== item.price) priceChanges.push(item.name);
        updates.push({ productId: item.productId, price: currentPrice, stock: currentStock });
      }

      if (stockIssues.length > 0 || priceChanges.length > 0) {
        reconcile(updates);
        const parts: string[] = [];
        if (stockIssues.length) parts.push('Availability changed:\n• ' + stockIssues.join('\n• '));
        if (priceChanges.length) parts.push('Prices were updated for:\n• ' + priceChanges.join('\n• '));
        setPaymentStatus('idle');
        setStep(1);
        Alert.alert(
          'Please review your cart',
          parts.join('\n\n') + '\n\nYour cart has been updated to current prices and stock. Please review, then try again.'
        );
        return;
      }

      const payload = {
        customer: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: normalizeLiberianPhone(form.phone),
        },
        delivery: {
          address: form.address,
          city: form.city,
          state: form.county,
        },
        // SECURITY (backend handoff): `price` here is client-held and only
        // reconciled against the catalog for UI purposes above — the server
        // must re-price every line item (and the total) from its own product
        // data rather than trusting this payload. Not fixable client-side.
        items: items.map((i) => ({
          id: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          // Order History (account.tsx) and Order Detail (order/[id].tsx)
          // render thumbnails from imageUrl and gate tap-to-view-product on
          // slug — both must round-trip through the backend's stored order.
          slug: i.slug,
          imageUrl: i.imageUrl,
        })),
      };

      const { referenceId: ref } = await momoAPI.initiatePayment(payload);
      // Persist the moment we have a referenceId — see lib/storage.ts
      // pendingPayment for why (recoverable if the app is killed mid-poll).
      void pendingPayment.save({ referenceId: ref, createdAt: Date.now() });
      setReferenceId(ref);
      setPaymentStatus('polling');
    } catch (err: any) {
      setPaymentStatus('failed');
      Alert.alert('Error', err.message ?? 'Failed to initiate payment. Please try again.');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: color.bg }}>

      {/* ─── Header ─── */}
      <View style={{
        backgroundColor: color.surface,
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: insets.top + 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <IconButton
            icon="arrow-back"
            onPress={() => (step === 1 ? router.back() : setStep(1))}
            disabled={isProcessing}
            accessibilityLabel={step === 1 ? 'Go back' : 'Back to delivery details'}
          />
          <Text style={{ fontSize: 18, fontFamily: font.display, color: color.ink }}>Checkout</Text>
        </View>

        <ProgressStepper
          steps={[
            { label: 'Delivery', icon: 'location-outline' },
            { label: 'Payment', icon: 'card-outline' },
          ]}
          currentStep={step}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* A cart merge (e.g. signing in mid-checkout) can land while the
            shopper is on either step — show it regardless, not just once
            they reach Payment. */}
        {mergeNotice && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: color.accentSoft,
            marginBottom: 12,
            padding: 12,
            borderRadius: radius.md,
          }}>
            <Ionicons name="information-circle" size={18} color={color.accent} />
            <Text style={{ flex: 1, fontSize: 12.5, color: color.accentPressed, fontWeight: '600' }}>
              We combined this cart with items saved to your account.
            </Text>
            <TouchableOpacity onPress={dismissMergeNotice} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={16} color={color.accentPressed} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── STEP 1: Delivery ─── */}
        {step === 1 && (
          <>
            {/* Optional sign-in — never a wall. Guests can order without an account. */}
            {!user ? (
              <>
                <View style={{ backgroundColor: color.surface, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: color.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person-circle-outline" size={24} color={color.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: color.ink }}>Have an account?</Text>
                    <Text style={{ fontSize: 12, color: color.inkMuted, marginTop: 1 }}>Sign in for faster checkout & order tracking</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/login', params: { next: '/checkout' } })} style={{ backgroundColor: color.accent, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ color: color.onAccent, fontSize: 13, fontWeight: '800' }}>Sign in</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: color.inkFaint, marginBottom: 14, marginLeft: 2 }}>
                  No account needed — just fill in your details to order as a guest.
                </Text>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginLeft: 2 }}>
                <Ionicons name="checkmark-circle" size={16} color={color.success} />
                <Text style={{ fontSize: 12.5, color: color.inkMuted, fontWeight: '600' }}>Signed in as {user.email}</Text>
              </View>
            )}

            <SectionCard title="Contact Info" icon="person-outline">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="First Name *"
                    leftIcon="person-outline"
                    value={form.firstName}
                    onChangeText={(v) => setForm((s) => ({ ...s, firstName: v }))}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    ref={lastNameRef}
                    label="Last Name"
                    leftIcon="person-outline"
                    value={form.lastName}
                    onChangeText={(v) => setForm((s) => ({ ...s, lastName: v }))}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
              </View>
              <Input
                ref={emailRef}
                label="Email *"
                leftIcon="mail-outline"
                value={form.email}
                onChangeText={(v) => setForm((s) => ({ ...s, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              <Input
                ref={phoneRef}
                label="Phone *"
                leftIcon="call-outline"
                value={form.phone}
                onChangeText={(v) => setForm((s) => ({ ...s, phone: v }))}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => addressRef.current?.focus()}
              />
            </SectionCard>

            <SectionCard title="Delivery Address" icon="location-outline">
              <Input
                ref={addressRef}
                label="Street Address *"
                leftIcon="home-outline"
                value={form.address}
                onChangeText={(v) => setForm((s) => ({ ...s, address: v }))}
                returnKeyType="next"
                onSubmitEditing={() => cityRef.current?.focus()}
              />
              <Input
                ref={cityRef}
                label="City / Town"
                leftIcon="business-outline"
                value={form.city}
                onChangeText={(v) => setForm((s) => ({ ...s, city: v }))}
                returnKeyType="done"
              />

              {/* County picker */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: color.inkMuted, marginBottom: 6 }}>County *</Text>
                <TouchableOpacity
                  onPress={() => setShowCountyPicker(!showCountyPicker)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: color.surface, borderRadius: radius.full, borderWidth: 1.5,
                    borderColor: showCountyPicker ? color.accent : 'transparent',
                    paddingHorizontal: 16, height: 50, gap: 8,
                  }}
                >
                  <Ionicons name="map-outline" size={18} color={color.inkFaint} />
                  <Text style={{ flex: 1, fontSize: 14, color: form.county ? color.ink : color.inkFaint }}>
                    {form.county || 'Select county...'}
                  </Text>
                  <Ionicons name={showCountyPicker ? 'chevron-up' : 'chevron-down'} size={16} color={color.inkFaint} />
                </TouchableOpacity>
                {showCountyPicker && (
                  <View style={{ backgroundColor: color.surface, borderRadius: 12, borderWidth: 1, borderColor: color.border, marginTop: 4, overflow: 'hidden', ...shadow.card }}>
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                      {LIBERIAN_COUNTIES.map((county) => (
                        <TouchableOpacity
                          key={county}
                          onPress={() => { setForm((s) => ({ ...s, county })); setShowCountyPicker(false); }}
                          style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.border, backgroundColor: form.county === county ? color.accentSoft : color.surface }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: form.county === county ? '700' : '400', color: form.county === county ? color.accent : color.ink }}>
                            {county}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </SectionCard>

            {/* Delivery note */}
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="car-outline" size={20} color="#16a34a" />
              <Text style={{ flex: 1, fontSize: 13, color: '#15803d', fontWeight: '600' }}>
                We deliver across all 15 Liberian counties
              </Text>
            </View>

            {/* Continue button */}
            <Button
              title="Continue to Payment"
              onPress={() => { if (validateDelivery()) setStep(2); }}
              variant="primary"
              fullWidth
              size="lg"
              icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
            />
          </>
        )}

        {/* ─── STEP 2: Payment ─── */}
        {step === 2 && (
          <>
            {/* Delivery summary (read-only) */}
            <TouchableOpacity
              onPress={() => setStep(1)}
              style={{ backgroundColor: color.surface, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.card }}
            >
              <View style={{ width: 36, height: 36, backgroundColor: color.accentSoft, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location-outline" size={18} color={color.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: color.inkFaint, fontWeight: '600', marginBottom: 2 }}>DELIVERING TO</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: color.ink }}>
                  {form.firstName} {form.lastName}
                </Text>
                <Text style={{ fontSize: 12, color: color.inkMuted }} numberOfLines={1}>
                  {form.address}{form.city ? `, ${form.city}` : ''}, {form.county}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: color.accent, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>

            {/* Payment method */}
            <SectionCard title="Payment Method" icon="card-outline">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.accentSoft, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: color.accent }}>
                <View style={{ width: 48, height: 48, backgroundColor: color.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: color.onAccent, fontSize: 11, fontWeight: '900', letterSpacing: -0.5 }}>MoMo</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>MTN Mobile Money</Text>
                  <Text style={{ fontSize: 12, color: color.inkMuted, marginTop: 2 }}>
                    USSD prompt will be sent to {form.phone || 'your phone'}
                  </Text>
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accent }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.onAccent }} />
                </View>
              </View>
            </SectionCard>

            {/* Order items summary */}
            <SectionCard title="Order Summary" icon="bag-outline">
              {items.map((item) => (
                <View key={`${item.productId}::${item.size}::${item.color}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border }}>
                  <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: color.surfaceSunken }}>
                    <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: color.ink }} numberOfLines={1}>{item.name}</Text>
                    {(item.size || item.color) && (
                      <Text style={{ fontSize: 11, color: color.inkFaint }}>
                        {[item.size, item.color].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: color.accent }}>
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                    <Text style={{ fontSize: 11, color: color.inkFaint }}>×{item.quantity}</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink }}>Subtotal</Text>
                <Text style={{ fontSize: 15, fontFamily: font.displayHeavy, color: color.accent }}>{formatCurrency(total)}</Text>
              </View>
            </SectionCard>

            {/* We can't compute delivery fees client-side — the MoMo USSD
                prompt on the shopper's phone is the authoritative total.
                (Backend handoff: a pre-payment quote endpoint would let us
                show the true total here instead.) */}
            <Text style={{ fontSize: 12, color: color.inkFaint, textAlign: 'center', marginTop: -4, marginBottom: 14, lineHeight: 17 }}>
              Your final total, including any delivery fee, is shown in the MoMo prompt on your phone.
            </Text>

            {/* Polling indicator */}
            {paymentStatus === 'polling' && (
              <View style={{ backgroundColor: '#eff6ff', borderRadius: 14, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <ActivityIndicator color="#2563eb" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1d4ed8' }}>Waiting for confirmation</Text>
                  <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>Approve the MoMo prompt on your phone</Text>
                </View>
              </View>
            )}

            {paymentStatus === 'failed' && (
              <View style={{ backgroundColor: '#fff1f2', borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600', flex: 1 }}>Payment failed. Please try again.</Text>
              </View>
            )}

            {/* Pay button */}
            <Button
              title={
                paymentStatus === 'processing' ? 'Initiating...'
                : paymentStatus === 'polling' ? 'Awaiting MoMo...'
                : 'Pay with MoMo'
              }
              onPress={handlePlaceOrder}
              disabled={isProcessing}
              loading={isProcessing}
              variant="primary"
              fullWidth
              size="lg"
              icon={!isProcessing ? <Ionicons name="lock-closed" size={18} color={color.onAccent} /> : undefined}
            />

            <Text style={{ fontSize: 11, color: color.inkFaint, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
              By placing your order you agree to our Terms & Conditions.{'\n'}Payment is processed securely via MTN Mobile Money.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <View style={{ width: 32, height: 32, backgroundColor: color.accentSoft, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as any} size={16} color={color.accent} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}
