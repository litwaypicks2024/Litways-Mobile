import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView, BlurTargetView } from 'expo-blur';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '@/theme/tokens';
import { TabButton, CartTabButton, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_GAP } from '@/components/navigation/TabBar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Android can only blur what's inside a BlurTargetView, so the screens go in one.
  const blurTarget = useRef<View>(null);
  return (
    <Tabs>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <TabSlot />
      </BlurTargetView>
      <TabList
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + TAB_BAR_BOTTOM_GAP,
          height: TAB_BAR_HEIGHT,
          borderRadius: radius.full,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(0,0,0,0.08)',
        }}
      >
        {/* Clipped in its own layer: TabList can't use overflow:hidden because
            the active-tab circle overhangs the top of the bar. */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius.full, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.55)' }]}
        >
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            tint="light"
            intensity={70}
            style={StyleSheet.absoluteFill}
          />
        </View>
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
