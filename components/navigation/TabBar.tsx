import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, type View as RNView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { color } from '@/theme/tokens';
import { useCartStore } from '@/store/cart';

/** Height of the bar's content, above the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 56;

const INACTIVE = '#767676';

/**
 * The bar sits in the layout under the screens (it doesn't float over them),
 * so scrolling content already ends above it. This is just breathing room for
 * the last row.
 */
export function useTabBarClearance(): number {
  return 16;
}

interface TabButtonProps extends TabTriggerSlotProps {
  iconOn: keyof typeof Ionicons.glyphMap;
  iconOff: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
}

const BADGE_POP_SPRING = { damping: 12, stiffness: 220, reduceMotion: ReduceMotion.System } as const;

function IconBadge({ count }: { count: number }) {
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
          top: -5,
          right: -10,
          minWidth: 17,
          height: 17,
          borderRadius: 9,
          backgroundColor: color.accent,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          borderWidth: 1.5,
          borderColor: color.surface,
        },
        animatedStyle,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

/* One cell of the bottom bar: outline icon + label at rest, filled icon in the
   accent colour when active. */
export const TabButton = React.forwardRef<RNView, TabButtonProps>(function TabButton(
  { isFocused, iconOn, iconOff, label, badge = 0, ...props },
  ref
) {
  const tint = isFocused ? color.accent : INACTIVE;
  const accessibilityLabel = badge > 0 ? `${label}, ${badge} item${badge === 1 ? '' : 's'}` : label;

  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!isFocused }}
      android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
      style={{ flex: 1, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 3 }}
    >
      <View>
        <Ionicons name={isFocused ? iconOn : iconOff} size={23} color={tint} />
        <IconBadge count={badge} />
      </View>
      <Text style={{ fontSize: 10.5, fontWeight: isFocused ? '700' : '600', color: tint }}>{label}</Text>
    </Pressable>
  );
});

/* Cart is a plain tab like the others — it just carries the live item-count badge. */
export const CartTabButton = React.forwardRef<RNView, TabTriggerSlotProps>(function CartTabButton(
  props,
  ref
) {
  const itemCount = useCartStore((s) => s.itemCount());
  return <TabButton ref={ref} {...props} iconOn="bag" iconOff="bag-outline" label="Cart" badge={itemCount} />;
});
