import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  AppState,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CheckoutSection } from '@/components/checkout/CheckoutSection';
import { CountyField } from '@/components/checkout/CountyField';
import { OrderSummary, SecureNote } from '@/components/checkout/OrderSummary';
import { PayBar } from '@/components/checkout/PayBar';
import { PaymentProgress } from '@/components/checkout/PaymentProgress';
import { color, gutter, radius, spacing } from '@/theme/tokens';
import { momoAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { normalizeLiberianPhone, isValidLiberianMobile, isMtnMobile } from '@/lib/phone';
import { pendingPayment } from '@/lib/storage';
import type { CheckoutForm } from '@/types';
import { alertDialog } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';

type PaymentStatus = 'idle' | 'processing' | 'polling' | 'success' | 'failed';

/** Inline status message — replaces modal alerts for payment/cart/sign-in outcomes. */
type Notice = {
  tone: 'error' | 'warning';
  title: string;
  lines?: string[];
  action?: { label: string; onPress: () => void };
};

const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

export default function CheckoutScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const reconcile = useCartStore((s) => s.reconcile);
  const total = useCartStore((s) => s.subtotal());
  const itemCount = useCartStore((s) => s.itemCount());
  const mergeNotice = useCartStore((s) => s.mergeNotice);
  const dismissMergeNotice = useCartStore((s) => s.dismissMergeNotice);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

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
  // Y of the delivery block, so a failed validation can scroll straight to it.
  const deliveryY = useRef(0);
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

  function scrollToDelivery() {
    scrollRef.current?.scrollTo({ y: Math.max(deliveryY.current - spacing.md, 0), animated: true });
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
      alertDialog(
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
      scrollToDelivery();
      return false;
    }
    return true;
  }

  async function handlePlaceOrder() {
    if (items.length === 0) return;
    if (!validateDelivery()) return;
    // Session may have expired since step 1 — the API would 401. Re-check
    // fresh state (not the render-time snapshot) before charging anyone.
    if (!useAuthStore.getState().user) {
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
        setNotice({
          tone: 'warning',
          title: 'We updated your cart',
          lines: [
            ...(stockIssues.length ? ['Availability changed:', ...stockIssues.map((x) => `• ${x}`)] : []),
            ...(priceChanges.length ? ['Prices were updated for:', ...priceChanges.map((x) => `• ${x}`)] : []),
            'Review the totals below, then pay.',
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

  const payLabel = paymentStatus === 'processing' ? 'Placing your order…' : paymentStatus === 'polling' ? 'Almost there…' : 'Pay with MoMo';
  const deliveryReady = !!(form.firstName && form.email && form.phone && form.address && form.county);

  return (
    <>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Checkout" onBack={() => router.back()} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: gutter, paddingBottom: spacing.lg }}
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
              <Text variant="bodyStrong" style={{ flex: 1 }}>{notice.title}</Text>
              <TouchableOpacity onPress={() => setNotice(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
                <Ionicons name="close" size={16} color={color.inkBody} />
              </TouchableOpacity>
            </View>
            {notice.lines?.map((l, i) => (
              <Text variant="caption" tone="body" key={i} style={{ marginLeft: 26 }}>{l}</Text>
            ))}
            {notice.action && (
              <TouchableOpacity onPress={notice.action.onPress} style={{ marginLeft: 26, marginTop: 6, alignSelf: 'flex-start' }} accessibilityRole="button">
                <Text variant="small" tone="accent">{notice.action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* A cart merge (e.g. signing in mid-checkout) can land at any point. */}
        {mergeNotice && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.accentSoft, marginBottom: 12, padding: 12, borderRadius: radius.md }}>
            <Ionicons name="information-circle" size={18} color={color.accent} />
            <Text variant="metaStrong" style={{ flex: 1, color: color.accentPressed }}>
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
            <Text variant="heading">Your cart is empty</Text>
            <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>Add something to your cart to check out.</Text>
            <Button title="Keep shopping" variant="outline" onPress={() => router.back()} />
          </View>
        )}

        {items.length > 0 && (
          <>
            {/* The payment API needs the authenticated order owner. Framed as what it
                buys the shopper (tracking); everything typed below survives the
                round-trip (next=/checkout returns here). */}
            {!user && (
              <View style={{ backgroundColor: color.surface, borderRadius: radius.lg, padding: 14, marginBottom: spacing.md, borderWidth: signInNudge ? 1.5 : 1, borderColor: signInNudge ? color.danger : color.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-circle-outline" size={24} color={color.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="small">Sign in to place your order</Text>
                  <Text variant={signInNudge ? 'metaStrong' : 'meta'} tone={signInNudge ? 'danger' : 'body'} style={{ marginTop: 1 }}>
                    {signInNudge ? 'Sign in to pay. Your details are saved.' : 'Takes seconds, and lets you track this order'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(auth)/login', params: { next: '/checkout' } })}
                  accessibilityRole="button"
                  style={{ backgroundColor: color.accentFill, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9 }}
                >
                  <Text variant="small" tone="onAccent">Sign in</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 1 · Delivery */}
            <CheckoutSection
              step={1}
              title="Delivery"
              done={deliveryReady && !detailsExpanded}
              actionLabel={!detailsExpanded ? 'Edit' : undefined}
              onAction={() => {
                detailsExpandedByUserRef.current = true;
                setDetailsExpanded(true);
              }}
              onLayout={(e) => { deliveryY.current = e.nativeEvent.layout.y; }}
            >
              {detailsExpanded ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="First name *"
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
                        label="Last name"
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
                  <Input
                    ref={addressRef}
                    label="Street address *"
                    leftIcon="home-outline"
                    value={form.address}
                    error={errors.address}
                    onChangeText={(v) => setField('address', v)}
                    returnKeyType="next"
                    onSubmitEditing={() => cityRef.current?.focus()}
                  />
                  <Input
                    ref={cityRef}
                    label="City / town"
                    leftIcon="business-outline"
                    value={form.city}
                    onChangeText={(v) => setField('city', v)}
                    returnKeyType="done"
                  />
                </>
              ) : (
                <KnownDetails form={form} />
              )}
              <View style={{ marginTop: detailsExpanded ? 0 : spacing.lg }}>
                <CountyField value={form.county} error={errors.county} onChange={(c) => setField('county', c)} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md }}>
                <Ionicons name="car-outline" size={16} color={color.success} />
                <Text variant="meta" tone="muted">We deliver across all 15 Liberian counties</Text>
              </View>
            </CheckoutSection>

            {/* 2 · Payment */}
            <CheckoutSection step={2} title="Payment">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.accentSoft, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: color.accent }}>
                <View style={{ width: 46, height: 46, backgroundColor: color.accentFill, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="label" tone="onAccent">MoMo</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong">MTN Mobile Money</Text>
                  <Text variant="meta" tone="body" numberOfLines={2} style={{ marginTop: 2 }}>
                    You'll get a prompt on {form.phone || 'your phone'} to approve the payment
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={color.accent} />
              </View>
            </CheckoutSection>

            {/* 3 · Order summary */}
            <CheckoutSection step={3} title={`Your order (${itemCount})`}>
              <OrderSummary items={items} subtotal={total} />
            </CheckoutSection>

            <SecureNote />
            <Text variant="label" tone="muted" style={{ textAlign: 'center', marginBottom: spacing.md }}>
              By paying you agree to our Terms & Conditions.
            </Text>
          </>
        )}
      </ScrollView>

      {items.length > 0 && (
        <PayBar total={total} itemCount={itemCount} busy={isProcessing} label={payLabel} onPay={handlePlaceOrder} />
      )}
    </KeyboardAvoidingView>

    <PaymentProgress phase={paymentStatus === 'processing' || paymentStatus === 'polling' ? paymentStatus : null} phone={form.phone} />
    </>
  );
}

/** Read-only contact + address summary shown when the profile already has everything. */
function KnownDetails({ form }: { form: CheckoutForm }) {
  const rows: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'person-outline', text: `${form.firstName} ${form.lastName}`.trim() },
    { icon: 'call-outline', text: form.phone },
    { icon: 'mail-outline', text: form.email },
    { icon: 'location-outline', text: form.city ? `${form.address}, ${form.city}` : form.address },
  ];
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={r.icon} size={14} color={color.inkMuted} />
          </View>
          <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}
