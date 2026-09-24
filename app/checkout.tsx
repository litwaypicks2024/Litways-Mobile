import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  KeyboardAvoidingView,
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
import { normalizeLiberianPhone, isValidLiberianMobile, isMtnMobile } from '@/lib/phone';
import { pendingPayment } from '@/lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingOverlay } from '@/components/motion/LoadingOverlay';
import type { CheckoutForm } from '@/types';

type PaymentStatus = 'idle' | 'processing' | 'polling' | 'success' | 'failed';
type Step = 1 | 2;

/** Inline status message — replaces modal alerts for payment/cart/sign-in outcomes. */
type Notice = {
  tone: 'error' | 'warning';
  title: string;
  lines?: string[];
  action?: { label: string; onPress: () => void };
};

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
  // Once the shopper has firstName, email, phone AND address on file, step 1
  // shows a compact "Your details" summary instead of the full form. Starts
  // collapsed only when all four are already present; the backfill effect
  // below can also collapse it later (signing in mid-checkout), but a tap on
  // "Edit" latches detailsExpandedByUserRef so it's never auto-collapsed
  // back out from under someone actively editing.
  const [detailsExpanded, setDetailsExpanded] = useState(
    () => !(form.firstName && form.email && form.phone && form.address)
  );
  const detailsExpandedByUserRef = useRef(false);
  // Inline validation errors, keyed by field — replaces modal alerts so the
  // shopper sees exactly which field to fix.
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  // Set when the shopper tries to continue signed-out: the sign-in card turns
  // into an error state instead of a modal interrupting them.
  const [signInNudge, setSignInNudge] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
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

  useEffect(() => {
    if (user) setSignInNudge(false);
  }, [user]);

  function scrollToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function setField(key: keyof CheckoutForm, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

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

  // Mirrors the merge the effect above performs, so the "Your details" card
  // can appear the moment a profile lands mid-checkout — without waiting a
  // render for the setForm above to commit, and without collapsing a form
  // the shopper explicitly opened via Edit.
  useEffect(() => {
    if (!user && !profile) return;
    if (detailsExpandedByUserRef.current) return;
    const hasAllDetails =
      (form.firstName || profile?.first_name) &&
      (form.email || user?.email) &&
      (form.phone || profile?.phone) &&
      (form.address || profile?.address);
    if (hasAllDetails) setDetailsExpanded(false);
  }, [user, profile]);

  useEffect(() => {
    if (!referenceId) return;

    let resolved = false;

    // Placing an order requires a session (handlePlaceOrder gates on it), so
    // by the time a referenceId exists the shopper always has an account and
    // an order history to point at. The "Check status" action goes straight
    // to confirmation.tsx, which knows how to poll/refresh a still-pending
    // order (see its "Check again" affordance).
    function showPaymentNotice(title: string, base: string) {
      setNotice({
        tone: 'error',
        title,
        lines: [`${base} If you approved the prompt, check the order status before paying again.`],
        action: {
          label: 'Check order status',
          onPress: () => router.push({ pathname: '/confirmation', params: { referenceId } }),
        },
      });
      scrollToTop();
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
        showPaymentNotice('Payment failed', 'Your payment was declined.');
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
          filter: `reference_id=eq.${referenceId}`,
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
          filter: `reference_id=eq.${referenceId}`,
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
      showPaymentNotice('Payment timed out', 'We didn\'t get a confirmation from MoMo in time.');
    }, PAYMENT_TIMEOUT_MS);

    return () => cleanup();
  }, [referenceId]);

  function validateDelivery(): boolean {
    // The payment API rejects unauthenticated calls (401), so don't let a
    // signed-out user reach the payment step and fail there. Everything
    // they've typed survives the round-trip (next=/checkout returns here).
    if (!user) {
      setSignInNudge(true);
      scrollToTop();
      return false;
    }
    const next: Partial<Record<keyof CheckoutForm, string>> = {};
    if (!form.firstName.trim()) next.firstName = 'Enter your first name';
    if (!form.email.trim()) next.email = 'Enter your email';
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = 'Enter a valid email address';
    if (!form.phone.trim()) next.phone = 'Enter your phone number';
    else if (!isValidLiberianMobile(form.phone)) next.phone = 'Enter a valid Liberian mobile number, e.g. 0888 640 502';
    // MoMo collection requests only reach MTN (Lonestar) numbers — the server
    // rejects other operators, so say so here instead of after the overlay.
    else if (!isMtnMobile(form.phone)) next.phone = 'MoMo needs an MTN number (starting 055 or 088)';
    if (!form.address.trim()) next.address = 'Enter your street address';
    if (!form.county) next.county = 'Select your county';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // A bad value can live in the collapsed "Your details" card — open it
      // so the field with the error is actually on screen.
      if (next.firstName || next.email || next.phone || next.address) {
        detailsExpandedByUserRef.current = true;
        setDetailsExpanded(true);
      }
      return false;
    }
    return true;
  }

  async function handlePlaceOrder() {
    if (items.length === 0) return;
    // Session may have expired since step 1 — the API would 401. Re-check
    // fresh state (not the render-time snapshot) before charging anyone.
    if (!useAuthStore.getState().user) {
      setStep(1);
      setSignInNudge(true);
      setNotice({ tone: 'warning', title: 'Your session ended', lines: ['Sign in again to place this order. Your details are saved.'] });
      scrollToTop();
      return;
    }
    setNotice(null);
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
        setNotice({
          tone: 'warning',
          title: 'We updated your cart',
          lines: [
            ...(stockIssues.length ? ['Availability changed:', ...stockIssues.map((x) => `• ${x}`)] : []),
            ...(priceChanges.length ? ['Prices were updated for:', ...priceChanges.map((x) => `• ${x}`)] : []),
            'Review the totals below, then continue.',
          ],
        });
        scrollToTop();
        return;
      }

      // Exactly the shape the web pay route destructures (see the web repo's
      // app/api/momo/pay/route.js and its own checkout page): top-level
      // `phone`, `items`, `userInfo`, `deliveryInfo`. Identity (user_id,
      // email) comes from the Bearer session server-side, and prices/totals
      // are recomputed from the products table — only cart selection and
      // contact/delivery details are sent.
      const payload = {
        phone: normalizeLiberianPhone(form.phone),
        payerMessage: 'Payment for Litway Picks Order',
        items: items.map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          ...(i.size ? { selectedSize: i.size } : {}),
          ...(i.color ? { selectedColor: i.color } : {}),
        })),
        userInfo: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        },
        deliveryInfo: {
          deliveryAddress: form.address.trim(),
          city: form.city.trim(),
          state: form.county,
        },
      };

      const { referenceId: ref } = await momoAPI.initiatePayment(payload);
      // Persist the moment we have a referenceId — see lib/storage.ts
      // pendingPayment for why (recoverable if the app is killed mid-poll).
      void pendingPayment.save({ referenceId: ref, createdAt: Date.now() });
      setReferenceId(ref);
      setPaymentStatus('polling');
    } catch (err: any) {
      setPaymentStatus('failed');
      setNotice({
        tone: 'error',
        title: 'Couldn\'t start the payment',
        lines: [err.message ?? 'Something went wrong. Please try again.'],
      });
      scrollToTop();
    }
  }

  return (
    <>
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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {notice && (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: notice.tone === 'error' ? '#fff1f2' : color.accentSoft,
              borderRadius: radius.md,
              padding: 14,
              marginBottom: 12,
              gap: 4,
              borderWidth: 1,
              borderColor: notice.tone === 'error' ? '#fecdd3' : color.peachTint,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={notice.tone === 'error' ? 'close-circle' : 'alert-circle'}
                size={18}
                color={notice.tone === 'error' ? color.danger : color.accent}
              />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: color.ink }}>{notice.title}</Text>
              <TouchableOpacity onPress={() => setNotice(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
                <Ionicons name="close" size={16} color={color.inkBody} />
              </TouchableOpacity>
            </View>
            {notice.lines?.map((l, i) => (
              <Text key={i} style={{ fontSize: 13, lineHeight: 19, color: color.inkBody, marginLeft: 26 }}>{l}</Text>
            ))}
            {notice.action && (
              <TouchableOpacity onPress={notice.action.onPress} style={{ marginLeft: 26, marginTop: 6, alignSelf: 'flex-start' }} accessibilityRole="button">
                <Text style={{ fontSize: 13, fontWeight: '800', color: color.accent }}>{notice.action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

        {items.length === 0 && paymentStatus !== 'success' && (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
            <Ionicons name="bag-outline" size={40} color={color.inkFaint} />
            <Text style={{ fontSize: 16, fontFamily: font.display, color: color.ink }}>Your cart is empty</Text>
            <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center' }}>Add something to your cart to check out.</Text>
            <Button title="Keep shopping" variant="outline" onPress={() => router.back()} />
          </View>
        )}

        {/* ─── STEP 1: Delivery ─── */}
        {items.length > 0 && step === 1 && (
          <>
            {/* The payment API requires the authenticated order owner, so an
                account is required to place an order. Framed as what it buys
                the customer (tracking), not as a registration demand — and
                with email confirmation off, signup is one tap. Delivery
                fields stay editable signed-out so nothing typed is lost;
                only the step-2 transition is gated (see validateDelivery). */}
            {!user ? (
              <View style={{ backgroundColor: color.surface, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: signInNudge ? 1.5 : 1, borderColor: signInNudge ? color.danger : color.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-circle-outline" size={24} color={color.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: color.ink }}>Sign in to place your order</Text>
                  <Text style={{ fontSize: 12, color: signInNudge ? color.danger : color.inkBody, fontWeight: signInNudge ? '700' : '400', marginTop: 1 }}>
                    {signInNudge ? 'Sign in to continue to payment. Your details are saved.' : 'Takes seconds, and lets you track this order'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/login', params: { next: '/checkout' } })} style={{ backgroundColor: color.accent, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Text style={{ color: color.onAccent, fontSize: 13, fontWeight: '800' }}>Sign in</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginLeft: 2 }}>
                <Ionicons name="checkmark-circle" size={16} color={color.success} />
                <Text style={{ fontSize: 12.5, color: color.inkMuted, fontWeight: '600' }}>Signed in as {user.email}</Text>
              </View>
            )}

            {detailsExpanded ? (
              <SectionCard title="Contact Info" icon="person-outline">
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="First Name *"
                      leftIcon="person-outline"
                      value={form.firstName}
                      error={errors.firstName}
                      onChangeText={(v) => setField('firstName', v)}
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
                      onChangeText={(v) => setField('lastName', v)}
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
                  error={errors.email}
                  onChangeText={(v) => setField('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
                <Input
                  ref={phoneRef}
                  label="Phone (MTN number for MoMo) *"
                  leftIcon="call-outline"
                  value={form.phone}
                  error={errors.phone}
                  onChangeText={(v) => setField('phone', v)}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                />
              </SectionCard>
            ) : (
              <KnownDetailsCard
                form={form}
                onEdit={() => {
                  detailsExpandedByUserRef.current = true;
                  setDetailsExpanded(true);
                }}
              />
            )}

            <SectionCard title="Delivery Address" icon="location-outline">
              {detailsExpanded && (
                <>
                  <Input
                    ref={addressRef}
                    label="Street Address *"
                    leftIcon="home-outline"
                    value={form.address}
                    error={errors.address}
                    onChangeText={(v) => setField('address', v)}
                    returnKeyType="next"
                    onSubmitEditing={() => cityRef.current?.focus()}
                  />
                  <Input
                    ref={cityRef}
                    label="City / Town"
                    leftIcon="business-outline"
                    value={form.city}
                    onChangeText={(v) => setField('city', v)}
                    returnKeyType="done"
                  />
                </>
              )}

              {/* County picker */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: color.inkMuted, marginBottom: 6 }}>County *</Text>
                <TouchableOpacity
                  onPress={() => setShowCountyPicker(!showCountyPicker)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: color.surface, borderRadius: radius.full, borderWidth: 1.5,
                    borderColor: errors.county ? color.danger : showCountyPicker ? color.accent : 'transparent',
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
                          onPress={() => { setField('county', county); setShowCountyPicker(false); }}
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
                {errors.county && (
                  <Text style={{ fontSize: 12, color: color.danger, marginTop: 4, marginLeft: 4 }}>{errors.county}</Text>
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
          </>
        )}

        {/* ─── STEP 2: Payment ─── */}
        {items.length > 0 && step === 2 && (
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

            <Text style={{ fontSize: 11, color: color.inkFaint, textAlign: 'center', marginTop: 4, lineHeight: 16 }}>
              By placing your order you agree to our Terms & Conditions.{'\n'}Payment is processed securely via MTN Mobile Money.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ─── Sticky footer: total + primary action, always reachable ─── */}
      {items.length > 0 && (
        <View
          style={{
            backgroundColor: color.surface,
            borderTopWidth: 1,
            borderTopColor: color.border,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: color.inkMuted }}>Subtotal</Text>
            <Text style={{ fontSize: 18, fontFamily: font.displayHeavy, color: color.ink }}>{formatCurrency(total)}</Text>
          </View>
          {step === 1 ? (
            <Button
              title="Continue to payment"
              onPress={() => { if (validateDelivery()) setStep(2); }}
              variant="primary"
              size="lg"
              style={{ flex: 1 }}
              icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
            />
          ) : (
            <Button
              title={
                paymentStatus === 'processing' ? 'Starting payment…'
                : paymentStatus === 'polling' ? 'Waiting for MoMo…'
                : 'Pay with MoMo'
              }
              onPress={handlePlaceOrder}
              disabled={isProcessing}
              loading={isProcessing}
              variant="primary"
              size="lg"
              style={{ flex: 1 }}
              icon={!isProcessing ? <Ionicons name="lock-closed" size={18} color={color.onAccent} /> : undefined}
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>

    <LoadingOverlay
      visible={paymentStatus === 'processing'}
      title="Contacting MTN MoMo…"
      subtitle="Setting up your payment — this takes a moment."
    />
    <LoadingOverlay
      visible={paymentStatus === 'polling'}
      title="Check your phone"
      subtitle={`Approve the MoMo prompt sent to ${form.phone || 'your phone'}. We'll confirm automatically.`}
    />
    </>
  );
}

function KnownDetailsCard({ form, onEdit }: { form: CheckoutForm; onEdit: () => void }) {
  const rows: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'person-outline', text: `${form.firstName} ${form.lastName}`.trim() },
    { icon: 'call-outline', text: form.phone },
    { icon: 'mail-outline', text: form.email },
    { icon: 'location-outline', text: form.city ? `${form.address}, ${form.city}` : form.address },
  ];

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>Your details</Text>
          <Text style={{ fontSize: 12, color: color.inkMuted, marginTop: 2, lineHeight: 16 }}>
            We'll deliver to the details on file — edit if anything changed.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit your details"
          style={{ backgroundColor: color.accentSoft, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7 }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: color.accent }}>Edit</Text>
        </TouchableOpacity>
      </View>
      {rows.map((r, i) => (
        <View key={r.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: i === rows.length - 1 ? 0 : 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={r.icon} size={14} color={color.inkMuted} />
          </View>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: color.ink }} numberOfLines={1}>{r.text}</Text>
        </View>
      ))}
    </Card>
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
