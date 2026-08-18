import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
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

  function handleHaptic() {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressed.value = true;
        if (haptic) runOnJS(handleHaptic)();
      }}
      onPressOut={() => {
        pressed.value = false;
      }}
      onPress={onPress}
      style={[animatedStyle, style as any]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
