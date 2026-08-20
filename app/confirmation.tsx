import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { BrandLoader } from '@/components/motion/BrandLoader';
import { DrawnCheckmark } from '@/components/motion/DrawnCheckmark';
import { IdleFloat } from '@/components/motion/IdleFloat';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  ZoomIn,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { momoAPI } from '@/lib/api';
import { pendingPayment } from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, shadow } from '@/theme/tokens';
import { Card } from '@/components/ui/Card';
import { MotifBand } from '@/components/brand/Motif';

// Same terminal-status predicate checkout.tsx's finalize() uses to decide the
// payment succeeded — reused here so this screen never calls a payment
// "confirmed" (or clears the cart) on a status checkout.tsx wouldn't also
// treat as success.
function isTerminalSuccess(rawStatus: string | undefined | null): boolean {
  const status = (rawStatus ?? '').toUpperCase();
  return status === 'SUCCESSFUL' || status === 'COMPLETED';
}
function isTerminalFailure(rawStatus: string | undefined | null): boolean {
  const status = (rawStatus ?? '').toUpperCase();
  return status === 'FAILED' || status === 'DISPUTED';
}

// Shared by the initial fetch and the background pending-poll below. Only
// clears the pending-payment recovery record (see lib/storage.ts and
// _layout.tsx's cold-start prompt) once the order for THIS referenceId has
// reached a terminal outcome — a PENDING result must leave the record alone,
// or a payment that's genuinely still in flight loses its only recovery path
// if the app is killed before it resolves (re-opens the double-charge loop
// this whole mechanism exists to close). Clears the cart on verified
// terminal-success only, using the exact predicate checkout.tsx's finalize()
// uses. Guests too — clearCart is local device state, not account-gated.
async function reconcilePendingPayment(referenceId: string, data: any) {
  const stored = await pendingPayment.get();
  if (stored?.referenceId !== referenceId) return;
  const terminalSuccess = isTerminalSuccess(data?.payment_status);
  const terminalFailure = isTerminalFailure(data?.payment_status);
  if (terminalSuccess) {
    useCartStore.getState().clearCart();
  }
  if (terminalSuccess || terminalFailure) {
    await pendingPayment.clear();
  }
}

type Outcome = 'checking' | 'confirmed' | 'pending' | 'failed' | 'unreachable';

