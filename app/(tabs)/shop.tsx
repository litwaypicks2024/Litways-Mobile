import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@/components/ui/List';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { recentSearches as searchStorage } from '@/lib/storage';
import { color, radius, shadow } from '@/theme/tokens';
import { ProductCard } from '@/components/shop/ProductCard';
import { FilterSheet } from '@/components/shop/FilterSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProductGridSkeleton } from '@/components/ui/SkeletonLoader';
import { NoResultsIllustration } from '@/components/illustrations';
import { BrandLoader } from '@/components/motion/BrandLoader';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarClearance } from '@/components/navigation/TabBar';
import type { Product, ProductFilters, SortOption } from '@/types';

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Featured', value: 'featured' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Newest', value: 'newest' },
  { label: 'Top Rated', value: 'rating' },
];

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 350;


export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Lets callers (e.g. the Home "Deals on now" banner) deep-link straight
  // into a sorted view. Shop stays mounted for the session as a tab screen,
  // so a plain useState initializer would miss a param that arrives on an
  // already-mounted instance — react to param changes explicitly instead,
  // mirroring the account.tsx tab-param pattern.
  const { sort: sortParam } = useLocalSearchParams<{ sort?: string }>();
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('featured');
  const [filters, setFilters] = useState<ProductFilters>({});
  const [filterVisible, setFilterVisible] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabBarClearance = useTabBarClearance();

  const activeFilterCount = [
    filters.brands?.length ?? 0,
    filters.sizes?.length ?? 0,
    filters.minPrice != null || filters.maxPrice != null ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  useEffect(() => {
    const valid = SORT_OPTIONS.map((o) => o.value);
    if (sortParam && valid.includes(sortParam as SortOption)) {
      setSort(sortParam as SortOption);
      // Consume the param immediately so it doesn't re-apply after the
      // shopper has since picked a different sort manually.
      router.setParams({ sort: undefined });
    }
  }, [sortParam]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(inputValue.trim());
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputValue]);

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
    queryKey: ['products', query, sort, filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (query) {
        const { data, error } = await supabase.rpc('search_products', {
          search_term: query,
          page_limit: PAGE_SIZE,
          page_offset: pageParam * PAGE_SIZE,
        });
        if (error) throw error;
        const raw = (data ?? []) as Product[];
        // rawLen tracks the *server* page size so pagination doesn't stop early
        // when client-side filters shrink the visible list.
        return { items: applyClientFilters(raw, filters, sort), rawLen: raw.length };
      }

      let q = supabase
        .from('products_with_categories')
        .select('*')
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters.minPrice != null) q = q.gte('price', filters.minPrice);
      if (filters.maxPrice != null) q = q.lte('price', filters.maxPrice);
      if (filters.brands?.length) q = q.in('brand', filters.brands);

      switch (sort) {
        case 'price_asc': q = q.order('price', { ascending: true }); break;
        case 'price_desc': q = q.order('price', { ascending: false }); break;
        case 'newest': q = q.order('created_at', { ascending: false }); break;
        case 'rating': q = q.order('rating', { ascending: false }); break;
        default: q = q.order('featured', { ascending: false }).order('created_at', { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;
      const raw = (data ?? []) as Product[];
      // Client-side size filter (sizes are arrays in DB)
      const items = filters.sizes?.length
        ? raw.filter((p) => filters.sizes!.some((s) => p.sizes?.includes(s)))
        : raw;
      return { items, rawLen: raw.length };
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rawLen === PAGE_SIZE ? allPages.length : undefined,
    staleTime: 30_000,
  });

  const products = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  function handleCommitSearch(term = inputValue.trim()) {
    if (!term) return;
    searchStorage.save(term).then(() => searchStorage.get().then(setRecentSearches));
    setShowRecent(false);
    setInputValue(term);
    setQuery(term);
  }

  function handleClear() {
    setInputValue('');
    setQuery('');
    setShowRecent(false);
  }

  function handleFocus() {
    searchStorage.get().then(setRecentSearches);
    setShowRecent(true);
  }

  function handleApplyFilters(f: ProductFilters) {
    setFilters(f);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.surface} />

      {/* ─── Header ─── */}
      <View style={{
        backgroundColor: color.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 14,
        ...shadow.header,
      }}>
        {/* Search + Filter row */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: color.surfaceSunken,
            borderRadius: radius.full,
            paddingHorizontal: 14,
            height: 46,
            gap: 8,
          }}>
            <Ionicons name="search-outline" size={17} color={color.inkFaint} />
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              onFocus={handleFocus}
              onBlur={() => setTimeout(() => setShowRecent(false), 150)}
              onSubmitEditing={() => handleCommitSearch()}
              returnKeyType="search"
              placeholder="Search products, brands..."
              placeholderTextColor={color.inkFaint}
              style={{ flex: 1, fontSize: 14, color: color.ink }}
            />
            {inputValue.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={17} color={color.inkFaint} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
            style={{
              width: 46, height: 46,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeFilterCount > 0 ? color.accent : color.surfaceSunken,
            }}
          >
            <Ionicons name="options-outline" size={19} color={activeFilterCount > 0 ? '#fff' : color.inkMuted} />
            {activeFilterCount > 0 && (
              <View style={{
                position: 'absolute', top: 6, right: 6,
                width: 14, height: 14,
                backgroundColor: '#fff',
                borderRadius: 7,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: color.accent, fontSize: 8, fontWeight: '800' }}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Sort pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSort(opt.value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: sort === opt.value ? color.accent : color.surface,
                borderWidth: 1,
                borderColor: sort === opt.value ? color.accent : color.border,
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: sort === opt.value ? '#fff' : color.inkMuted,
              }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recent searches dropdown */}
      {showRecent && recentSearches.length > 0 && !inputValue && (
        <View style={{ backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border, paddingHorizontal: 16, paddingVertical: 8, zIndex: 10 }}>
          <Text style={{ fontSize: 11, color: color.inkFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Recent searches
          </Text>
          {recentSearches.map((term) => (
            <TouchableOpacity
              key={term}
              onPress={() => handleCommitSearch(term)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}
            >
              <Ionicons name="time-outline" size={15} color={color.inkFaint} />
              <Text style={{ fontSize: 14, color: color.ink, flex: 1 }}>{term}</Text>
              <Ionicons name="arrow-up-outline" size={14} color={color.inkFaint} style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border, maxHeight: 46 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 6, alignItems: 'center' }}
        >
          {filters.brands?.map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => setFilters((f) => ({ ...f, brands: f.brands?.filter((x) => x !== b) }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text style={{ fontSize: 12, color: color.accentPressed, fontWeight: '600' }}>{b}</Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          ))}
          {filters.sizes?.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilters((f) => ({ ...f, sizes: f.sizes?.filter((x) => x !== s) }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text style={{ fontSize: 12, color: color.accentPressed, fontWeight: '600' }}>Size {s}</Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          ))}
          {(filters.minPrice != null || filters.maxPrice != null) && (
            <TouchableOpacity
              onPress={() => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text style={{ fontSize: 12, color: color.accentPressed, fontWeight: '600' }}>
                ${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'}
              </Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setFilters({})}
            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#fee2e2' }}
          >
            <Text style={{ fontSize: 12, color: '#b91c1c', fontWeight: '700' }}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Result count bar */}
      {!isLoading && products.length > 0 && (
        <View style={{ backgroundColor: color.surface, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: color.inkMuted, fontWeight: '500' }}>
            {query ? (
              <Text><Text style={{ fontWeight: '700', color: color.ink }}>{products.length}</Text> results for "<Text style={{ fontWeight: '700', color: color.accent }}>{query}</Text>"</Text>
            ) : (
              <Text><Text style={{ fontWeight: '700', color: color.ink }}>{products.length}</Text> products</Text>
            )}
          </Text>
          {isFetching && !isFetchingNextPage && <ActivityIndicator size="small" color={color.accent} />}
        </View>
      )}

      {/* Results */}
      {isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 10 }}>
          <ProductGridSkeleton count={6} />
        </View>
      ) : isError ? (
        <ErrorState
          message="Couldn't load products. Check your connection and try again."
          onRetry={() => refetch()}
          loading={isFetching}
        />
      ) : !products.length ? (
        <EmptyState
          illustration={<NoResultsIllustration />}
          title="No products found"
          description={query ? `No results for "${query}".` : 'No products match your filters.'}
          actionLabel="Clear filters"
          onAction={() => { handleClear(); setFilters({}); }}
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
          contentContainerStyle={{ padding: 10, paddingBottom: tabBarClearance }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={() => refetch()}
              tintColor={color.accent}
            />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, margin: 5 }}>
              <ProductCard product={item} />
            </View>
          )}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <BrandLoader size={44} label="Loading more…" />
              </View>
            ) : null
          }
        />
        </Animated.View>
      )}

      <FilterSheet
        visible={filterVisible}
        filters={filters}
        onApply={handleApplyFilters}
        onClose={() => setFilterVisible(false)}
      />
    </View>
  );
}

function applyClientFilters(data: Product[], filters: ProductFilters, sort: SortOption): Product[] {
  let result = [...data];
  if (filters.minPrice != null) result = result.filter((p) => (p.price ?? 0) >= filters.minPrice!);
  if (filters.maxPrice != null) result = result.filter((p) => (p.price ?? 0) <= filters.maxPrice!);
  if (filters.brands?.length) result = result.filter((p) => filters.brands!.includes(p.brand ?? ''));
  if (filters.sizes?.length) result = result.filter((p) => filters.sizes!.some((s) => p.sizes?.includes(s)));
  if (sort === 'price_asc') result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  if (sort === 'price_desc') result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  if (sort === 'rating') result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return result;
}
