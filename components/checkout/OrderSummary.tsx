import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { formatCurrency } from '@/lib/currency';
import { color, spacing } from '@/theme/tokens';
import type { CartItem } from '@/types';

/** Item lines (thumbnail with quantity badge, one-line name, line total) and the totals block. */
export function OrderSummary({ items, subtotal }: { items: CartItem[]; subtotal: number }) {
  return (
    <View>
      {items.map((item, i) => (
        <View
          key={`${item.productId}::${item.size}::${item.color}`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md,
            borderTopWidth: i === 0 ? 0 : 1, borderTopColor: color.border,
          }}
        >
          <View>
            <View style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: color.surfaceSunken }}>
              <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </View>
            <View
              style={{
                position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
                backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: color.surface,
              }}
            >
              <Text variant="overline" style={{ color: '#fff', textTransform: 'none', letterSpacing: 0 }}>{item.quantity}</Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{item.name}</Text>
            {(item.size || item.color) && (
              <Text variant="meta" tone="muted" numberOfLines={1}>{[item.size, item.color].filter(Boolean).join(' · ')}</Text>
            )}
          </View>
          <Text variant="small">{formatCurrency(item.price * item.quantity)}</Text>
        </View>
      ))}

      <View style={{ borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.md, gap: spacing.sm }}>
        <Line label="Subtotal" value={formatCurrency(subtotal)} />
        {/* No client-side delivery quote exists — the MoMo prompt carries the authoritative total. */}
        <Line label="Delivery" value="Shown in MoMo prompt" muted />
      </View>
    </View>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
      <Text variant="body" tone="body">{label}</Text>
      <Text variant={muted ? 'caption' : 'bodyStrong'} tone={muted ? 'muted' : undefined}>{value}</Text>
    </View>
  );
}

export function SecureNote() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, marginBottom: spacing.lg }}>
      <Ionicons name="lock-closed" size={13} color={color.inkMuted} />
      <Text variant="meta" tone="muted">Secure payment via MTN Mobile Money</Text>
    </View>
  );
}
