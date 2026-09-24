import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { LIBERIAN_COUNTIES } from '@/constants/counties';
import { color, radius, shadow } from '@/theme/tokens';

interface Props {
  value: string;
  error?: string;
  onChange: (county: string) => void;
}

/** County dropdown styled like the other fields: visible border, accent when open, red on error. */
export function CountyField({ value, error, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 4 }}>
      <Text variant="small" tone="muted" style={{ marginBottom: 6 }}>County *</Text>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={value ? `County, ${value}` : 'Select county'}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: color.surface, borderRadius: radius.full, borderWidth: 1.5,
          borderColor: error ? color.danger : open ? color.accent : color.fieldBorder,
          paddingHorizontal: 16, height: 50,
        }}
      >
        <Ionicons name="map-outline" size={18} color={open ? color.accent : color.inkFaint} />
        <Text variant="bodyLg" style={{ flex: 1, color: value ? color.ink : color.inkFaint }}>{value || 'Select county'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={color.inkFaint} />
      </TouchableOpacity>
      {open && (
        <View style={{ backgroundColor: color.surface, borderRadius: 12, borderWidth: 1, borderColor: color.border, marginTop: 4, overflow: 'hidden', ...shadow.card }}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {LIBERIAN_COUNTIES.map((county) => {
              const selected = value === county;
              return (
                <TouchableOpacity
                  key={county}
                  onPress={() => { onChange(county); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.border, backgroundColor: selected ? color.accentSoft : color.surface }}
                >
                  <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'accent' : undefined}>{county}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      {!!error && <Text variant="meta" tone="danger" style={{ marginTop: 4, marginLeft: 4 }}>{error}</Text>}
    </View>
  );
}
