import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { color, gutter, radius, shadow, spacing } from '@/theme/tokens';

/** A titled card of rows separated by hairlines — the account screen's basic block. */
export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children);
  return (
    <View style={{ marginTop: spacing.xl, paddingHorizontal: gutter }}>
      {!!title && (
        <Text variant="overline" tone="muted" style={{ marginBottom: spacing.sm, marginLeft: 4 }}>
          {title}
        </Text>
      )}
      <View style={{ backgroundColor: color.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.card }}>
        {rows.map((row, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: color.border } : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  /** Right-aligned muted value shown before the chevron. */
  value?: string;
  onPress: () => void;
  danger?: boolean;
  /** Hide the chevron (e.g. a sign-out row). */
  noChevron?: boolean;
}

export function ListRow({ icon, label, subtitle, value, onPress, danger, noChevron }: RowProps) {
  const tint = danger ? color.danger : color.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.lg }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? '#fee2e2' : color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" tone={danger ? 'danger' : 'default'} numberOfLines={1}>{label}</Text>
        {!!subtitle && <Text variant="meta" tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>{subtitle}</Text>}
      </View>
      {!!value && <Text variant="meta" tone="muted" numberOfLines={1} style={{ maxWidth: 120 }}>{value}</Text>}
      {!noChevron && <Ionicons name="chevron-forward" size={17} color={color.inkFaint} />}
    </TouchableOpacity>
  );
}
