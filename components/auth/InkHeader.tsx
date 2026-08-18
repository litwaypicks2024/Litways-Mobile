import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { MotifOverlay } from '@/components/brand/Motif';

interface Props {
  /** Top-left action — 'close' on modally-presented screens, 'arrow-back' on pushed ones. */
  icon: keyof typeof Ionicons.glyphMap;
  onIconPress: () => void;
  title: string;
  subtitle?: string;
}

/**
 * The auth screens' shared ink-black statement panel: wordmark, oversized white
 * headline, muted subline. Same material language as the floating tab bar and
 * dark hero CTAs.
 */
export function InkHeader({ icon, onIconPress, title, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: color.ink,
        paddingTop: insets.top + 12,
        paddingHorizontal: 24,
        paddingBottom: 32,
        borderBottomLeftRadius: radius['2xl'],
        borderBottomRightRadius: radius['2xl'],
        overflow: 'hidden',
      }}
    >
      <MotifOverlay />
      <StatusBar barStyle="light-content" backgroundColor={color.ink} />
      <IconButton
        icon={icon}
        onPress={onIconPress}
        variant="dark"
        style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
      />
      <View style={{ marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text style={{ color: color.onInk, fontSize: 13, fontWeight: '800', letterSpacing: 2 }}>LITWAYS</Text>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color.accent }} />
      </View>
      <Text
        style={{
          color: color.onInk,
          fontSize: 34,
          fontFamily: font.displayHeavy,
          lineHeight: 38,
          letterSpacing: -0.5,
          marginTop: 10,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, marginTop: 8 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
