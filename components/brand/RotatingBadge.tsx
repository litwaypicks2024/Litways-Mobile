import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';

/**
 * Editorial rotating-text badge — circular caption text slowly orbiting a
 * center arrow. Purely decorative motion; honors reduced motion by holding
 * still. Sized for overlaying campaign imagery.
 */
export function RotatingBadge({
  size = 78,
  /* Must fit the ring's circumference (2π·29 ≈ 182px at this glyph size) —
     longer strings collide with their own tail. */
  text = 'SHOP THE DROP • NEW IN • ',
}: {
  size?: number;
  text?: string;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 14000,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, spinStyle]}>
        <Svg width={size} height={size} viewBox="0 0 78 78">
          <Defs>
            <Path id="badge-ring" d="M 39 10 A 29 29 0 1 1 38.99 10" fill="none" />
          </Defs>
          <SvgText fill="#ffffff" fontSize="9" fontWeight="700" letterSpacing="1.2">
            <TextPath href="#badge-ring">{text}</TextPath>
          </SvgText>
        </Svg>
      </Animated.View>
      <Ionicons name="arrow-forward" size={20} color={color.accent} />
    </View>
  );
}
