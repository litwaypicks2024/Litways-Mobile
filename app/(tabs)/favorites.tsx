import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@/components/ui/List';
import { color, gutter, radius, shadow } from '@/theme/tokens';
import { useWishlistStore } from '@/store/wishlist';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { ProductCard } from '@/components/shop/ProductCard';
import { ProductRail } from '@/components/shop/ProductRail';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeartIllustration } from '@/components/illustrations';
import { useCategoryRail, usePickedForYou } from '@/lib/personalization';
import type { Product } from '@/types';
import { Text } from '@/components/ui/Text';

/**
 * Saved items. Signed-out shoppers can save too (the list lives on-device and
 * syncs once they sign in), which is why this is its own tab rather than a
 * section of the account screen.
 *
 * Saved items are grouped by category when known, and the screen closes with
 * "More like your favorites" from the category they've saved most from — an
 * empty list shows "Picked for you" instead so the tab is never a dead end.
 */
export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clearance = useTabBarClearance();
  const items = useWishlistStore((s) => s.items);
  const [category, setCategory] = useState<string | null>(null);

  // Saved-from categories, most-saved first.
  const categories = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const i of items) {
      if (!i.categorySlug) continue;
      const c = counts.get(i.categorySlug);
      counts.set(i.categorySlug, { name: i.categoryName ?? i.categorySlug, n: (c?.n ?? 0) + 1 });
    }
    return [...counts.entries()].map(([slug, v]) => ({ slug, ...v })).sort((a, b) => b.n - a.n);
  }, [items]);

  // If the active category's last item was just removed, fall back to All.
  const activeCategory = category && categories.some((c) => c.slug === category) ? category : null;

  const products = useMemo(
    () =>
      items
        .filter((i) => !activeCategory || i.categorySlug === activeCategory)
        .map(
          (item) =>
            ({
              id: item.productId,
              slug: item.slug,
              name: item.name,
              brand: item.brand,
              price: item.price,
              sale_price: item.salePrice ?? null,
              stock: item.stock,
              image_urls: [item.imageUrl],
              rating: null,
              review_count: null,
              category_slug: item.categorySlug ?? null,
              category_name: item.categoryName ?? null,
            }) as Product
        ),
    [items, activeCategory]
  );

  const topSaved = categories[0];
  const more = useCategoryRail(topSaved?.slug);
  const picked = usePickedForYou();

  const header = (
    <View style={{ backgroundColor: color.surface, paddingTop: insets.top + 12, paddingBottom: 12, ...shadow.header }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: gutter }}>
        <Text variant="display">Favorites</Text>
        {items.length > 0 && <Text variant="bodyStrong" tone="muted">{items.length}</Text>}
      </View>
      {categories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 6 }}>
          <Chip label="All" active={!activeCategory} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c.slug} label={`${c.name} · ${c.n}`} active={activeCategory === c.slug} onPress={() => setCategory(c.slug)} />
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (!items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <StatusBar barStyle="dark-content" />
        {header}
        <ScrollView contentContainerStyle={{ paddingBottom: clearance }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 32, paddingTop: 40, alignItems: 'center' }}>
            <HeartIllustration />
            <Text variant="title" style={{ textAlign: 'center', marginTop: 16, marginBottom: 6 }}>
              Nothing saved yet
            </Text>
            <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
              Tap the heart on anything you like and it'll wait for you here.
            </Text>
          </View>
          <ProductRail
            title={picked.personalized ? 'Picked for you' : 'Popular right now'}
            subtitle={picked.personalized ? 'Based on what you\'ve been browsing' : undefined}
            products={picked.products}
            loading={picked.isLoading}
            actionLabel="Browse"
            onAction={() => router.push('/(tabs)/shop')}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" />
      {header}
      <FlashList
        data={products}
        numColumns={2}
        estimatedItemSize={260}
        keyExtractor={(i) => i.id ?? ''}
        contentContainerStyle={{ padding: 10, paddingBottom: clearance }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, margin: 5 }}>
            <ProductCard product={item} />
          </View>
        )}
        ListFooterComponent={
          topSaved ? (
            <View style={{ marginHorizontal: -10 }}>
              <ProductRail
                title={`More ${topSaved.name}`}
                subtitle="Because you saved from here"
                products={more.products}
                loading={more.isLoading}
                actionLabel="See all"
                onAction={() => router.push(`/category/${topSaved.slug}`)}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.full,
        backgroundColor: active ? color.accentFill : color.surface,
        borderWidth: 1,
        borderColor: active ? color.accentFill : color.fieldBorder,
      }}
    >
      <Text variant="metaStrong" style={{ color: active ? color.onAccent : color.inkBody }}>{label}</Text>
    </TouchableOpacity>
  );
}
