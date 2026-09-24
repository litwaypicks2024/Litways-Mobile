import React from 'react';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@/theme/tokens';
import { TabButton, CartTabButton, TAB_BAR_HEIGHT } from '@/components/navigation/TabBar';

/**
 * Fixed bottom bar: Home · Shop · Favorites · You · Cart. It's a normal
 * child of the layout (not absolutely positioned), so screens end above it.
 * Cart sits last, where shoppers look for it.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={{
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: color.surface,
          borderTopWidth: 1,
          borderTopColor: color.border,
        }}
      >
        <TabTrigger name="index" href="/" asChild>
          <TabButton iconOn="home" iconOff="home-outline" label="Home" />
        </TabTrigger>
        <TabTrigger name="shop" href="/shop" asChild>
          <TabButton iconOn="search" iconOff="search-outline" label="Shop" />
        </TabTrigger>
        <TabTrigger name="favorites" href="/favorites" asChild>
          <TabButton iconOn="heart" iconOff="heart-outline" label="Favorites" />
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <TabButton iconOn="person" iconOff="person-outline" label="You" />
        </TabTrigger>
        <TabTrigger name="cart" href="/cart" asChild>
          <CartTabButton />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
