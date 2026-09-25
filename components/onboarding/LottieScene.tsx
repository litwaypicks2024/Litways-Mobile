import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';

interface Props {
  source: React.ComponentProps<typeof LottieView>['source'];
  /** True while this scene is the one on screen: it (re)plays from the start each time it becomes active. */
  active: boolean;
  size: number;
  /** What the picture shows, for screen readers (the animation itself is decorative). */
  label: string;
}

/**
 * One choreographed onboarding illustration. Plays once when it comes into view
 * and rests on its final frame (no loop: a story, not a screensaver). Under
 * reduced motion it shows that final frame straight away.
 */
export function LottieScene({ source, active, size, label }: Props) {
  const ref = useRef<LottieView>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    ref.current?.reset();
    if (active) ref.current?.play();
  }, [active, reduced]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
      <LottieView
        ref={ref}
        source={source}
        style={{ width: '100%', height: '100%' }}
        loop={false}
        autoPlay={false}
        resizeMode="contain"
        {...(reduced ? { progress: 1 } : {})}
      />
    </View>
  );
}
