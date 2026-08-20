import React, { useMemo } from 'react';
import { View, Text, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@/components/ui/List';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/shop/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProductGridSkeleton } from '@/components/ui/SkeletonLoader';
import type { Product } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { color, font } from '@/theme/tokens';
import { BrandLoader } from '@/components/motion/BrandLoader';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

const PAGE_SIZE = 24;

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['category-products', slug],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_products_by_category', {
        category_slug_param: slug,
        page_limit: PAGE_SIZE,
        page_offset: pageParam * PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    enabled: !!slug,
  });

  const products = useMemo(() => data?.pages.flatMap((p) => p) ?? [], [data]);
  const categoryName = products[0]?.category_name ?? slug;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {/* Header */}
      <View
        style={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <IconButton icon="arrow-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        <Text style={{ fontSize: 18, fontFamily: font.display, color: color.ink, flex: 1 }} numberOfLines={1}>
          {categoryName ?? 'Category'}
        </Text>
        {isFetching && !isLoading && <ActivityIndicator size="small" color={color.accent} />}
      </View>

      {isLoading ? (
        <View className="flex-row flex-wrap px-3 pt-2">
          <ProductGridSkeleton count={6} />
        </View>
      ) : isError ? (
        <ErrorState
          message="Couldn't load products in this category. Check your connection and try again."
          onRetry={() => refetch()}
          loading={isFetching}
        />
      ) : !products.length ? (
        <EmptyState
          icon="cube-outline"
          title="No products in this category"
          description="Check back soon for new arrivals."
          actionLabel="Browse All"
          onAction={() => router.push('/(tabs)/shop')}
        />
      ) : (
        <Animated.View
          style={{ flex: 1 }}
          entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)}
        >
        <FlashList
          data={products}
          numColumns={2}
          estimatedItemSize={290}
          keyExtractor={(item) => item.id ?? ''}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={() => refetch()}
              tintColor={color.accent}
            />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, margin: 4 }}>
              <ProductCard product={item} />
            </View>
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <BrandLoader size={44} />
              </View>
            ) : null
          }
        />
        </Animated.View>
      )}
    </View>
  );
}
