import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { FlashList } from '@/components/ui/List';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { recentSearches as searchStorage } from '@/lib/storage';
import { color, font, inputText, radius, shadow } from '@/theme/tokens';
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
import { ProductRail } from '@/components/shop/ProductRail';
import { useTasteStore, rankedCategories } from '@/store/taste';
import { usePickedForYou } from '@/lib/personalization';
import type { Product, ProductFilters, SortOption, Category } from '@/types';
import { Text } from '@/components/ui/Text';

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
  const { sort: sortParam, sale: saleParam } = useLocalSearchParams<{ sort?: string; sale?: string }>();
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('featured');
  const [filters, setFilters] = useState<ProductFilters>({});
  const [filterVisible, setFilterVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [saleOnly, setSaleOnly] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabBarClearance = useTabBarClearance();
  const inputRef = useRef<TextInput>(null);

  const tasteCategories = useTasteStore((s) => s.categories);
  const recentlyViewed = useTasteStore((s) => s.recentlyViewed);
  const clearRecentlyViewed = useTasteStore((s) => s.clearRecentlyViewed);
  const picked = usePickedForYou();

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('item_count', { ascending: false });
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60_000,
  });

  // The shopper's categories first (strongest interest leading), the rest by size.
  const orderedCategories = useMemo(() => {
    const rank = new Map(rankedCategories(tasteCategories).map((c, i) => [c.slug, i]));
    return [...allCategories].sort((a, b) => {
      const ra = rank.get(a.slug) ?? Infinity;
      const rb = rank.get(b.slug) ?? Infinity;
      return ra !== rb ? ra - rb : b.item_count - a.item_count;
    });
  }, [allCategories, tasteCategories]);
  const forYouSlugs = useMemo(() => new Set(rankedCategories(tasteCategories).slice(0, 3).map((c) => c.slug)), [tasteCategories]);

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

  // Home's Deals shortcuts deep-link with ?sale=1.
  useEffect(() => {
    if (saleParam === '1') {
      setSaleOnly(true);
      router.setParams({ sale: undefined });
    }
  }, [saleParam]);

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
    queryKey: ['products', query, sort, filters, category, saleOnly],
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
        const scoped = raw.filter(
          (p) => (!category || p.category_slug === category) && (!saleOnly || (p.sale_price != null && p.sale_price < (p.price ?? 0)))
        );
        // rawCats keeps the category breakdown of the whole page (before the
        // category chip narrows it) so the chips stay switchable.
        return { items: applyClientFilters(scoped, filters, sort), rawLen: raw.length, rawCats: raw.map((p) => ({ slug: p.category_slug, name: p.category_name })) };
      }

      let q = supabase
        .from('products_with_categories')
        .select('*')
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters.minPrice != null) q = q.gte('price', filters.minPrice);
      if (filters.maxPrice != null) q = q.lte('price', filters.maxPrice);
      if (filters.brands?.length) q = q.in('brand', filters.brands);
      if (category) q = q.eq('category_slug', category);
      if (saleOnly) q = q.not('sale_price', 'is', null);

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
      return { items, rawLen: raw.length, rawCats: [] as { slug: string | null; name: string | null }[] };
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rawLen === PAGE_SIZE ? allPages.length : undefined,
    staleTime: 30_000,
  });

  const products = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  // A committed search tells us which category the shopper is really after:
  // credit the one that dominates its results (once per distinct search).
  const bumpedQuery = useRef<string | null>(null);
  useEffect(() => {
    if (!query || isFetching || !products.length || bumpedQuery.current === query) return;
    bumpedQuery.current = query;
    const counts = new Map<string, { name: string; n: number }>();
    for (const p of products) {
      if (!p.category_slug) continue;
      const c = counts.get(p.category_slug);
      counts.set(p.category_slug, { name: p.category_name ?? p.category_slug, n: (c?.n ?? 0) + 1 });
    }
    const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    if (top && top[1].n / products.length >= 0.4) useTasteStore.getState().bump(top[0], top[1].name, 'search');
  }, [query, isFetching, products]);

  // While searching, the category chips describe the results (with counts) so
  // a broad query like "black" can be narrowed to shoes / bags / tops.
  const resultCategories = useMemo(() => {
    if (!query) return [] as { slug: string; name: string; n: number }[];
    const counts = new Map<string, { slug: string; name: string; n: number }>();
    for (const p of data?.pages.flatMap((pg) => pg.rawCats) ?? []) {
      if (!p.slug) continue;
      const c = counts.get(p.slug);
      counts.set(p.slug, { slug: p.slug, name: p.name ?? p.slug, n: (c?.n ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.n - a.n);
  }, [data, query]);

  function handleCommitSearch(term = inputValue.trim()) {
    if (!term) return;
    searchStorage.save(term).then(() => searchStorage.get().then(setRecentSearches));
    setFocused(false);
    Keyboard.dismiss();
    setInputValue(term);
    setQuery(term);
    setCategory(null);
  }

  function handleClear() {
    setInputValue('');
    setQuery('');
    setCategory(null);
  }

  function handleCancel() {
    Keyboard.dismiss();
    setFocused(false);
    handleClear();
  }

  function handleFocus() {
    searchStorage.get().then(setRecentSearches);
    setFocused(true);
  }

  function removeRecent(term: string) {
    setRecentSearches((r) => r.filter((t) => t !== term));
    searchStorage.remove(term);
  }

  function clearRecent() {
    setRecentSearches([]);
    searchStorage.clear();
  }

  // Personal rails only belong on the plain catalog — not once the shopper has
  // narrowed by search, category, filter or a non-default sort.
  const showRails = !query && !category && !saleOnly && activeFilterCount === 0 && sort === 'featured';

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
            borderWidth: 1.5,
            borderColor: color.fieldBorder,
            paddingHorizontal: 14,
            height: 46,
            gap: 8,
          }}>
            <Ionicons name="search-outline" size={17} color={color.inkFaint} />
            <TextInput
              ref={inputRef}
              value={inputValue}
              onChangeText={setInputValue}
              onFocus={handleFocus}
              onSubmitEditing={() => handleCommitSearch()}
              returnKeyType="search"
              placeholder="Search products, brands..."
              placeholderTextColor={color.inkFaint}
              style={[inputText, { flex: 1 }]}
            />
            {inputValue.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={17} color={color.inkFaint} />
              </TouchableOpacity>
            )}
          </View>

          {focused ? (
            <TouchableOpacity onPress={handleCancel} hitSlop={8} accessibilityRole="button" style={{ paddingHorizontal: 4 }}>
              <Text variant="bodyStrong" tone="accent">Cancel</Text>
            </TouchableOpacity>
          ) : (
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
                <Text variant="overline" tone="accent">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          )}
        </View>

        {/* Category chips: browse all, or narrow the current results */}
        {!focused && (query ? resultCategories.length > 1 : orderedCategories.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
            <CategoryChip label="All" active={!category} onPress={() => setCategory(null)} />
            {query
              ? resultCategories.map((c) => (
                  <CategoryChip key={c.slug} label={`${c.name} · ${c.n}`} active={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />
                ))
              : orderedCategories.map((c) => (
                  <CategoryChip key={c.slug} label={c.name} forYou={forYouSlugs.has(c.slug)} active={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />
                ))}
          </ScrollView>
        )}

        {/* Sort pills */}
        {!focused && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 6 }}>
          <TouchableOpacity
            onPress={() => setSaleOnly((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: saleOnly }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full,
              backgroundColor: saleOnly ? color.accent : color.surface,
              borderWidth: 1, borderColor: saleOnly ? color.accent : color.border,
            }}
          >
            <Ionicons name="pricetag" size={12} color={saleOnly ? color.onAccent : color.accent} />
            <Text variant="metaStrong" style={{ color: saleOnly ? color.onAccent : color.inkMuted }}>On sale</Text>
          </TouchableOpacity>
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
              <Text variant="metaStrong" style={{ color: sort === opt.value ? '#fff' : color.inkMuted }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        )}
      </View>

      {/* Discovery: what you searched, what you looked at, where to go next */}
      {focused && !inputValue && (
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
          {recentSearches.length > 0 && (
            <View style={{ backgroundColor: color.surface, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text variant="metaStrong" tone="muted" style={{ textTransform: 'uppercase' }}>Recent searches</Text>
                <TouchableOpacity onPress={clearRecent} hitSlop={8} accessibilityRole="button">
                  <Text variant="metaStrong" tone="accent">Clear all</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((term) => (
                <View key={term} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => handleCommitSearch(term)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }}>
                    <Ionicons name="time-outline" size={16} color={color.inkFaint} />
                    <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeRecent(term)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${term} from recent searches`}>
                    <Ionicons name="close" size={16} color={color.inkFaint} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <ProductRail
            compact
            title="Recently viewed"
            products={recentlyViewed as unknown as Product[]}
            actionLabel="Clear"
            onAction={clearRecentlyViewed}
          />

          {orderedCategories.length > 0 && (
            <View style={{ marginTop: 22, paddingHorizontal: 16 }}>
              <Text variant="heading" style={{ marginBottom: 12 }}>Browse by category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {orderedCategories.map((c) => (
                  <TouchableOpacity
                    key={c.slug}
                    onPress={() => { Keyboard.dismiss(); setFocused(false); setCategory(c.slug); }}
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, backgroundColor: color.surface, borderWidth: 1.5, borderColor: forYouSlugs.has(c.slug) ? color.accent : color.fieldBorder }}
                  >
                    {forYouSlugs.has(c.slug) && <Ionicons name="thumbs-up" size={12} color={color.accent} />}
                    <Text variant="small">{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Active filter chips */}
      {!(focused && !inputValue) && activeFilterCount > 0 && (
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
              <Text variant="metaStrong" style={{ color: color.accentPressed }}>{b}</Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          ))}
          {filters.sizes?.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilters((f) => ({ ...f, sizes: f.sizes?.filter((x) => x !== s) }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text variant="metaStrong" style={{ color: color.accentPressed }}>Size {s}</Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          ))}
          {(filters.minPrice != null || filters.maxPrice != null) && (
            <TouchableOpacity
              onPress={() => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}
            >
              <Text variant="metaStrong" style={{ color: color.accentPressed }}>
                ${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'}
              </Text>
              <Ionicons name="close" size={12} color={color.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setFilters({})}
            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#fee2e2' }}
          >
            <Text variant="metaStrong" style={{ color: '#b91c1c' }}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Result count bar */}
      {!(focused && !inputValue) && !isLoading && products.length > 0 && (
        <View style={{ backgroundColor: color.surface, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="meta" tone="muted">
            {query ? (
              <Text><Text weight="bold" tone="default">{products.length}</Text> results for "<Text weight="bold" tone="accent">{query}</Text>"</Text>
            ) : (
              <Text><Text weight="bold" tone="default">{products.length}</Text> products</Text>
            )}
          </Text>
          {isFetching && !isFetchingNextPage && <ActivityIndicator size="small" color={color.accent} />}
        </View>
      )}

      {/* Results */}
      {focused && !inputValue ? null : isLoading ? (
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
          onAction={() => { handleClear(); setFilters({}); setSaleOnly(false); }}
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
          ListHeaderComponent={showRails ? (
            <View style={{ marginHorizontal: -10, marginBottom: 6 }}>
              <ProductRail
                compact
                title={picked.personalized ? 'Picked for you' : 'Popular right now'}
                subtitle={picked.personalized ? `Because you like ${picked.topCategories.map((c) => c.name).slice(0, 2).join(' & ')}` : undefined}
                products={picked.products}
                loading={picked.isLoading}
              />
              <ProductRail
                compact
                title="Recently viewed"
                products={recentlyViewed as unknown as Product[]}
                actionLabel="Clear"
                onAction={clearRecentlyViewed}
              />
              <Text variant="heading" style={{ marginTop: 22, marginBottom: 4, paddingHorizontal: 16 }}>All products</Text>
            </View>
          ) : null}
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

function CategoryChip({ label, active, forYou, onPress }: { label: string; active: boolean; forYou?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.full,
        backgroundColor: active ? color.ink : color.surface,
        borderWidth: 1.5,
        borderColor: active ? color.ink : forYou ? color.accent : color.fieldBorder,
      }}
    >
      {forYou && !active && <Ionicons name="thumbs-up" size={11} color={color.accent} />}
      <Text variant="metaStrong" style={{ color: active ? color.onInk : color.ink }}>{label}</Text>
    </TouchableOpacity>
  );
}
