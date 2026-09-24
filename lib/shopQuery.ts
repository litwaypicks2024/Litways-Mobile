import { supabase } from '@/lib/supabase';
import { CARD_COLUMNS, type CardProduct } from '@/lib/catalog';
import type { ProductFilters, SortOption } from '@/types';

/**
 * Everything Shop and the category page ask the database for a page at a time.
 * Filtering, sorting and paging all happen in the database, and every ordering
 * ends in `id`, so a page boundary is deterministic: no repeats, no gaps, and a
 * sort applies to the whole catalogue instead of only the 24 rows on screen.
 */
export const PAGE_SIZE = 24;

export interface ShopArgs {
  query: string;
  sort: SortOption;
  filters: ProductFilters;
  category: string | null;
  saleOnly: boolean;
}

export async function fetchShopPage(args: ShopArgs, page: number): Promise<CardProduct[]> {
  const { query, sort, filters, category, saleOnly } = args;
  const from = page * PAGE_SIZE;

  if (query) {
    const { data, error } = await supabase
      .rpc('search_products_page', {
        search_term: query,
        category_slug_param: category,
        sale_only: saleOnly,
        min_price: filters.minPrice ?? null,
        max_price: filters.maxPrice ?? null,
        brands_param: filters.brands ?? null,
        sizes_param: filters.sizes ?? null,
        sort_key: sort,
        page_limit: PAGE_SIZE,
        page_offset: from,
      })
      .select(CARD_COLUMNS);
    if (error) throw error;
    return (data ?? []) as CardProduct[];
  }

  let q = supabase.from('products_with_categories').select(CARD_COLUMNS).range(from, from + PAGE_SIZE - 1);
  if (filters.minPrice != null) q = q.gte('price', filters.minPrice);
  if (filters.maxPrice != null) q = q.lte('price', filters.maxPrice);
  if (filters.brands?.length) q = q.in('brand', filters.brands);
  if (filters.sizes?.length) q = q.overlaps('sizes', filters.sizes);
  if (category) q = q.eq('category_slug', category);
  if (saleOnly) q = q.not('sale_price', 'is', null);

  switch (sort) {
    case 'price_asc': q = q.order('price', { ascending: true }); break;
    case 'price_desc': q = q.order('price', { ascending: false }); break;
    case 'newest': q = q.order('created_at', { ascending: false }); break;
    // Unrated products go last; Postgres would put NULL first on a descending sort.
    case 'rating': q = q.order('rating', { ascending: false, nullsFirst: false }); break;
    case 'name_asc': q = q.order('name', { ascending: true }); break;
    default: q = q.order('featured', { ascending: false }).order('created_at', { ascending: false });
  }
  const { data, error } = await q.order('id');
  if (error) throw error;
  return (data ?? []) as CardProduct[];
}

/** Category breakdown of a whole search (ignoring the category chip), for the chips above the results. */
export async function fetchSearchCategoryCounts(args: Omit<ShopArgs, 'sort' | 'category'>) {
  const { query, filters, saleOnly } = args;
  const { data, error } = await supabase.rpc('search_category_counts', {
    search_term: query,
    sale_only: saleOnly,
    min_price: filters.minPrice ?? null,
    max_price: filters.maxPrice ?? null,
    brands_param: filters.brands ?? null,
    sizes_param: filters.sizes ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({ slug: r.slug, name: r.name, n: Number(r.n) }));
}

/** One page of a category: featured first, then newest, id as the tiebreaker. */
export async function fetchCategoryPage(slug: string, page: number): Promise<CardProduct[]> {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from('products_with_categories')
    .select(CARD_COLUMNS)
    .eq('category_slug', slug)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as CardProduct[];
}
