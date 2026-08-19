import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withDelay,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';

/**
 * The brand's loading state: the logo's bag holds steady (with a gentle bob)
 * while its speed lines streak past in sequence — "your stuff is moving."
 * Replaces generic spinners at meaningful wait moments. Honors reduced
 * motion (lines rest in place, no bob).
 */

function StreakLine({
  width,
  top,
  delay,
  streakColor,
}: {
  width: number;
  top: number;
  delay: number;
  streakColor: string;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        false
      )
    );
  }, [delay, p]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 0.75, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(p.value, [0, 1], [10, -14]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top,
          width,
          height: 4,
          borderRadius: 2,
          backgroundColor: streakColor,
        },
        style,
      ]}
    />
  );
}

export function BrandLoader({ size = 56, label }: { size?: number; label?: string }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System })
      ),
      -1,
      false
    );
  }, [bob]);

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bob.value, [0, 1], [1.5, -1.5]) }],
  }));

  const s = size / 120; // scale factor against the LogoMark's 120 viewBox

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width: size, height: size }}>
        {/* Speed lines streak right-to-left, staggered like the logo's trail */}
        <StreakLine width={26 * s} top={51 * s} delay={0} streakColor={color.accent} />
        <StreakLine width={22 * s} top={61 * s} delay={150} streakColor={color.ink} />
        <StreakLine width={16 * s} top={71 * s} delay={300} streakColor={color.accent} />

        {/* The bag (logo geometry, bag + glyph + feet only), gently bobbing */}
        <Animated.View style={[{ position: 'absolute', inset: 0 }, bobStyle]}>
          <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
            <Path
              d="M 59 43 v -5.5 a 8 8 0 0 1 16 0 v 5.5"
              stroke={color.accent}
              strokeWidth={3.6}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 53 42 L 81 42 Q 87 42 88.2 47.5 L 95 81.5 Q 96.6 90 87.5 90 L 46.5 90 Q 37.4 90 39 81.5 L 45.8 47.5 Q 47 42 53 42 Z"
              fill={color.accent}
            />
            <Path
              d="M 69.5 52.5 L 63.5 77.5 L 77 77.5"
              stroke={color.ink}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Ellipse cx={52.5} cy={98.5} rx={4.8} ry={7} transform="rotate(16 52.5 98.5)" fill={color.accent} />
            <Ellipse cx={80} cy={98.5} rx={4.8} ry={7} transform="rotate(-5 80 98.5)" fill={color.accent} />
          </Svg>
        </Animated.View>
      </View>
      {label ? (
        <Text style={{ fontSize: 13, color: color.inkMuted, fontWeight: '600' }}>{label}</Text>
      ) : null}
    </View>
  );
}
