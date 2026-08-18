import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, spacing, type as t } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { onboarding } from '@/lib/storage';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'bag-handle-outline',
    title: 'Everything you need,\nin one app',
    body: 'Clothes, phones, home goods and more — from local sellers you can trust.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Pay easily with\nMTN MoMo',
    body: 'No card needed. Order in minutes and get it delivered to your door — anywhere in Liberia.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  async function finish() {
    await onboarding.markSeen();
    router.replace('/(tabs)');
  }

  function next() {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.surface, paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />

      {/* Skip */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
        {!isLast && (
          <TouchableOpacity onPress={finish} hitSlop={10}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: color.textMuted }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Illustration */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <View style={{
          width: 220, height: 260, borderRadius: radius['2xl'],
          backgroundColor: color.accent,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={slide.icon} size={92} color={color.onAccent} />
        </View>
      </View>

      {/* Copy */}
      <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
        <Text style={{ ...t.display, textAlign: 'center' }}>
          {slide.title}
        </Text>
        <Text style={{ fontSize: 15, color: color.inkMuted, textAlign: 'center', lineHeight: 22, marginTop: spacing.md }}>
          {slide.body}
        </Text>
      </View>

      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.xl }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 22 : 7,
              height: 7,
              borderRadius: radius.full,
              backgroundColor: i === index ? color.accent : color.border,
            }}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) }}>
        <Button
          title={isLast ? 'Start shopping' : 'Next'}
          onPress={next}
          fullWidth
          size="lg"
          icon={<Ionicons name="arrow-forward" size={18} color={color.onAccent} />}
        />
      </View>
    </View>
  );
}
