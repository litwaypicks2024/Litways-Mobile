import React from 'react';
import { View, Text } from 'react-native';
import { color, radius } from '@/theme/tokens';

type Variant = 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary';

const VARIANT_STYLES: Record<Variant, { bg: string; text: string }> = {
  success: { bg: '#dcfce7', text: '#15803d' },
  error: { bg: '#fee2e2', text: '#b91c1c' },
  warning: { bg: '#fef3c7', text: '#b45309' },
  info: { bg: '#dbeafe', text: '#1d4ed8' },
  primary: { bg: color.accentSoft, text: color.accentPressed },
  secondary: { bg: color.surfaceSunken, text: color.inkMuted },
};

const STATUS_MAP: Record<string, Variant> = {
  SUCCESSFUL: 'success',
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  REFUNDED: 'info',
  DISPUTED: 'error',
};

interface Props {
  label: string;
  variant?: Variant;
  status?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, variant, status, size = 'sm' }: Props) {
  const v: Variant = variant ?? (status ? STATUS_MAP[status] ?? 'secondary' : 'secondary');
  const s = VARIANT_STYLES[v];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderRadius: radius.full,
        paddingHorizontal: size === 'sm' ? 8 : 12,
        paddingVertical: size === 'sm' ? 3 : 5,
      }}
    >
      <Text style={{ fontWeight: '600', color: s.text, fontSize: size === 'sm' ? 11 : 13 }}>{label}</Text>
    </View>
  );
}
