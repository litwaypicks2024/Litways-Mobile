import React from 'react';
import { View, Text, Pressable, type View as RNView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabTriggerSlotProps } from 'expo-router/ui';
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
}

export const TabButton = React.forwardRef<RNView, TabButtonProps>(function TabButton(
  { isFocused, iconOn, iconOff, label, ...props },
  ref
) {
  return (
    <Pressable
      ref={ref}
      {...props}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: TAB_BAR_HEIGHT }}
    >
      <Ionicons name={isFocused ? iconOn : iconOff} size={22} color={isFocused ? color.onInk : 'rgba(255,255,255,0.45)'} />
      <Text style={{ fontSize: 10, fontWeight: '600', color: isFocused ? color.onInk : 'rgba(255,255,255,0.45)' }}>
        {label}
      </Text>
    </Pressable>
  );
});

export const CartTabButton = React.forwardRef<RNView, TabTriggerSlotProps>(function CartTabButton(
  { isFocused, ...props },
  ref
) {
  const itemCount = useCartStore((s) => s.itemCount());
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        ref={ref}
        {...props}
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
        <Ionicons name={isFocused ? 'bag' : 'bag-outline'} size={22} color={color.onInk} />
        {itemCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: color.accent,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
              borderWidth: 1.5,
              borderColor: color.bg,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
              {itemCount > 99 ? '99+' : itemCount}
            </Text>
          </View>
        )}
      </Pressable>
      <Text style={{ position: 'absolute', bottom: 6, fontSize: 10, fontWeight: '700', color: color.accent }}>
        Cart
      </Text>
    </View>
  );
});
