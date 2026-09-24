import React from 'react';
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { color, radius, shadow, spacing } from '@/theme/tokens';

interface Props {
  step: number;
  title: string;
  /** Shows a green tick in place of the number once the section is filled in. */
  done?: boolean;
  /** Text action on the right ("Edit"). */
  actionLabel?: string;
  onAction?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}

/** One numbered block of the single-page checkout: Delivery, Payment, Order summary. */
export function CheckoutSection({ step, title, done, actionLabel, onAction, onLayout, children }: Props) {
  return (
    <View
      onLayout={onLayout}
      style={{ backgroundColor: color.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <View
          style={{
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: done ? color.success : color.accentFill,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text variant="metaStrong" style={{ color: '#fff' }}>{step}</Text>}
        </View>
        <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
        {!!actionLabel && !!onAction && (
          <TouchableOpacity onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${actionLabel} ${title.toLowerCase()}`}>
            <Text variant="small" tone="accent">{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
