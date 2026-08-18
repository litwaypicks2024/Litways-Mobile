import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { color, radius } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import type { ProductFilters } from '@/types';

interface Props {
  visible: boolean;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  onClose: () => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11', '12'];

/* Price fields match the pill treatment used by `Input` elsewhere: filled,
   borderless, fully rounded — not the old 2px-bordered rectangle. */
const priceFieldStyle = {
  backgroundColor: color.surfaceSunken,
  borderRadius: radius.full,
  paddingHorizontal: 16,
} as const;

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<ProductFilters>(filters);
  const translateY = useSharedValue(600);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setLocal(filters);
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withSpring(600, { damping: 20, stiffness: 200 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_distinct_brands');
      return (data ?? []).map((d: { brand: string }) => d.brand).filter(Boolean);
    },
    staleTime: 5 * 60_000,
  });

  function toggleBrand(brand: string) {
    setLocal((s) => {
      const current = s.brands ?? [];
      return {
        ...s,
        brands: current.includes(brand)
          ? current.filter((b) => b !== brand)
          : [...current, brand],
      };
    });
  }

  function toggleSize(size: string) {
    setLocal((s) => {
      const current = s.sizes ?? [];
      return {
        ...s,
        sizes: current.includes(size)
          ? current.filter((sz) => sz !== size)
          : [...current, size],
      };
    });
  }

  function handleReset() {
    setLocal({});
  }

  function handleApply() {
    onApply(local);
    onClose();
  }

  const activeCount = [
    local.brands?.length,
    local.sizes?.length,
    local.minPrice != null || local.maxPrice != null ? 1 : 0,
  ].reduce((sum: number, v) => sum + (v ?? 0), 0);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[{ position: 'absolute', inset: 0 }, backdropStyle]}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
            paddingBottom: Platform.OS === 'ios' ? 34 : 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 20,
          },
          sheetStyle,
        ]}
      >
        {/* Handle */}
        <View className="items-center pt-3 pb-2">
          <View className="w-10 h-1 bg-gray-200 rounded-full" />
        </View>

        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
          <Text className="text-lg font-bold" style={{ color: color.ink }}>
            Filters {activeCount > 0 && <Text className="text-primary-600">({activeCount})</Text>}
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={handleReset}>
              <Text className="text-sm font-medium" style={{ color: color.inkMuted }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={color.inkMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 24 }}>
          {/* Price Range */}
          <View>
            <Text className="text-sm font-bold mb-3" style={{ color: color.ink }}>Price Range (USD)</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs mb-1" style={{ color: color.inkMuted }}>Min</Text>
                <View className="flex-row items-center h-11" style={priceFieldStyle}>
                  <Text className="mr-1" style={{ color: color.inkFaint }}>$</Text>
                  <TextInput
                    value={local.minPrice?.toString() ?? ''}
                    onChangeText={(v) => setLocal((s) => ({ ...s, minPrice: v ? Number(v) : undefined }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={color.inkFaint}
                    className="flex-1 text-sm"
                    style={{ color: color.ink }}
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-xs mb-1" style={{ color: color.inkMuted }}>Max</Text>
                <View className="flex-row items-center h-11" style={priceFieldStyle}>
                  <Text className="mr-1" style={{ color: color.inkFaint }}>$</Text>
                  <TextInput
                    value={local.maxPrice?.toString() ?? ''}
                    onChangeText={(v) => setLocal((s) => ({ ...s, maxPrice: v ? Number(v) : undefined }))}
                    keyboardType="numeric"
                    placeholder="999"
                    placeholderTextColor={color.inkFaint}
                    className="flex-1 text-sm"
                    style={{ color: color.ink }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Brands */}
          {brands && brands.length > 0 && (
            <View>
              <Text className="text-sm font-bold mb-3" style={{ color: color.ink }}>
                Brand {local.brands?.length ? <Text className="text-primary-600">({local.brands.length} selected)</Text> : ''}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {brands.map((brand: string) => {
                  const selected = local.brands?.includes(brand);
                  return (
                    <TouchableOpacity
                      key={brand}
                      onPress={() => toggleBrand(brand)}
                      className={`px-4 py-2 rounded-full border-2 ${selected ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-200'}`}
                    >
                      <Text className="text-sm font-medium" style={{ color: selected ? color.onAccent : color.ink }}>
                        {brand}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Sizes */}
          <View>
            <Text className="text-sm font-bold mb-3" style={{ color: color.ink }}>
              Size {local.sizes?.length ? <Text className="text-primary-600">({local.sizes.length} selected)</Text> : ''}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SIZES.map((size) => {
                const selected = local.sizes?.includes(size);
                return (
                  <TouchableOpacity
                    key={size}
                    onPress={() => toggleSize(size)}
                    className={`w-14 h-10 rounded-full border-2 items-center justify-center ${selected ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-200'}`}
                  >
                    <Text className="text-sm font-semibold" style={{ color: selected ? color.onAccent : color.ink }}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* spacer for button */}
          <View className="h-4" />
        </ScrollView>

        {/* Apply button */}
        <View className="px-5 pt-3 border-t border-gray-100">
          <Button title={`Apply Filters${activeCount > 0 ? ` (${activeCount})` : ''}`} onPress={handleApply} fullWidth size="lg" />
        </View>
      </Animated.View>
    </Modal>
  );
}
