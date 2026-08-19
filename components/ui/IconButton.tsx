import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, shadow } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  variant?: 'light' | 'dark';
  /** Overrides the variant's default icon color (e.g. a filled wishlist heart). */
  iconColor?: string;
  badge?: number;
  style?: ViewStyle;
  /** When true, the button no-ops on press and dims its icon — a real disabled state, not just visual. */
  disabled?: boolean;
}

export function IconButton({ icon, onPress, size = 42, iconSize = 19, variant = 'light', iconColor, badge, style, disabled }: Props) {
  const isLight = variant === 'light';
  return (
    <PressableScale
      haptic={!disabled}
      scale={0.92}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isLight ? color.surface : 'rgba(20,20,20,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        isLight ? shadow.card : undefined,
        disabled ? { opacity: 0.4 } : undefined,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor ?? (isLight ? color.ink : color.onInk)} />
      {typeof badge === 'number' && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: color.accent,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
            borderWidth: 1.5,
            borderColor: color.bg,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </PressableScale>
  );
}
