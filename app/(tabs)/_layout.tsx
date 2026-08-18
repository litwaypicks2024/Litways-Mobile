import React from 'react';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, shadow } from '@/theme/tokens';
import { TabButton, CartTabButton, TAB_BAR_HEIGHT } from '@/components/navigation/TabBar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 12,
          height: TAB_BAR_HEIGHT,
          backgroundColor: color.ink,
          borderRadius: radius.full,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 6,
          ...shadow.card,
        }}
      >
        <TabTrigger name="index" href="/" asChild>
          <TabButton iconOn="home" iconOff="home-outline" label="Home" />
        </TabTrigger>
        <TabTrigger name="shop" href="/shop" asChild>
          <TabButton iconOn="grid" iconOff="grid-outline" label="Shop" />
        </TabTrigger>
        <TabTrigger name="cart" href="/cart" asChild>
          <CartTabButton />
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <TabButton iconOn="person" iconOff="person-outline" label="Account" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
