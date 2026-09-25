import React, { useState } from 'react';
import { TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { LottieScene } from '@/components/onboarding/LottieScene';
import { color, radius, spacing } from '@/theme/tokens';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'checkmark-circle-outline', text: 'Your payment is confirmed' },
  { icon: 'bicycle-outline', text: 'Your order is on its way' },
  { icon: 'heart-outline', text: 'A saved item is back in stock' },
];

interface Props {
  onBack: () => void;
  /** "Turn on notifications": asks the system, then continues whatever the answer. */
  onAllow: () => Promise<void>;
  onLater: () => void;
}

/**
 * Asks in our own words before the system does. The system prompt can only be
 * shown once, so it waits until the shopper has seen what they'd get (payment
 * confirmation matters most on a MoMo checkout) and chosen to go ahead.
 */
export function NotificationPrimer({ onBack, onAllow, onLater }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scene = Math.min(width * 0.8, height * 0.34);
  const [busy, setBusy] = useState(false);

  async function allow() {
    setBusy(true);
    try {
      await onAllow();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.surface, paddingTop: insets.top }}>
      <View style={{ height: 48, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <LottieScene
          source={require('@/assets/lottie/onboarding-notify.json')}
          active
          size={scene}
          label="A phone lock screen with three notifications: payment confirmed, order on its way, item back in stock"
        />
        <Text variant="display" style={{ textAlign: 'center', marginTop: spacing.sm }}>{'Know the moment\nyour order arrives'}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md, backgroundColor: color.surfaceMuted, borderRadius: radius.lg, padding: spacing.lg }}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name={b.icon} size={22} color={color.accent} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>{b.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }}>
        <Button title="Turn on notifications" onPress={allow} loading={busy} fullWidth size="lg" icon={!busy ? <Ionicons name="notifications" size={18} color={color.onAccent} /> : undefined} />
        <TouchableOpacity onPress={onLater} disabled={busy} hitSlop={10} accessibilityRole="button" style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}>
          <Text variant="button" tone="muted">Not now</Text>
        </TouchableOpacity>
        <Text variant="meta" tone="muted" style={{ textAlign: 'center' }}>You can change this any time in Settings.</Text>
      </View>
    </View>
  );
}
