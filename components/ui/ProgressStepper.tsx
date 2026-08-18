import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color } from '@/theme/tokens';

interface Step {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  steps: Step[];
  currentStep: number;
}

export function ProgressStepper({ steps, currentStep }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {steps.map((step, i) => {
        const n = i + 1;
        const done = n < currentStep;
        const active = n === currentStep;
        return (
          <React.Fragment key={step.label}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? color.accent : color.surfaceSunken,
                }}
              >
                <Ionicons
                  name={done ? 'checkmark' : step.icon}
                  size={16}
                  color={active ? color.onAccent : done ? color.ink : color.inkFaint}
                />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: active || done ? color.ink : color.inkFaint }}>
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 0,
                  borderTopWidth: 2,
                  borderStyle: 'dotted',
                  borderTopColor: n < currentStep ? color.accent : color.border,
                  marginHorizontal: 8,
                  marginBottom: 18,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
