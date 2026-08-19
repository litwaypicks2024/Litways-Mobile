import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';

/**
 * Gentle idle bob for illustrations — slow enough to feel ambient, never
 * distracting. Holds still under reduced motion.
 */
export function IdleFloat({
  children,
  distance = 5,
  duration = 1900,
}: {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System })
      ),
      -1,
      false
    );
  }, [duration, p]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0, 1], [distance / 2, -distance / 2]) }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