export default function ConfirmationScreen() {
  const { referenceId } = useLocalSearchParams<{ referenceId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  const ORDER_FETCH_MAX_ATTEMPTS = 3;
  const ORDER_FETCH_RETRY_DELAY_MS = 1500;

  useEffect(() => {
    if (!referenceId) {
      // No reference to look up at all (malformed/missing param) — without
      // this, loading stays true forever since fetchOrder never runs. Falls
      // through to the 'unreachable' outcome below.
      setLoading(false);
      setOrder(null);
      return;
    }
    let cancelled = false;

    async function fetchOrder(attempt: number) {
      try {
        const data = await momoAPI.getOrder(referenceId);
        if (cancelled) return;
        setOrder(data);
        setLoading(false);
        await reconcilePendingPayment(referenceId, data);
      } catch {
        if (cancelled) return;
        if (attempt < ORDER_FETCH_MAX_ATTEMPTS) {
          setTimeout(() => {
            if (!cancelled) fetchOrder(attempt + 1);
          }, ORDER_FETCH_RETRY_DELAY_MS);
        } else {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setOrder(null);
    fetchOrder(1);

    return () => {
      cancelled = true;
    };
  }, [referenceId, retryToken]);

  // Gates the hero on what we actually know — never declares success before
  // it's known. "checking" while the fetch is in flight, "unreachable" if it
  // never resolved after retries, otherwise one of the three payment_status
  // outcomes checkout.tsx's finalize() would also recognize.
  const outcome: Outcome = loading
    ? 'checking'
    : !order
    ? 'unreachable'
    : isTerminalSuccess(order.payment_status)
    ? 'confirmed'
    : isTerminalFailure(order.payment_status)
    ? 'failed'
    : 'pending';

  // Background poll for a still-pending payment — the pending copy below
  // promises we "keep checking automatically", so make that true rather than
  // relying solely on the manual "Check again" button. Mirrors checkout.tsx's
  // own live-payment poll cadence. Deliberately doesn't touch `loading`/
  // `order` via the main fetch effect above — a silent re-fetch here so the
  // hero doesn't flash back to "Checking your order…" on every tick; only a
  // changed (terminal) result swaps the hero. Stops on unmount, on leaving
  // 'pending' (the effect re-runs and its cleanup clears the old interval),
  // or after ~2 minutes of no resolution.
  useEffect(() => {
    if (outcome !== 'pending' || !referenceId) return;
    let cancelled = false;
    let attempts = 0;
    const POLL_INTERVAL_MS = 5000;
    const POLL_MAX_ATTEMPTS = 24; // ~2 minutes

    const intervalId = setInterval(() => {
      attempts += 1;
      if (attempts > POLL_MAX_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }
      momoAPI
        .getOrder(referenceId)
        .then(async (data) => {
          if (cancelled) return;
          setOrder(data);
          await reconcilePendingPayment(referenceId, data);
        })
        .catch(() => {
          // Transient failure — leave the last-known order in place and let
          // the next tick (or the manual "Check again") try again.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [outcome, referenceId]);

  // Radiating ring behind the checkmark badge — plays when the hero actually
  // flips to 'confirmed', not on component mount: the ring only renders
  // inside the confirmed branch below, which can mount long after mount time
  // (once the fetch resolves), so a mount-keyed animation would already have
  // finished by then and never visibly play.
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.35);

  useEffect(() => {
    if (outcome !== 'confirmed') return;
    ringScale.value = 1;
    ringOpacity.value = 0.35;
    ringScale.value = withTiming(1.6, { duration: 700, reduceMotion: ReduceMotion.System });
    ringOpacity.value = withTiming(0, { duration: 700, reduceMotion: ReduceMotion.System });
  }, [outcome]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: insets.top + 32, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {outcome === 'confirmed' ? (
            <>
              <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      width: 96, height: 96, borderRadius: 48,
                      backgroundColor: color.accent,
                    },
                    ringAnimatedStyle,
                  ]}
                />
                <Animated.View
                  entering={ZoomIn.springify().damping(12).reduceMotion(ReduceMotion.System)}
                  style={{
                    width: 96, height: 96, borderRadius: 48,
                    backgroundColor: color.surface,
                    alignItems: 'center', justifyContent: 'center',
                    ...shadow.card,
                  }}
                >
                  <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <DrawnCheckmark size={44} delay={250} />
                  </View>
                </Animated.View>
              </View>
              <Text style={{ fontSize: 22, fontFamily: font.displayHeavy, color: color.ink }}>Thank you!</Text>
              <Text style={{ fontSize: 17, fontFamily: font.display, color: color.accent, marginTop: 2 }}>Your order is confirmed</Text>
              <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                We received your order and it's now being processed.
              </Text>
            </>
          ) : outcome === 'failed' ? (
            <>
              <View style={{
                width: 96, height: 96, borderRadius: 48, marginBottom: 20,
                backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center',
                ...shadow.card,
              }}>
                <Ionicons name="alert-circle" size={44} color={color.danger} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: font.displayHeavy, color: color.ink, textAlign: 'center' }}>
                This payment didn't go through
              </Text>
              <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                Your payment wasn't completed, so nothing was charged for this order. If you think you were charged, contact support with the reference below.
              </Text>
            </>
          ) : outcome === 'pending' ? (
            <>
              <View style={{ marginBottom: 20 }}>
                <BrandLoader size={80} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: font.displayHeavy, color: color.ink, textAlign: 'center' }}>
                We're still confirming this payment
              </Text>
              <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                This can take a moment. We'll keep checking automatically — you can also check again now.
              </Text>
              <Button
                title="Check again"
                variant="outline"
                size="sm"
                onPress={() => setRetryToken((t) => t + 1)}
                style={{ marginTop: 14 }}
              />
            </>
          ) : outcome === 'unreachable' ? (
            <>
              <View style={{
                width: 96, height: 96, borderRadius: 48, marginBottom: 20,
                backgroundColor: color.surfaceSunken, alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="cloud-offline-outline" size={40} color={color.inkFaint} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: font.displayHeavy, color: color.ink, textAlign: 'center' }}>
                We couldn't check your order
              </Text>
              <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                We couldn't reach the server to check this order.
              </Text>
            </>
          ) : (
            <>
              <View style={{ marginBottom: 20 }}>
                <BrandLoader size={80} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: font.displayHeavy, color: color.ink, textAlign: 'center' }}>
                Checking your order…
              </Text>
              <Text style={{ fontSize: 13, color: color.inkMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                Hold on while we verify your payment.
              </Text>
            </>
          )}
        </View>

        <Animated.View
          entering={FadeInDown.duration(280).delay(120 + 0 * 70).reduceMotion(ReduceMotion.System)}
          style={{ marginBottom: 24, borderRadius: 4, overflow: 'hidden' }}
        >
          <MotifBand />
        </Animated.View>

        {loading ? null : order ? (
          <>
            <Animated.View
              entering={FadeInDown.duration(280).delay(120 + 1 * 70).reduceMotion(ReduceMotion.System)}
              style={{ flexDirection: 'row', marginBottom: 12, gap: 12, alignItems: 'center' }}
            >
              <View style={{ backgroundColor: color.peachTint, borderRadius: 20, padding: 16, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="document-text-outline" size={22} color={color.accentPressed} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: color.accentPressed, fontWeight: '700', marginBottom: 2 }}>ORDER ID</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>{order.external_id}</Text>
                </View>
              </View>
              {/* Clay-render rider; container matches the artwork's own bg (#e9e8e7)
                  so the square edge disappears into a deliberate rounded card. */}
              <IdleFloat>
                <View style={{ backgroundColor: '#e9e8e7', borderRadius: 20, overflow: 'hidden' }}>
                  <Image
                    source={require('@/assets/images/delivery-illustration.jpg')}
                    style={{ width: 104, height: 104 }}
                    contentFit="cover"
                    transition={250}
                  />
                </View>
              </IdleFloat>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(280).delay(120 + 2 * 70).reduceMotion(ReduceMotion.System)}>
              <Card style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Order Details
                </Text>
                <View style={{ gap: 10 }}>
                  <Row label="Status" value={order.payment_status} highlight />
                  <Row
                    label={outcome === 'confirmed' ? 'Total Paid' : 'Order total'}
                    value={formatCurrency(order.final_total)}
                    highlight
                  />
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(280).delay(120 + 3 * 70).reduceMotion(ReduceMotion.System)}>
              <Card style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Delivery
                </Text>
                <View style={{ gap: 10 }}>
                  <Row label="Name" value={`${order.customer_first_name} ${order.customer_last_name}`} />
                  <Row label="Email" value={order.customer_email} />
                  <Row label="Phone" value={order.customer_phone} />
                  <Row label="Address" value={`${order.delivery_address}, ${order.delivery_city}, ${order.delivery_state}`} />
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(280).delay(120 + 4 * 70).reduceMotion(ReduceMotion.System)}>
              <Card style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Items
                </Text>
                {(order.items as any[])?.map((item: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border }}>
                    <Text style={{ fontSize: 13, color: color.ink, flex: 1 }} numberOfLines={1}>
                      {item.name} {item.size ? `(${item.size})` : ''} × {item.quantity}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: color.accent, marginLeft: 8 }}>
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                  </View>
                ))}
              </Card>
            </Animated.View>

          </>
        ) : (
          <View style={{ backgroundColor: color.peachTint, borderRadius: 20, padding: 16, marginBottom: 24, alignItems: 'center' }}>
            {referenceId ? (
              <>
                <Text style={{ fontSize: 13, color: color.accentPressed, textAlign: 'center', fontWeight: '600', marginBottom: 14 }}>
                  Your reference:{'\n'}{referenceId}
                </Text>
                <Button
                  title="Try again"
                  variant="outline"
                  size="sm"
                  onPress={() => setRetryToken((t) => t + 1)}
                />
              </>
            ) : (
              <Text style={{ fontSize: 13, color: color.accentPressed, textAlign: 'center', fontWeight: '600' }}>
                No order reference was provided, so there's nothing to check here.
              </Text>
            )}
          </View>
        )}

        <Animated.View entering={FadeInDown.duration(280).delay(120 + 5 * 70).reduceMotion(ReduceMotion.System)}>
          {user ? (
            <Button
              title="Track Your Order"
              onPress={() => router.replace({ pathname: '/(tabs)/account', params: { tab: 'orders' } })}
              variant="primary"
              fullWidth
              size="lg"
            />
          ) : (
            <>
              <Button title="Done" onPress={() => router.replace('/(tabs)')} variant="primary" fullWidth size="lg" />
              <Text style={{ fontSize: 12, color: color.inkMuted, textAlign: 'center', marginTop: 10, lineHeight: 17 }}>
                Track this order anytime with the link in your confirmation email.
              </Text>
            </>
          )}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(280).delay(120 + 6 * 70).reduceMotion(ReduceMotion.System)}>
          <Button title="Continue Shopping" variant="outline" onPress={() => router.replace('/(tabs)')} fullWidth size="md" style={{ marginTop: 12 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: color.inkMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: highlight ? color.accent : color.ink }}>{value}</Text>
    </View>
  );
}
