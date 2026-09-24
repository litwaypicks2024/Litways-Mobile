import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { color, font } from '@/theme/tokens';
import { BrandLoader } from '@/components/motion/BrandLoader';

/**
 * Full-screen branded loading moment — a solid-color overlay with the
 * BrandLoader centered above a title/subtitle. For meaningful waits where
 * inline feedback isn't enough (e.g. post-sign-in hydration, payment
 * processing): blocks interaction while visible, disappears entirely
 * (unmounts) once hidden. Fades honor reduced motion via ReduceMotion.System,
 * same as BrandLoader itself.
 */
export function LoadingOverlay({
  visible,
  title,
  subtitle,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
}) {
  if (!visible) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root]}
      entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(220).reduceMotion(ReduceMotion.System)}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      <View style={styles.center}>
        <BrandLoader size={76} />
        <Text variant="title" style={styles.title}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted" style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    elevation: 500,
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', maxWidth: 280 },
});
