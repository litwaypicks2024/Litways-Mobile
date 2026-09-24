import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { supabase } from '@/lib/supabase';
import { color, radius, spacing, gutter, shadow } from '@/theme/tokens';
import { useAuthStore } from '@/store/auth';
import { ProductCard } from '@/components/shop/ProductCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProductCardSkeleton } from '@/components/ui/SkeletonLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { discountPercent } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { MotifOverlay } from '@/components/brand/Motif';
import { LogoMark } from '@/components/brand/LogoMark';
import { Marquee } from '@/components/brand/Marquee';
import { ProductRail } from '@/components/shop/ProductRail';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { QuickLinks } from '@/components/home/QuickLinks';
import { ActiveOrderCard } from '@/components/home/ActiveOrderCard';
import { useTasteStore, rankedCategories } from '@/store/taste';
import { usePickedForYou, useCategoryRail, likeSubtitle } from '@/lib/personalization';
import type { Product, Category } from '@/types';
import { Text } from '@/components/ui/Text';

/** "Good morning" / "Good afternoon" / "Good evening" by device clock. */
function daypartGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const firstName = useAuthStore((s) => s.profile?.first_name);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarClearance = useTabBarClearance();

  /* Personalisation: learned on-device from what the shopper views, saves and searches. */
  const tasteCategories = useTasteStore((s) => s.categories);
  const recentlyViewed = useTasteStore((s) => s.recentlyViewed);
  const clearRecentlyViewed = useTasteStore((s) => s.clearRecentlyViewed);
  const picked = usePickedForYou();
  const topCategory = picked.topCategories[0];
  const moreInTop = useCategoryRail(topCategory?.slug);

  const {
    data: featured,
    isLoading: loadingFeatured,
    isError: errorFeatured,
    isFetching: fetchingFeatured,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('featured_products').select('*').limit(10);
      if (error) throw error;
      return data as Product[];
    },
  });

  const {
    data: newest,
    isLoading: loadingNewest,
    isError: errorNewest,
    isFetching: fetchingNewest,
    refetch: refetchNewest,
  } = useQuery({
    queryKey: ['newest-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products_with_categories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as Product[];
    },
  });

  const {
    data: deals,
    isLoading: loadingDeals,
    isError: errorDeals,
    isFetching: fetchingDeals,
    refetch: refetchDeals,
  } = useQuery({
    queryKey: ['deal-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products_with_categories')
        .select('*')
        .not('sale_price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as Product[];
    },
  });

  const {
    data: categories,
    isLoading: loadingCats,
    isError: errorCats,
    isFetching: fetchingCats,
    refetch: refetchCats,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('item_count', { ascending: false });
      if (error) throw error;
      return data as Category[];
    },
  });

  // Categories the shopper cares about lead the row, the rest keep their usual order.
  const orderedCategories = useMemo(() => {
    if (!categories) return categories;
    const rank = new Map(rankedCategories(tasteCategories).map((c, i) => [c.slug, i]));
    return [...categories].sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity));
  }, [categories, tasteCategories]);

  const forYouSlugs = useMemo(() => new Set(picked.topCategories.map((c) => c.slug)), [picked.topCategories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchFeatured(), refetchCats(), refetchNewest(), refetchDeals()]);
    setRefreshing(false);
  }, [refetchFeatured, refetchCats, refetchNewest, refetchDeals]);

  // Biggest genuine discount across the deal products — honest urgency, no fake timers.
  const maxDiscount = useMemo(
    () =>
      (deals ?? []).reduce((best, p) => {
        if (p.sale_price == null || p.price == null) return best;
        return Math.max(best, discountPercent(p.price, p.sale_price));
      }, 0),
    [deals]
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />

      {/* ─── Header ─── */}
      <View
        style={{
          backgroundColor: color.surface,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: gutter,
          borderBottomWidth: 1,
          borderBottomColor: color.border,
          ...shadow.header,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Mark only — the full lockup's wordmark clipped and the bag already carries the brand */}
          <LogoMark size={44} variant="onLight" />

          {/* Greeting fills the row the way Walmart / Instacart headers do; it
              shrinks and truncates on its own, so it can never clip the mark */}
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="body" numberOfLines={1}>
              {firstName ? `${daypartGreeting()}, ${firstName}` : daypartGreeting()}
            </Text>
            <Text variant="heading" numberOfLines={1} style={{ marginTop: 1 }}>
              What are you shopping for?
            </Text>
          </View>

          {/* Contact us — headset reads as "talk to a person" */}
          <IconButton icon="headset-outline" onPress={() => router.push('/contact')} accessibilityLabel="Contact us" />
        </View>

        {/* Search */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/shop')}
          activeOpacity={0.7}
          style={{
            marginTop: spacing.md,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: color.surface,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            height: 48,
            gap: spacing.sm,
            ...shadow.card,
          }}
        >
          <Ionicons name="search" size={19} color={color.inkMuted} />
          <Text variant="body" tone="muted" style={{ flex: 1 }}>Search for anything…</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />
        }
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      >
        {/* ─── Kinetic marquee — the brand's promises on a moving ink band ─── */}
        <Animated.View entering={FadeInDown.duration(300).delay(0 * 60).reduceMotion(ReduceMotion.System)}>
          <Marquee style={{ backgroundColor: color.ink, paddingVertical: 9 }}>
            {['New season drops', 'Pay with MTN MoMo', 'Delivering to all 15 counties', 'Monrovia & beyond'].map(
              (phrase) => (
                <View key={phrase} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="label"
                    style={{ color: color.onInk, textTransform: 'uppercase' }}
                  >
                    {phrase}
                  </Text>
                  {/* country-cloth lozenge as separator */}
                  <View
                    style={{
                      width: 6, height: 6, backgroundColor: color.accent,
                      transform: [{ rotate: '45deg' }], marginHorizontal: 14,
                    }}
                  />
                </View>
              )
            )}
          </Marquee>
        </Animated.View>

        {/* ─── In-flight order (signed-in shoppers only) ─── */}
        <ActiveOrderCard />

        {/* ─── Categories: the main way in, straight under search ─── */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Shop by category"
            subtitle={forYouSlugs.size > 0 ? 'Ringed ones are picked for you' : undefined}
            onSeeAll={() => router.push('/(tabs)/shop')}
          />
          {errorCats ? (
            <View style={{ paddingHorizontal: gutter }}>
              <ErrorState
                message="Couldn't load categories. Check your connection and try again."
                onRetry={() => refetchCats()}
                loading={fetchingCats}
              />
            </View>
          ) : (
            <CategoryGrid
              categories={orderedCategories}
              loading={loadingCats}
              forYou={forYouSlugs}
              onOpenCategory={(slug) => router.push(`/category/${slug}`)}
              onOpenAll={() => router.push('/(tabs)/shop')}
            />
          )}
        </View>

        {/* ─── Shortcuts ─── */}
        <View style={{ marginTop: spacing.xl }}>
          <QuickLinks
            links={[
              { key: 'deals', label: 'Deals', icon: 'pricetag-outline', onPress: () => router.push({ pathname: '/(tabs)/shop', params: { sale: '1' } }) },
              { key: 'new', label: 'New in', icon: 'time-outline', onPress: () => router.push({ pathname: '/(tabs)/shop', params: { sort: 'newest' } }) },
              { key: 'saved', label: 'Favorites', icon: 'heart-outline', onPress: () => router.push('/(tabs)/favorites') },
              { key: 'orders', label: 'My orders', icon: 'receipt-outline', onPress: () => router.push({ pathname: '/(tabs)/account', params: { tab: 'orders' } }) },
            ]}
          />
        </View>

        {/* ─── Deals ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(3 * 60).reduceMotion(ReduceMotion.System)}
        >
          {loadingDeals ? (
            <View style={{ marginTop: spacing['2xl'] }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}>
                {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </ScrollView>
            </View>
          ) : errorDeals ? (
            <View style={{ marginTop: spacing['2xl'], paddingHorizontal: gutter }}>
              <ErrorState
                message="Couldn't load deals. Check your connection and try again."
                onRetry={() => refetchDeals()}
                loading={fetchingDeals}
              />
            </View>
          ) : (deals?.length ?? 0) > 0 && (
            <View style={{ marginTop: spacing['2xl'] }}>
              {/* Bold statement — honest "up to X% off" from real discounts */}
              <PressableScale
                haptic
                onPress={() => router.push({ pathname: '/(tabs)/shop', params: { sale: '1' } })}
                style={{ marginHorizontal: gutter }}
              >
                <View style={{ backgroundColor: color.ink, borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' }}>
                  <MotifOverlay color="#ffffff" opacity={0.05} cell={28} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="pricetag" size={14} color={color.accent} />
                        <Text variant="metaStrong" style={{ color: '#fff', textTransform: 'uppercase' }}>Deals on now</Text>
                      </View>
                      <Text variant="display" style={{ color: '#fff' }}>
                        {maxDiscount > 0 ? `Up to ${maxDiscount}% off` : 'Save on selected items'}
                      </Text>
                      <Text variant="caption" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>Selected items · while stocks last</Text>
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="arrow-forward" size={20} color={color.onAccent} />
                    </View>
                  </View>
                </View>
              </PressableScale>

              <View style={{ height: spacing.lg }} />
              <FlashList
                data={deals ?? []}
                horizontal
                showsHorizontalScrollIndicator={false}
                estimatedItemSize={172}
                contentContainerStyle={{ paddingHorizontal: gutter }}
                ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
                renderItem={({ item }) => <ProductCard product={item} width={172} variant="horizontal" />}
                keyExtractor={(item) => item.id ?? ''}
              />
            </View>
          )}
        </Animated.View>

        {/* ─── Personal shelves: pick up where you left off, then more of what you like ─── */}
        <ProductRail
          title="Pick up where you left off"
          products={recentlyViewed as unknown as Product[]}
          actionLabel="Clear"
          onAction={clearRecentlyViewed}
        />
        {picked.personalized && (
          <ProductRail
            title="Picked for you"
            subtitle={likeSubtitle(picked.topCategories)}
            products={picked.products}
            loading={picked.isLoading}
            actionLabel="Browse"
            onAction={() => router.push('/(tabs)/shop')}
          />
        )}
        {topCategory && (
          <ProductRail
            title={`More ${topCategory.name}`}
            subtitle="Your most-browsed category"
            products={moreInTop.products}
            loading={moreInTop.isLoading}
            actionLabel="See all"
            onAction={() => router.push(`/category/${topCategory.slug}`)}
          />
        )}

        {/* New shoppers have no taste profile yet: organise the page by category instead */}
        {!topCategory && (orderedCategories ?? []).slice(0, 2).map((cat) => (
          <CategoryShelf key={cat.id} category={cat} onSeeAll={() => router.push(`/category/${cat.slug}`)} />
        ))}

        {/* ─── Popular right now ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(4 * 60).reduceMotion(ReduceMotion.System)}
          style={{ marginTop: spacing['2xl'] }}
        >
          <SectionHeader title="Popular right now" subtitle="What people are buying" onSeeAll={() => router.push('/(tabs)/shop')} />
          {loadingFeatured ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}>
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </ScrollView>
          ) : errorFeatured ? (
            <View style={{ paddingHorizontal: gutter }}>
              <ErrorState
                message="Couldn't load popular products. Check your connection and try again."
                onRetry={() => refetchFeatured()}
                loading={fetchingFeatured}
              />
            </View>
          ) : (
            <View style={{ paddingHorizontal: gutter - spacing.xs, flexDirection: 'row', flexWrap: 'wrap' }}>
              {featured?.slice(0, 4).map((item) => (
                <View key={item.id} style={{ width: '50%', padding: spacing.xs }}>
                  <ProductCard product={item} />
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ─── New arrivals ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(5 * 60).reduceMotion(ReduceMotion.System)}
        >
          {loadingNewest ? (
            <View style={{ marginTop: spacing['2xl'] }}>
              <SectionHeader title="New arrivals" subtitle="Fresh in this week" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}>
                {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </ScrollView>
            </View>
          ) : errorNewest ? (
            <View style={{ marginTop: spacing['2xl'], paddingHorizontal: gutter }}>
              <ErrorState
                message="Couldn't load new arrivals. Check your connection and try again."
                onRetry={() => refetchNewest()}
                loading={fetchingNewest}
              />
            </View>
          ) : (newest?.length ?? 0) > 0 && (
            <View style={{ marginTop: spacing['2xl'] }}>
              <SectionHeader title="New arrivals" subtitle="Fresh in this week" onSeeAll={() => router.push('/(tabs)/shop')} />
              <View style={{ paddingHorizontal: gutter - spacing.xs, flexDirection: 'row', flexWrap: 'wrap' }}>
                {newest?.slice(0, 4).map((item) => (
                  <View key={item.id} style={{ width: '50%', padding: spacing.xs }}>
                    <ProductCard product={item} />
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/shop')}
                activeOpacity={0.85}
                style={{
                  marginHorizontal: gutter, marginTop: spacing.md,
                  borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
                  borderRadius: radius.full, paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <Text variant="bodyStrong">See all products</Text>
                <Ionicons name="arrow-forward" size={15} color={color.text} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function CategoryShelf({ category, onSeeAll }: { category: Category; onSeeAll: () => void }) {
  const rail = useCategoryRail(category.slug, 8);
  return (
    <ProductRail
      title={category.name}
      subtitle="Top picks"
      products={rail.products}
      loading={rail.isLoading}
      actionLabel="See all"
      onAction={onSeeAll}
    />
  );
}

function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: gutter, marginBottom: spacing.lg }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="title" numberOfLines={1}>{title}</Text>
        {subtitle && <Text variant="meta" tone="muted" numberOfLines={1} style={{ marginTop: 3 }}>{subtitle}</Text>}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={8}>
          <Text variant="small" tone="accent">See all</Text>
          <Ionicons name="chevron-forward" size={14} color={color.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}
