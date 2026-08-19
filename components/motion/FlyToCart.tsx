import React, { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
  ReduceMotion,
} from 'react-native-reanimated';
import { color, shadow } from '@/theme/tokens';
import { TAB_BAR_HEIGHT } from '@/components/navigation/TabBar';

/**
 * Fly-to-cart: a small bag chip arcs from the pressed Add-to-Cart button into
 * the tab bar's Cart tab. Purely decorative — cart state updates instantly and
 * independently. Trigger with flyToCart(pageX, pageY) from any screen; the
 * overlay lives once at the app root.
 *
 * The landing point is computed, not measured: the tab bar's geometry is fixed
 * (left/right 16, paddingHorizontal 6, four equal cells, Cart is cell 3).
 */

type Listener = (x: number, y: number) => void;
let listener: Listener | null = null;

export function flyToCart(startX: number, startY: number) {
  listener?.(startX, startY);
}

const CHIP = 34;

function cartTabCenter(insetsBottom: number) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const cellW = (SW - 32 - 12) / 4;
  return {
    x: 16 + 6 + cellW * 2.5,
    y: SH - (insetsBottom + 12) - TAB_BAR_HEIGHT / 2,
  };
}

export function FlyToCartOverlay() {
  const insets = useSafeAreaInsets();
  const [flight, setFlight] = useState<{ sx: number; sy: number; key: number } | null>(null);
  const progress = useSharedValue(0);

  const clear = useCallback(() => setFlight(null), []);

  // Register the module-level trigger. A second flight retargets the chip.
  listener = (sx: number, sy: number) => {
    setFlight({ sx, sy, key: Date.now() });
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: 650, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System },
      (done) => {
        if (done) runOnJS(clear)();
      }
    );
  };

  const target = cartTabCenter(insets.bottom);

  const chipStyle = useAnimatedStyle(() => {
    if (!flight) return { opacity: 0 };
    const { sx, sy } = flight;
    // Quadratic bezier: control point above the straight midpoint for an arc.
    const cx = (sx + target.x) / 2;
    const cy = Math.min(sy, target.y) - 130;
    const p = progress.value;
    const inv = 1 - p;
    const x = inv * inv * sx + 2 * inv * p * cx + p * p * target.x;
    const y = inv * inv * sy + 2 * inv * p * cy + p * p * target.y;
    return {
      opacity: interpolate(p, [0, 0.05, 0.9, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x - CHIP / 2 },
        { translateY: y - CHIP / 2 },
        { scale: interpolate(p, [0, 1], [1, 0.5]) },
      ],
    };
  });

  if (!flight) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        key={flight.key}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: CHIP,
            height: CHIP,
            borderRadius: CHIP / 2,
            backgroundColor: color.accent,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.card,
          },
          chipStyle,
        ]}
      >
        <Ionicons name="bag" size={16} color="#fff" />
      </Animated.View>
    </View>
  );
}
