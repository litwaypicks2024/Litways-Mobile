import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import Animated, { ReduceMotion, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { Text } from '@/components/ui/Text';
import { color, gutter, radius, spacing } from '@/theme/tokens';
import type { Category } from '@/types';

const COLUMNS = 3;
const GAP = spacing.md;
const MAX_TILES = 12;

interface Props {
  onBack: () => void;
  onSkip: () => void;
  onContinue: (picked: Category[]) => void;
}

/**
 * "What are you into?": category tiles the shopper taps to pick. Their picks
 * seed the on-device taste profile, so the very first Home already leans their
 * way instead of starting generic. Never blocks: Skip is always there, and a
 * catalogue that fails to load moves on by itself.
 */
export function InterestPicker({ onBack, onSkip, onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - gutter * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const [picked, setPicked] = useState<string[]>([]);

  // Same key and fetch as the shop and home screens, so it is usually already cached.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('item_count', { ascending: false });
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60_000,
  });
  const categories = (data ?? []).slice(0, MAX_TILES);

  // Nothing to pick from (offline, or an empty catalogue): don't strand a new shopper on this step.
  React.useEffect(() => {
    if (isError || (!isLoading && categories.length === 0)) onSkip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, isLoading, categories.length]);

  function toggle(slug: string) {
    void Haptics.selectionAsync();
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  }

  const chosen = categories.filter((c) => picked.includes(c.slug));

  return (
    <View style={{ flex: 1, backgroundColor: color.surface, paddingTop: insets.top }}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
        <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip picking interests">
          <Text variant="button" tone="muted">Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.xl }}>
        <Text variant="display">What are you into?</Text>
        <Text variant="bodyLg" tone="body" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Pick a few and we'll show those first. You can change this any time.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: spacing.lg }}>
          {isLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={{ width: tile, gap: 6 }}>
                  <SkeletonBlock width={tile} height={tile} borderRadius={radius.lg} />
                  <SkeletonBlock width={tile - 24} height={10} borderRadius={5} />
                </View>
              ))
            : categories.map((cat) => {
                const on = picked.includes(cat.slug);
                return (
                  <PressableScale
                    key={cat.id}
                    onPress={() => toggle(cat.slug)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={cat.name}
                    style={{ width: tile }}
                  >
                    <View
                      style={{
                        width: tile, height: tile, borderRadius: radius.lg, overflow: 'hidden',
                        backgroundColor: color.accentSoft,
                        borderWidth: on ? 3 : 1, borderColor: on ? color.accentFill : color.border,
                      }}
                    >
                      {cat.image ? (
                        <Image source={{ uri: cat.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="pricetags-outline" size={28} color={color.accent} />
                        </View>
                      )}
                      {on && (
                        <Animated.View
                          entering={ZoomIn.duration(160).reduceMotion(ReduceMotion.System)}
                          exiting={ZoomOut.duration(120).reduceMotion(ReduceMotion.System)}
                          style={{
                            position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
                            backgroundColor: color.accentFill, alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: color.surface,
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </Animated.View>
                      )}
                    </View>
                    <Text variant={on ? 'small' : 'caption'} numberOfLines={1} style={{ textAlign: 'center', marginTop: 6 }}>{cat.name}</Text>
                  </PressableScale>
                );
              })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl), borderTopWidth: 1, borderTopColor: color.border, backgroundColor: color.surface }}>
        <Button
          title={chosen.length ? `Continue · ${chosen.length} picked` : 'Pick at least one'}
          onPress={() => onContinue(chosen)}
          disabled={chosen.length === 0}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}
