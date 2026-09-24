import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatCurrency } from '@/lib/currency';
import { color, spacing } from '@/theme/tokens';

interface Props {
  total: number;
  itemCount: number;
  busy: boolean;
  label: string;
  onPay: () => void;
}

/** Pinned footer: total on the left, pay button on the right (Keeta / foodpanda pattern). */
export function PayBar({ total, itemCount, busy, label, onPay }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border,
        paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md),
        flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
      }}
    >
      <View style={{ flexShrink: 0 }}>
        <Text variant="meta" tone="muted">Subtotal · {itemCount} item{itemCount === 1 ? '' : 's'}</Text>
        <Text variant="priceLg">{formatCurrency(total)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Button
          title={label}
          onPress={onPay}
          disabled={busy}
          loading={busy}
          size="lg"
          fullWidth
          icon={!busy ? <Ionicons name="lock-closed" size={17} color={color.onAccent} /> : undefined}
        />
      </View>
    </View>
  );
}
