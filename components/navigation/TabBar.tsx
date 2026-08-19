import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, type View as RNView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import Animated, {
  Easing,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { color, shadow } from '@/theme/tokens';
import { useCartStore } from '@/store/cart';

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_FAB_SIZE = 56;

export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + 12 + TAB_BAR_HEIGHT;
}

interface TabButtonProps extends TabTriggerSlotProps {
  iconOn: keyof typeof Ionicons.glyphMap;
  iconOff: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
}

const BADGE_POP_SPRING = { damping: 12, stiffness: 220, reduceMotion: ReduceMotion.System } as const;

/* The active circle rises out of the bar and overshoots slightly, like it
   physically landed there. */
const CIRCLE_RISE = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.55 }] },
  55: { opacity: 1, transform: [{ translateY: -3 }, { scale: 1.04 }], easing: Easing.out(Easing.quad) },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.inOut(Easing.quad) },
})
  .duration(300)
  .reduceMotion(ReduceMotion.System);

function IconBadge({ count, ringColor }: { count: number; ringColor: string }) {
  const scale = useSharedValue(1);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      // Skip the pop on first mount — only react to subsequent count changes.
      hasMounted.current = true;
      return;
    }
    scale.value = withSequence(withSpring(1.3, BADGE_POP_SPRING), withSpring(1, BADGE_POP_SPRING));
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (count <= 0) return null;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -4,
          right: -8,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: color.accent,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 1.5,
          borderColor: ringColor,
        },
        animatedStyle,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

/* The raised circle is the ACTIVE-tab indicator: whichever tab is focused pops
   up as the ink circle; the rest render flat. Because the circle only ever
   marks the already-active tab, taps on it are a no-op, so its slight overhang
   above the bar's touch bounds (Android drops touches outside a parent's
   layout box) can't cost a navigation — every navigable target is a flat,
   fully-in-bounds cell. */
export const TabButton = React.forwardRef<RNView, TabButtonProps>(function TabButton(
  { isFocused, iconOn, iconOff, label, badge = 0, ...props },
  ref
) {
  if (!isFocused) {
    return (
      <Pressable
        ref={ref}
        {...props}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: TAB_BAR_HEIGHT }}
      >
        <View>
          <Ionicons name={iconOff} size={22} color="rgba(255,255,255,0.45)" />
          <IconBadge count={badge} ringColor={color.ink} />
        </View>
        <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable ref={ref} {...props} style={{ flex: 1, alignItems: 'center', height: TAB_BAR_HEIGHT }}>
      <Animated.View
        entering={CIRCLE_RISE}
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: TAB_BAR_HEIGHT - TAB_BAR_FAB_SIZE / 2 - 4,
          width: TAB_BAR_FAB_SIZE,
          height: TAB_BAR_FAB_SIZE,
          borderRadius: TAB_BAR_FAB_SIZE / 2,
          backgroundColor: color.ink,
          borderWidth: 4,
          borderColor: color.bg,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.card,
        }}
      >
        <View>
          <Ionicons name={iconOn} size={22} color={color.onInk} />
          <IconBadge count={badge} ringColor={color.bg} />
        </View>
      </Animated.View>
      <Text style={{ position: 'absolute', bottom: 6, fontSize: 10, fontWeight: '700', color: color.accent }}>
        {label}
      </Text>
    </Pressable>
  );
});

/* Cart is a plain tab like the others now — it just carries the live item-count
   badge in both states. */
export const CartTabButton = React.forwardRef<RNView, TabTriggerSlotProps>(function CartTabButton(
  props,
  ref
) {
  const itemCount = useCartStore((s) => s.itemCount());
  return <TabButton ref={ref} {...props} iconOn="bag" iconOff="bag-outline" label="Cart" badge={itemCount} />;
});
