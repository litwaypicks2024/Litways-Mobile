import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { BrandLoader } from '@/components/motion/BrandLoader';
import { Text } from '@/components/ui/Text';
import { color, radius, spacing } from '@/theme/tokens';

type Phase = 'processing' | 'polling';

interface Props {
  phase: Phase | null;
  phone: string;
}

const STEPS = ['Order created', 'Approve on your phone', 'Payment confirmed'] as const;

/**
 * Full-screen wait state while a MoMo payment is in flight. Unlike a bare
 * spinner it says where the shopper is (3 steps) and what to do — the
 * approval happens in a USSD prompt outside the app, so "look at your phone"
 * is the instruction that matters.
 */
export function PaymentProgress({ phase, phone }: Props) {
  if (!phase) return null;
  // 0 = creating the order, 1 = waiting for approval.
  const active = phase === 'processing' ? 0 : 1;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', zIndex: 500, elevation: 500, padding: spacing['2xl'] }]}
      entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(220).reduceMotion(ReduceMotion.System)}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      <BrandLoader size={76} />
      <Text variant="title" style={{ textAlign: 'center', marginTop: spacing.lg }}>
        {active === 0 ? 'Placing your order…' : 'Approve the payment'}
      </Text>
      <Text variant="bodyLg" tone="body" style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 }}>
        {active === 0
          ? 'This only takes a moment.'
          : `We sent a MoMo prompt to ${phone || 'your phone'}. Enter your PIN to finish — we'll confirm automatically.`}
      </Text>

      <View style={{ alignSelf: 'stretch', maxWidth: 340, marginTop: spacing['2xl'], backgroundColor: color.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
        {STEPS.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                {done ? (
                  <Ionicons name="checkmark-circle" size={24} color={color.success} />
                ) : current ? (
                  <ActivityIndicator size="small" color={color.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={color.inkFaint} />
                )}
              </View>
              <Text variant={current ? 'bodyStrong' : 'body'} tone={done || current ? undefined : 'muted'}>{label}</Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}
