import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  makeMutable,
  cancelAnimation,
  useAnimatedStyle,
  interpolate,
  withRepeat,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * One clock drives every skeleton on screen. Each block used to start its own
 * repeating animation plus a gradient view, so a first load with dozens of
 * blocks ran dozens of animations on the UI thread. Now a single timing loop
 * runs while at least one block is mounted (reference-counted) and stops the
 * moment the last one unmounts; each block just reads it into an opacity.
 */
const pulse = makeMutable(0);
let mounted = 0;

function usePulse() {
  useEffect(() => {
    if (mounted++ === 0) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
        -1,
        true
      );
    }
    return () => {
      if (--mounted === 0) {
        cancelAnimation(pulse);
        pulse.value = 0;
      }
    };
  }, []);
}

export function SkeletonBlock({ width = '100%', height, borderRadius = 8, style }: SkeletonProps) {
  usePulse();
  const animatedStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [1, 0.55]) }));

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: '#e2e2e2' }, style, animatedStyle]}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={{ width: 172, marginRight: 12 }}>
      <SkeletonBlock height={185} borderRadius={16} />
      <View style={{ paddingTop: 8, gap: 6 }}>
        <SkeletonBlock height={10} width="50%" borderRadius={5} />
        <SkeletonBlock height={13} borderRadius={6} />
        <SkeletonBlock height={16} width="40%" borderRadius={6} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: '50%', padding: 6 }}>
          <SkeletonBlock height={190} borderRadius={16} />
          <View style={{ paddingTop: 8, gap: 6 }}>
            <SkeletonBlock height={10} width="45%" borderRadius={5} />
            <SkeletonBlock height={13} borderRadius={6} />
            <SkeletonBlock height={16} width="35%" borderRadius={6} style={{ marginTop: 2 }} />
          </View>
        </View>
      ))}
    </>
  );
}
