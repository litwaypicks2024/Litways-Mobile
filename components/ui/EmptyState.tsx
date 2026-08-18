import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, font } from '@/theme/tokens';
import { Button } from './Button';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  /** A spot illustration to show in place of the icon circle. */
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'cube-outline', illustration, title, description, actionLabel, onAction }: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 }}>
      {illustration ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>{illustration}</View>
      ) : (
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name={icon} size={36} color={color.accent} />
        </View>
      )}
      <Text style={{ fontSize: 19, fontFamily: font.display, color: color.ink, textAlign: 'center', marginBottom: 8 }}>{title}</Text>
      {description && (
        <Text style={{ fontSize: 14, color: color.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>{description}</Text>
      )}
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} size="md" />}
    </View>
  );
}
