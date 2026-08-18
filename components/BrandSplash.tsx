import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';

/**
 * Branded splash shown over the app while the session + onboarding state resolve,
 * then fades out. Replaces the default Expo placeholder splash with something
 * that actually reads as LitwaysPicks. Fully React-driven so it needs no image
 * assets and animates smoothly on both platforms.
 */
export function BrandSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const opacity = useSharedValue(1);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [shimmer]);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(onHidden)();
      });
    }
  }, [visible, opacity, onHidden]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (shimmer.value * 2 - 1) * 108 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, containerStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.center}>
        <Text style={styles.wordmark}>
          LITWAYS<Text style={{ color: color.accent }}>.</Text>
        </Text>
        <Text style={styles.tagline}>Shop Liberia. Pay with MoMo.</Text>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>

      <Text style={styles.footer}>Delivering to all 15 counties</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  wordmark: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1.4 },
  tagline: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  track: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    marginTop: 10,
  },
  fill: { width: 54, height: '100%', borderRadius: 999, backgroundColor: color.accent },
  footer: { position: 'absolute', bottom: 44, color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },
});
