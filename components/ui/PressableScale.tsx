import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  scale?: number;
  haptic?: boolean;
  children: React.ReactNode;
}

export function PressableScale({
  scale = 0.96,
  haptic = false,
  onPress,
  children,
  style,
  ...rest
}: Props) {
  const pressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? scale : 1, { damping: 15, stiffness: 200, reduceMotion: ReduceMotion.System }) }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressed.value = true;
      }}
      onPressOut={() => {
        pressed.value = false;
      }}
      onPress={(e) => {
        // Fire on a completed tap, not on touch-down: onPressIn also fires
        // when a finger lands to scroll, which buzzed on every touch.
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[animatedStyle, style as any]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
