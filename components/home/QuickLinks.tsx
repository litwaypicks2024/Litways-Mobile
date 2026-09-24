import React from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { color, gutter, radius, spacing } from '@/theme/tokens';

export interface QuickLink {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

/** One-tap shortcuts to the places shoppers return to (deals, new, saved, orders). */
export function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.sm }}
    >
      {links.map((l) => (
        <PressableScale
          key={l.key}
          haptic
          onPress={l.onPress}
          accessibilityRole="button"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 14, height: 42, borderRadius: radius.full,
            backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.fieldBorder,
          }}
        >
          <Ionicons name={l.icon} size={17} color={color.accent} />
          <Text variant="small">{l.label}</Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}
