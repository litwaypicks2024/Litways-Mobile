import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, gutter, shadow, spacing } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';

interface Props {
  title: string;
  onBack: () => void;
  /** Optional trailing control (an icon button); the title stays centred either way. */
  right?: React.ReactNode;
}

/** Back button + centred title on the white header surface, for pushed screens. */
export function ScreenHeader({ title, onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: color.surface,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        paddingHorizontal: gutter,
        flexDirection: 'row',
        alignItems: 'center',
        ...shadow.header,
      }}
    >
      <IconButton icon="arrow-back" onPress={onBack} accessibilityLabel="Go back" />
      <Text variant="heading" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: spacing.md }}>
        {title}
      </Text>
      <View style={{ width: 42, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
