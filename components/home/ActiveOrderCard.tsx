import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { color, gutter, radius, shadow, spacing } from '@/theme/tokens';

/**
 * The shopper's latest in-flight order, on Home, so the question they most
 * care about after paying ("did it go through?") is answered without hunting.
 * Only shows for a signed-in user with an order from the last 14 days that is
 * awaiting payment (PENDING) or paid (SUCCESSFUL); finished, failed or older
 * orders stay in Account → Orders. There is no fulfilment tracking in the
 * data yet, so the steps are placed → paid → delivered.
 */

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const STATES = {
  PENDING: { step: 1, title: 'Waiting for payment approval', hint: 'Approve the MoMo prompt on your phone' },
  SUCCESSFUL: { step: 2, title: 'Payment received', hint: "We're preparing your order" },
} as const;

export function ActiveOrderCard() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: order } = useQuery({
    queryKey: ['active-order', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('orders')
        .select('id, external_id, payment_status, items, created_at')
        .eq('user_id', userId!)
        .in('payment_status', ['PENDING', 'SUCCESSFUL'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (!order) return null;
  const state = STATES[order.payment_status as keyof typeof STATES];
  if (!state) return null;
  const count = Array.isArray(order.items) ? order.items.length : 0;

  return (
    <PressableScale
      onPress={() => router.push(`/order/${order.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${state.title}. View order`}
      style={{ marginHorizontal: gutter, marginTop: spacing.lg }}
    >
      <View style={{ backgroundColor: color.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={state.step === 1 ? 'time-outline' : 'checkmark-circle-outline'} size={22} color={color.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{state.title}</Text>
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {state.hint}{count > 0 ? ` · ${count} item${count === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.inkMuted} />
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= state.step ? color.accent : color.border }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {['Placed', 'Paid', 'Delivered'].map((label) => (
            <Text key={label} variant="label" tone="muted" style={{ letterSpacing: 0 }}>{label}</Text>
          ))}
        </View>
      </View>
    </PressableScale>
  );
}
