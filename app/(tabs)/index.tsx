import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { supabase } from '@/lib/supabase';
import { color, radius, spacing, gutter, shadow, type as t } from '@/theme/tokens';
import { useAuthStore } from '@/store/auth';
import { ProductCard } from '@/components/shop/ProductCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProductCardSkeleton, SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { discountPercent } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { MotifOverlay } from '@/components/brand/Motif';
import { LogoMark } from '@/components/brand/LogoMark';
import { Marquee } from '@/components/brand/Marquee';
import { RotatingBadge } from '@/components/brand/RotatingBadge';
import { ProductRail } from '@/components/shop/ProductRail';
import { useTasteStore, rankedCategories } from '@/store/taste';
import { usePickedForYou, useCategoryRail } from '@/lib/personalization';
import type { Product, Category } from '@/types';
import { Text } from '@/components/ui/Text';

/* Bundled brand campaign shot — subjects right, quiet left half for the copy. */
const HERO_IMAGE = require('@/assets/images/home-hero.jpg');

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
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

function getCategoryIcon(slug: string, name: string): keyof typeof Ionicons.glyphMap {
  const key = Object.keys(CATEGORY_ICONS).find(
    (k) => slug?.includes(k) || name?.toLowerCase().includes(k)
  );
  return key ? CATEGORY_ICONS[key] : 'pricetags-outline';
}

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

  /* Scroll-driven parallax: the photo drifts inside its arch as you scroll. */
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [-120, 0, 360], [26, 0, -34], Extrapolation.CLAMP),
      },
    ],
  }));

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
              {firstName ? `Hi, ${firstName}` : 'Welcome'}
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

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />
        }
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
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

        {/* ─── Hero — arch-framed campaign shot under editorial type.
               Children stagger their own entrances. ─── */}
        <View style={{ marginTop: spacing.lg, marginHorizontal: gutter }}>
          {/* Overline with the logo's speed-lines DNA — greets by time of day */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(1 * 60).reduceMotion(ReduceMotion.System)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}
          >
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={{ width: 18, height: 3.5, borderRadius: 2, backgroundColor: color.accent }} />
              <View style={{ width: 12, height: 3.5, borderRadius: 2, backgroundColor: color.ink, marginRight: 3 }} />
            </View>
            <Text variant="overline" tone="accent">
              {daypartGreeting()} · Monrovia
            </Text>
          </Animated.View>

          {/* Headline lines land one after the other */}
          <Animated.View entering={FadeInDown.duration(320).delay(2 * 60).reduceMotion(ReduceMotion.System)}>
            <Text variant="hero">
              Everything you
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(320).delay(3 * 60).reduceMotion(ReduceMotion.System)}>
            <Text variant="hero">
              need, <Text tone="accent">delivered.</Text>
            </Text>
          </Animated.View>

          {/* Arch-framed photo — a doorway into the shop; no text on the image */}
          <Animated.View entering={FadeInDown.duration(340).delay(4 * 60).reduceMotion(ReduceMotion.System)}>
          <PressableScale haptic onPress={() => router.push('/(tabs)/shop')} style={{ marginTop: spacing.lg }}>
            <View
              style={{
                height: 250,
                borderTopLeftRadius: 999,
                borderTopRightRadius: 999,
                borderBottomLeftRadius: radius.lg,
                borderBottomRightRadius: radius.lg,
                overflow: 'hidden',
              }}
            >
              {/* Oversized so the parallax drift never exposes an edge */}
              <Animated.View style={[{ height: 320, marginTop: -35 }, parallaxStyle]}>
                <Image
                  source={HERO_IMAGE}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={300}
                />
              </Animated.View>
            </View>
            {/* Rotating editorial badge on the arch's quiet shoulder (faces stay clear) */}
            <View style={{ position: 'absolute', top: 10, left: 10 }}>
              <RotatingBadge />
            </View>
          </PressableScale>
          </Animated.View>
        </View>

        {/* ─── Shop by category ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(2 * 60).reduceMotion(ReduceMotion.System)}
          style={{ marginTop: spacing['2xl'] }}
        >
          <SectionHeader title="Shop by category" />
          {errorCats ? (
            <View style={{ paddingHorizontal: gutter }}>
              <ErrorState
                message="Couldn't load categories. Check your connection and try again."
                onRetry={() => refetchCats()}
                loading={fetchingCats}
              />
            </View>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}
          >
            {loadingCats
              ? Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                    <SkeletonBlock width={68} height={68} borderRadius={radius.lg} />
                    <SkeletonBlock width={52} height={10} borderRadius={5} />
                  </View>
                ))
              : orderedCategories?.map((cat) => (
                  <PressableScale
                    key={cat.id}
                    haptic
                    onPress={() => router.push(`/category/${cat.slug}`)}
                    style={{ alignItems: 'center', width: 72 }}
                  >
                    <View style={{
                      width: 68, height: 68,
                      backgroundColor: color.surface,
                      borderRadius: radius.lg,
                      borderWidth: 1, borderColor: color.border,
                      overflow: 'hidden',
                      marginBottom: spacing.sm,
                    }}>
                      {cat.image ? (
                        <Image source={{ uri: cat.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft }}>
                          <Ionicons name={getCategoryIcon(cat.slug ?? '', cat.name ?? '')} size={26} color={color.accent} />
                        </View>
                      )}
                    </View>
                    <Text variant="metaStrong" numberOfLines={2} style={{ textAlign: 'center' }}>
                      {cat.name}
                    </Text>
                  </PressableScale>
                ))}
          </ScrollView>
          )}
        </Animated.View>

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
                onPress={() => router.push({ pathname: '/(tabs)/shop', params: { sort: 'price_asc' } })}
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
            subtitle={`Because you like ${picked.topCategories.map((c) => c.name).slice(0, 2).join(' & ')}`}
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
      </Animated.ScrollView>
    </View>
  );
}

function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: gutter, marginBottom: spacing.lg }}>
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        {subtitle && <Text variant="meta" tone="muted" style={{ marginTop: 3 }}>{subtitle}</Text>}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={8}>
          <Text variant="small" tone="accent">See all</Text>
          <Ionicons name="chevron-forward" size={14} color={color.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}
