import React from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { color, gutter, spacing } from '@/theme/tokens';
import { ProductCard } from '@/components/shop/ProductCard';
import { ProductCardSkeleton } from '@/components/ui/SkeletonLoader';
import type { Product } from '@/types';

interface Props {
  title: string;
  subtitle?: string;
  products: Product[];
  loading?: boolean;
  /** Text-only action on the right of the header ("See all", "Clear"). */
  actionLabel?: string;
  onAction?: () => void;
  /** Tighter header for use inside the Shop tab's discovery view. */
  compact?: boolean;
}

/** Titled horizontal shelf of product cards — the one shelf used across Home, Shop and Favorites. */
export function ProductRail({ title, subtitle, products, loading, actionLabel, onAction, compact }: Props) {
  if (!loading && products.length === 0) return null;
  return (
    <View style={{ marginTop: compact ? spacing.xl : spacing['2xl'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: gutter, marginBottom: spacing.md }}>
        {/* minWidth 0 lets the text side shrink and ellipsise; the action below never shrinks */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant={compact ? 'heading' : 'title'} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text variant="meta" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>{subtitle}</Text>}
        </View>
        {!!actionLabel && !!onAction && (
          <TouchableOpacity onPress={onAction} hitSlop={8} accessibilityRole="button" style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text variant="small" tone="accent">{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color={color.accent} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', paddingHorizontal: gutter, gap: spacing.md }}>
          {[0, 1, 2].map((i) => <ProductCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={products}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}
          keyExtractor={(item) => item.id ?? item.slug ?? ''}
          renderItem={({ item }) => <ProductCard product={item} width={160} variant="horizontal" />}
        />
      )}
    </View>
  );
}
