import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { color, radius, spacing } from '@/theme/tokens';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  /** Omit for a notice that can't be waved away (it goes when the reason does). */
  onDismiss?: () => void;
}

/**
 * A compact notice at the top of the inbox: what's missing, why it's worth
 * fixing, and the one action that fixes it. The inbox shows one at a time so
 * the notifications themselves stay on screen.
 */
export function InboxNotice({ icon, title, body, actionLabel, onAction, onDismiss }: Props) {
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: color.border, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={19} color={color.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="body" style={{ marginTop: 1 }}>{body}</Text>
        <TouchableOpacity onPress={onAction} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.sm, alignSelf: 'flex-start' }}>
          <Text variant="small" tone="accent">{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={color.accent} />
        </TouchableOpacity>
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={color.inkMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
