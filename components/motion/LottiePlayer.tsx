import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';

interface Props {
  source: React.ComponentProps<typeof LottieView>['source'];
  /** Plays from the start whenever this turns true. */
  active?: boolean;
  size: number;
  /** What the picture shows, for screen readers (the animation itself is decorative). */
  label: string;
}

/**
 * A one-shot Lottie illustration that rests on its final frame. Under reduced
 * motion it shows that final frame immediately instead of playing.
 */
export function LottiePlayer({ source, active = true, size, label }: Props) {
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
