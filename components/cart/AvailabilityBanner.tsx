import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { AvailabilityReport } from '@/lib/cartAvailability';
import { color, radius, spacing } from '@/theme/tokens';

/** Explains what the live stock/price check changed in the cart, item by item. */
export function AvailabilityBanner({ report, onDismiss }: { report: AvailabilityReport | null; onDismiss: () => void }) {
  if (!report) return null;
  const lines: string[] = [
    ...report.removed.map((n) => `${n} is sold out and was removed`),
    ...report.reduced.map((r) => `${r.name}: only ${r.to} left, quantity lowered`),
    ...report.repriced.map((n) => `${n} has a new price`),
  ];
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: color.accentSoft, borderRadius: radius.md, padding: 14, marginBottom: spacing.md, gap: 4, borderWidth: 1, borderColor: color.peachTint }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="alert-circle" size={18} color={color.accent} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>We updated your cart</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
          <Ionicons name="close" size={16} color={color.inkBody} />
        </TouchableOpacity>
      </View>
      {lines.map((l) => (
        <Text key={l} variant="caption" tone="body" style={{ marginLeft: 26 }}>• {l}</Text>
      ))}
    </View>
  );
}
