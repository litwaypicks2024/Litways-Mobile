import React from 'react';
import { ActivityIndicator, Text, View, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, radius, shadow } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

interface Props extends PressableProps {
  title: string;
  variant?: 'primary' | 'dark' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const SIZES = {
  sm: { height: 40, paddingHorizontal: 16, fontSize: 13 },
  md: { height: 50, paddingHorizontal: 20, fontSize: 15 },
  lg: { height: 56, paddingHorizontal: 24, fontSize: 16 },
} as const;

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  const dims = SIZES[size];

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'dark' ? color.onAccent : color.accent} />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text
            numberOfLines={1}
            style={{
              fontSize: dims.fontSize,
              fontWeight: '700',
              color:
                variant === 'primary' || variant === 'dark'
                  ? color.onAccent
                  : variant === 'outline'
                  ? color.ink
                  : color.accent,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const shared = {
    height: dims.height,
    paddingHorizontal: dims.paddingHorizontal,
    borderRadius: radius.full,
    width: fullWidth ? ('100%' as const) : undefined,
    opacity: isDisabled ? 0.5 : 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (variant === 'primary') {
    return (
      <PressableScale haptic scale={0.97} disabled={isDisabled} style={[{ borderRadius: radius.full, ...shadow.accentGlow }, style] as any} {...rest}>
        <LinearGradient
          colors={color.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shared}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  const bg = variant === 'dark' ? color.ink : variant === 'outline' ? color.surface : 'transparent';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: color.border } : {};

  return (
    <PressableScale
      haptic
      scale={0.97}
      disabled={isDisabled}
      style={[{ ...shared, backgroundColor: bg, ...border }, style] as any}
      {...rest}
    >
      {content}
    </PressableScale>
  );
}
