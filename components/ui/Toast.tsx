import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, palette, radius, shadow } from '@/theme/tokens';
import { TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_GAP } from '@/components/navigation/TabBar';

/**
 * App-wide toast. Call showToast() from anywhere; <ToastHost /> lives once at
 * the root. A newer toast replaces the current one instead of stacking.
 * Sits just above the floating tab bar, like the add-to-cart confirmations in
 * 7-Eleven / Chopt / Faire, and always offers the natural next step.
 */

export type ToastOptions = {
  title: string;
  /** Secondary line — item name, chosen size/colour, etc. */
  detail?: string;
  imageUrl?: string | null;
  /** Defaults to a green check when there is no image. */
  tone?: 'success' | 'info';
  action?: { label: string; href: string };
};

type Listener = (t: ToastOptions) => void;
let listener: Listener | null = null;

export function showToast(options: ToastOptions) {
  listener?.(options);
}

const DURATION_MS = 3200;

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    listener = (t) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...t, key: Date.now() });
      AccessibilityInfo.announceForAccessibility(t.detail ? `${t.title}. ${t.detail}` : t.title);
      timer.current = setTimeout(dismiss, DURATION_MS);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss]);

  if (!toast) return null;

  return (
    <Animated.View
      key={toast.key}
      entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(160).reduceMotion(ReduceMotion.System)}
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + 12,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        paddingRight: 14,
        backgroundColor: color.ink,
        borderRadius: radius.lg,
        ...shadow.card,
      }}
    >
      {toast.imageUrl ? (
        <Image source={{ uri: toast.imageUrl }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: color.surfaceSunken }} contentFit="cover" />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: toast.tone === 'info' ? color.accent : color.success, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={toast.tone === 'info' ? 'information' : 'checkmark'} size={22} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
          {toast.title}
        </Text>
        {!!toast.detail && (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
            {toast.detail}
          </Text>
        )}
      </View>
      {toast.action && (
        <TouchableOpacity
          onPress={() => {
            dismiss();
            router.push(toast.action!.href as any);
          }}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={{ color: palette.primary[300], fontSize: 14, fontWeight: '800' }}>{toast.action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
