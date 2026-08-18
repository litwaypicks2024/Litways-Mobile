import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { color, radius, shadow, spacing } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export function Card({ children, style, padded = true }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderRadius: radius['2xl'],
          padding: padded ? spacing.lg : 0,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
