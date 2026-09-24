import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { color, gutter, radius, spacing } from '@/theme/tokens';
import type { Category } from '@/types';

/**
 * Category navigation for Home: a 4-up grid of image tiles directly under the
 * search bar. Categories are how shoppers find things here, so they get the
 * most prominent spot instead of a scrolling strip. Categories the shopper
 * leans toward lead the grid and carry an accent ring; the last cell opens
 * the full catalog.
 */

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  clothing: 'shirt-outline',
  shoes: 'footsteps-outline',
  electronics: 'phone-portrait-outline',
  beauty: 'sparkles-outline',
  home: 'home-outline',
  sports: 'football-outline',
  bags: 'bag-handle-outline',
  accessories: 'watch-outline',
  food: 'fast-food-outline',
  kids: 'happy-outline',
};

function iconFor(slug: string, name: string): keyof typeof Ionicons.glyphMap {
  const key = Object.keys(ICONS).find((k) => slug?.includes(k) || name?.toLowerCase().includes(k));
  return key ? ICONS[key] : 'pricetags-outline';
}

const COLUMNS = 4;
const GAP = spacing.md;
const MAX_TILES = COLUMNS * 2 - 1; // one cell is reserved for "All"

interface Props {
  categories: Category[] | undefined;
  loading: boolean;
  /** Slugs the shopper leans toward, highlighted with a ring. */
  forYou: Set<string>;
  onOpenCategory: (slug: string) => void;
  onOpenAll: () => void;
}

export function CategoryGrid({ categories, loading, forYou, onOpenCategory, onOpenAll }: Props) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - gutter * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const cells: ({ kind: 'cat'; cat: Category } | { kind: 'all' })[] = (categories ?? [])
    .slice(0, MAX_TILES)
    .map((cat) => ({ kind: 'cat' as const, cat }));
  cells.push({ kind: 'all' });

  return (
    <View style={{ paddingHorizontal: gutter, flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: spacing.lg }}>
      {loading
        ? Array.from({ length: COLUMNS * 2 }).map((_, i) => (
            <View key={i} style={{ width: tile, gap: 6 }}>
              <SkeletonBlock width={tile} height={tile} borderRadius={radius.lg} />
              <SkeletonBlock width={tile - 16} height={10} borderRadius={5} />
            </View>
          ))
        : cells.map((cell) => {
            if (cell.kind === 'all') {
              return (
                <PressableScale key="all" haptic onPress={onOpenAll} accessibilityRole="button" accessibilityLabel="Browse all categories" style={{ width: tile }}>
                  <View
                    style={{
                      width: tile, height: tile, borderRadius: radius.lg,
                      backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="grid" size={26} color={color.onInk} />
                  </View>
                  <Text variant="metaStrong" style={{ textAlign: 'center', marginTop: 6 }}>All</Text>
                </PressableScale>
              );
            }
            const { cat } = cell;
            const highlighted = forYou.has(cat.slug);
            return (
              <PressableScale
                key={cat.id}
                haptic
                onPress={() => onOpenCategory(cat.slug)}
                accessibilityRole="button"
                accessibilityLabel={highlighted ? `${cat.name}, picked for you` : cat.name}
                style={{ width: tile }}
              >
                <View
                  style={{
                    width: tile, height: tile, borderRadius: radius.lg, overflow: 'hidden',
                    backgroundColor: color.surface,
                    borderWidth: highlighted ? 2 : 1,
                    borderColor: highlighted ? color.accent : color.border,
                  }}
                >
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft }}>
                      <Ionicons name={iconFor(cat.slug ?? '', cat.name ?? '')} size={28} color={color.accent} />
                    </View>
                  )}
                  {highlighted && (
                    <View
                      style={{
                        position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
                        backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="sparkles" size={11} color={color.onAccent} />
                    </View>
                  )}
                </View>
                <Text variant="metaStrong" numberOfLines={2} style={{ textAlign: 'center', marginTop: 6 }}>
                  {cat.name}
                </Text>
              </PressableScale>
            );
          })}
    </View>
  );
}
