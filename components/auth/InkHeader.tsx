import React from 'react';
import { View, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { MotifOverlay } from '@/components/brand/Motif';
import { LogoMark } from '@/components/brand/LogoMark';
import { Text } from '@/components/ui/Text';

interface Props {
  /** Top-left action — 'close' on modally-presented screens, 'arrow-back' on pushed ones. */
  icon: keyof typeof Ionicons.glyphMap;
  onIconPress: () => void;
  /** Screen-reader label for the top-left action, e.g. "Go back" or "Close". */
  iconAccessibilityLabel: string;
  title: string;
  subtitle?: string;
}

/**
 * The auth screens' shared ink-black statement panel: wordmark, oversized white
 * headline, muted subline. Same material language as the floating tab bar and
 * dark hero CTAs.
 */
export function InkHeader({ icon, onIconPress, iconAccessibilityLabel, title, subtitle }: Props) {
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
        accessibilityLabel={iconAccessibilityLabel}
        style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
      />
      <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LogoMark size={30} variant="onInk" />
        <Text variant="small" style={{ color: color.onInk }}>
          LITWAY <Text tone="accent">PICKS</Text>
        </Text>
      </View>
      <Text variant="hero"
        style={{ color: color.onInk, marginTop: 10 }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
