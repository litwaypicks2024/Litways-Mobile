import React, { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/* Path length of the check stroke below (two segments) — dash trickery
   depends on it matching. */
const STROKE_LENGTH = 40;

/**
 * A checkmark that draws itself in — stroke reveal via dash offset. Under
 * reduced motion it appears fully drawn immediately.
 */
export function DrawnCheckmark({
  size = 44,
  color = '#ffffff',
  delay = 0,
}: {
  size?: number;
  color?: string;
  delay?: number;
}) {
  const offset = useSharedValue(STROKE_LENGTH);

  useEffect(() => {
    offset.value = withDelay(
      delay,
      withTiming(0, {
        duration: 450,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [delay, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <AnimatedPath
        d="M 9 23 L 18.5 32.5 L 35 13"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={STROKE_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
