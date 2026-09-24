import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CARD_COLUMNS, type CardProduct } from '@/lib/catalog';
import type { Category } from '@/types';

/**
 * Everything Home shows above the personal shelves, loaded as ONE query:
 * one cache entry, one loading state, one render when it lands instead of
 * three staggered ones. Each shelf still comes from its own bounded server
 * query, so this stays correct however large the catalogue grows. A shelf
 * that failed comes back as null so Home can show a retry for just that shelf.
 */
export interface HomeFeed {
  featured: CardProduct[] | null;
  newest: CardProduct[] | null;
  deals: CardProduct[] | null;
}

// Home draws at most this many of each; asking for more only costs bytes and memory.
const FEATURED_LIMIT = 4;
const NEWEST_LIMIT = 4;
const DEALS_LIMIT = 8;

async function fetchHomeFeed(): Promise<HomeFeed> {
  const [featured, newest, deals] = await Promise.allSettled([
    supabase.from('featured_products').select(CARD_COLUMNS).limit(FEATURED_LIMIT),
    supabase
      .from('products_with_categories')
      .select(CARD_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(NEWEST_LIMIT),
    supabase
      .from('products_with_categories')
      .select(CARD_COLUMNS)
      .not('sale_price', 'is', null)
      .order('created_at', { ascending: false })
      .limit(DEALS_LIMIT),
  ]);

  const rows = (r: PromiseSettledResult<{ data: unknown; error: unknown }>): CardProduct[] | null =>
    r.status === 'fulfilled' && !r.value.error ? ((r.value.data ?? []) as CardProduct[]) : null;

  const feed = { featured: rows(featured), newest: rows(newest), deals: rows(deals) };
  // Every shelf failed: that's a connection problem, let the query retry and report it.
  if (!feed.featured && !feed.newest && !feed.deals) throw new Error('Home feed failed to load');
  return feed;
}

export const homeFeedOptions = queryOptions({
  queryKey: ['home-feed'],
  queryFn: fetchHomeFeed,
});

export const categoriesOptions = queryOptions({
  queryKey: ['categories'],
  queryFn: async () => {
    const { data, error } = await supabase.from('categories').select('*').order('item_count', { ascending: false });
    if (error) throw error;
    return data as Category[];
  },
  staleTime: 5 * 60_000,
});

/** Start Home's requests before Home mounts (called during app boot, behind the splash). */
export function prefetchHome(client: QueryClient) {
  return Promise.allSettled([client.prefetchQuery(homeFeedOptions), client.prefetchQuery(categoriesOptions)]);
}
