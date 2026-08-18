import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

export function clampQuantity(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(current + delta, max));
}

interface Props {
  quantity: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
}

export function QuantityStepper({ quantity, max, onDecrement, onIncrement }: Props) {
  const atMax = quantity >= max;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color.surfaceSunken,
        borderRadius: radius.full,
        overflow: 'hidden',
      }}
    >
      <PressableScale haptic onPress={onDecrement} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons
          name={quantity === 1 ? 'trash-outline' : 'remove'}
          size={15}
          color={quantity === 1 ? color.danger : color.ink}
        />
      </PressableScale>
      <Text style={{ fontSize: 13, fontWeight: '800', color: color.ink, width: 28, textAlign: 'center' }}>
        {quantity}
      </Text>
      <PressableScale
        haptic
        onPress={onIncrement}
        disabled={atMax}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: atMax ? color.border : color.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="add" size={15} color={atMax ? color.inkFaint : '#fff'} />
      </PressableScale>
    </View>
  );
}
