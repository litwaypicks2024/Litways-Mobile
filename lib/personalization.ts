import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { rankedCategories, useTasteStore, type CategoryTaste } from '@/store/taste';
import { useWishlistStore } from '@/store/wishlist';
import { useCartStore } from '@/store/cart';
import { CARD_COLUMNS, type CardProduct } from '@/lib/catalog';

/** Categories the shopper leans toward, strongest first. Empty for a new shopper. */
export function useTopCategories(limit = 3): CategoryTaste[] {
  const categories = useTasteStore((s) => s.categories);
  return useMemo(() => rankedCategories(categories).slice(0, limit), [categories, limit]);
}

/** Ids the shopper has already engaged with — no point recommending them back. */
function useEngagedIds(): Set<string> {
  const recent = useTasteStore((s) => s.recentlyViewed);
  const wished = useWishlistStore((s) => s.items);
  const cart = useCartStore((s) => s.items);
  return useMemo(
    () => new Set([...recent.map((p) => p.id), ...wished.map((i) => i.productId), ...cart.map((i) => i.productId)].filter(Boolean) as string[]),
    [recent, wished, cart]
  );
}

const SELECT_LIMIT = 36;

/** Round-robin across categories, giving earlier (stronger) ones extra turns. */
function interleave(groups: CardProduct[][]): CardProduct[] {
  const out: CardProduct[] = [];
  const queues = groups.map((g) => [...g]);
  const turns = queues.map((_, i) => (i === 0 ? 2 : 1));
  while (queues.some((q) => q.length)) {
    queues.forEach((q, i) => {
      for (let n = 0; n < turns[i] && q.length; n++) out.push(q.shift()!);
    });
  }
  return out;
}

/**
 * "Picked for you": in-stock products from the shopper's top categories,
 * blended so the strongest interest leads but others still appear, minus
 * anything they've already viewed, saved or carted. `personalized` is false
 * for a shopper with no history — callers then title the rail honestly
 * ("Popular right now") and the products come from the featured list.
 * Home only shows the rail for personalised shoppers, so it passes
 * `onlyWhenPersonalized` and skips a request whose result it would discard.
 */
export function usePickedForYou(limit = 10, opts: { onlyWhenPersonalized?: boolean } = {}) {
  const top = useTopCategories(3);
  const engaged = useEngagedIds();
  const slugKey = top.map((c) => c.slug).join(',');

  const query = useQuery({
    queryKey: ['picked-for-you', slugKey],
    staleTime: 60_000,
    enabled: !opts.onlyWhenPersonalized || top.length > 0,
    queryFn: async (): Promise<CardProduct[]> => {
      let q = supabase.from('products_with_categories').select(CARD_COLUMNS).gt('stock', 0);
      if (top.length) q = q.in('category_slug', top.map((c) => c.slug));
      else q = q.eq('featured', true);
      const { data, error } = await q
        .order('featured', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(SELECT_LIMIT);
      if (error) throw error;
      const rows = (data ?? []) as CardProduct[];
      if (!top.length) return rows;
      return interleave(top.map((c) => rows.filter((p) => p.category_slug === c.slug)));
    },
  });

  const products = useMemo(
    () => (query.data ?? []).filter((p) => !p.id || !engaged.has(p.id)).slice(0, limit),
    [query.data, engaged, limit]
  );

  return { products, personalized: top.length > 0, topCategories: top, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

/** Best products in one category, minus what the shopper already engaged with. */
export function useCategoryRail(slug: string | undefined, limit = 10) {
  const engaged = useEngagedIds();
  const query = useQuery({
    queryKey: ['category-rail', slug],
    enabled: !!slug,
    staleTime: 60_000,
    queryFn: async (): Promise<CardProduct[]> => {
      const { data, error } = await supabase
        .from('products_with_categories')
        .select(CARD_COLUMNS)
        .eq('category_slug', slug!)
        .gt('stock', 0)
        .order('featured', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(SELECT_LIMIT);
      if (error) throw error;
      return (data ?? []) as CardProduct[];
    },
  });
  const products = useMemo(
    () => (query.data ?? []).filter((p) => !p.id || !engaged.has(p.id)).slice(0, limit),
    [query.data, engaged, limit]
  );
  return { products, isLoading: query.isLoading };
}

/** "Because you like Beauty" / "Because you like Beauty and more" — one name so it fits a rail header on a single line. */
export function likeSubtitle(topCategories: { name: string }[]): string {
  if (!topCategories.length) return '';
  return `Because you like ${topCategories[0].name}${topCategories.length > 1 ? ' and more' : ''}`;
}
