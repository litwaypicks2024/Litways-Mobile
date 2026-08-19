import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@/components/ui/List';
import { supabase } from '@/lib/supabase';
import { color, font, radius, spacing, gutter, shadow, type as t } from '@/theme/tokens';
import { ProductCard } from '@/components/shop/ProductCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProductCardSkeleton, SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { discountPercent } from '@/lib/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import { MotifOverlay } from '@/components/brand/Motif';
import { LogoLockup } from '@/components/brand/LogoMark';
import type { Product, Category } from '@/types';

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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const tabBarClearance = useTabBarClearance();

  const { data: featured, isLoading: loadingFeatured, refetch: refetchFeatured } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('featured_products').select('*').limit(10);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: newest } = useQuery({
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

  const { data: deals } = useQuery({
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

  const { data: categories, isLoading: loadingCats, refetch: refetchCats } = useQuery({
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchFeatured(), refetchCats()]);
    setRefreshing(false);
  }, [refetchFeatured, refetchCats]);

  // Biggest genuine discount across the deal products — honest urgency, no fake timers.
  const maxDiscount = (deals ?? []).reduce((best, p) => {
    if (p.sale_price == null || p.price == null) return best;
    return Math.max(best, discountPercent(p.price, p.sale_price));
  }, 0);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <LogoLockup variant="onLight" markSize={36} />

          {/* Help — a visible safety net for first-time shoppers */}
          <IconButton icon="help-circle-outline" onPress={() => router.push('/contact')} />
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
          <Text style={{ ...t.body, color: color.inkMuted, flex: 1 }}>Search for anything…</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />
        }
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      >
        {/* Announce bar — free-delivery threshold nudges basket size */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(0 * 60).reduceMotion(ReduceMotion.System)}
          style={{
            backgroundColor: color.accentSoft,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            paddingVertical: spacing.sm,
          }}
        >
          <Ionicons name="bicycle-outline" size={16} color={color.accentPressed} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: color.accentPressed }}>
            Free delivery on orders over $25
          </Text>
        </Animated.View>

        {/* ─── Hero — editorial split: type on canvas, photo kept clean ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(1 * 60).reduceMotion(ReduceMotion.System)}
          style={{ marginTop: spacing.lg, marginHorizontal: gutter }}
        >
          {/* Overline with the logo's speed-lines DNA */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={{ width: 18, height: 3.5, borderRadius: 2, backgroundColor: color.accent }} />
              <View style={{ width: 12, height: 3.5, borderRadius: 2, backgroundColor: color.ink, marginRight: 3 }} />
            </View>
            <Text style={{ ...t.overline, color: color.accent, fontSize: 11 }}>New season</Text>
          </View>

          <Text style={{ fontSize: 32, fontFamily: font.displayHeavy, lineHeight: 37, letterSpacing: -0.8, color: color.ink }}>
            Everything you{'\n'}need, <Text style={{ color: color.accent }}>delivered.</Text>
          </Text>

          {/* Photo card — no scrim, no text; chips carry the UI */}
          <PressableScale haptic onPress={() => router.push('/(tabs)/shop')} style={{ marginTop: spacing.md, paddingBottom: 20 }}>
            <View style={{ height: 192, borderRadius: radius.lg, overflow: 'hidden' }}>
              <Image
                source={HERO_IMAGE}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={300}
              />
              {/* Delivery promise chip floats on the image's quiet half */}
              <View
                style={{
                  position: 'absolute', top: 12, left: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: color.surface, borderRadius: radius.full,
                  paddingHorizontal: 11, paddingVertical: 6,
                  ...shadow.card,
                }}
              >
                <Ionicons name="checkmark-circle" size={13} color={color.accent} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: color.ink }}>
                  Free delivery · all 15 counties
                </Text>
              </View>
            </View>

            {/* CTA straddles the photo's bottom edge for depth */}
            <View
              style={{
                position: 'absolute', bottom: 0, left: spacing.lg,
                flexDirection: 'row', alignItems: 'center', gap: 7,
                backgroundColor: color.ink, borderRadius: radius.full,
                paddingHorizontal: spacing.lg, paddingVertical: 12,
                ...shadow.card,
              }}
            >
              <Text style={{ color: color.onInk, fontWeight: '800', fontSize: 13 }}>Start shopping</Text>
              <Ionicons name="arrow-forward" size={15} color={color.onInk} />
            </View>
          </PressableScale>
        </Animated.View>

        {/* ─── Shop by category ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(2 * 60).reduceMotion(ReduceMotion.System)}
          style={{ marginTop: spacing['2xl'] }}
        >
          <SectionHeader title="Shop by category" />
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
              : categories?.map((cat) => (
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
                    <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '600', color: color.text, textAlign: 'center', lineHeight: 15 }}>
                      {cat.name}
                    </Text>
                  </PressableScale>
                ))}
          </ScrollView>
        </Animated.View>

        {/* ─── Deals ─── */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(3 * 60).reduceMotion(ReduceMotion.System)}
        >
          {(deals?.length ?? 0) > 0 && (
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
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>Deals on now</Text>
                      </View>
                      <Text style={{ color: '#fff', fontSize: 26, fontFamily: font.displayHeavy, letterSpacing: -0.5 }}>
                        {maxDiscount > 0 ? `Up to ${maxDiscount}% off` : 'Save on selected items'}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 3 }}>Selected items · while stocks last</Text>
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
          {(newest?.length ?? 0) > 0 && (
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
                <Text style={{ color: color.text, fontWeight: '700', fontSize: 14 }}>See all products</Text>
                <Ionicons name="arrow-forward" size={15} color={color.text} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: gutter, marginBottom: spacing.lg }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontFamily: font.display, color: color.text, letterSpacing: -0.4 }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 12.5, color: color.textMuted, fontWeight: '500', marginTop: 3 }}>{subtitle}</Text>}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} hitSlop={8}>
          <Text style={{ fontSize: 13, color: color.accent, fontWeight: '700' }}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={color.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}
