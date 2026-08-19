import React, { useEffect, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';

/**
 * Infinitely scrolling strip. Renders its content twice and translates one
 * full copy-width per loop, so the wrap is seamless. Honors reduced motion
 * (the strip simply holds still).
 */
export function Marquee({
  children,
  speed = 36,
  style,
}: {
  children: React.ReactNode;
  /** Pixels per second. */
  speed?: number;
  style?: ViewStyle;
}) {
  const [copyWidth, setCopyWidth] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (copyWidth <= 0) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(-copyWidth, {
        duration: (copyWidth / speed) * 1000,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false
    );
  }, [copyWidth, speed, x]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Animated.View style={[{ flexDirection: 'row' }, animatedStyle]}>
        <View
          style={{ flexDirection: 'row' }}
          onLayout={(e) => setCopyWidth(Math.round(e.nativeEvent.layout.width))}
        >
          {children}
        </View>
        <View style={{ flexDirection: 'row' }}>{children}</View>
      </Animated.View>
    </View>
  );
}
