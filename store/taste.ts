import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';
import type { Product } from '@/types';

/**
 * What the shopper is into, learned on-device from behaviour — no account or
 * backend needed. Every product belongs to one category, so a handful of
 * signals is enough to rank categories and drive "picked for you" rails.
 *
 * Signals (weight): viewing a product (3), saving it (4), a search whose
 * results lean toward a category (2), opening a category page (2).
 * Scores fade with a half-life so last month's interest doesn't outrank
 * this week's (see rankedCategories).
 */

export type TasteSignal = 'view' | 'wishlist' | 'search' | 'category' | 'interest';

// 'interest' = a category the shopper picked during onboarding: a strong head start that behaviour then overtakes.
const WEIGHTS: Record<TasteSignal, number> = { view: 3, wishlist: 4, search: 2, category: 2, interest: 6 };
const HALF_LIFE_DAYS = 14;
const MAX_RECENT = 12;
const MAX_CATEGORIES = 30;

export interface CategoryTaste {
  slug: string;
  name: string;
  /** Score as of `at` — decayed lazily when read or next bumped. */
  score: number;
  at: number;
}

/** The slice of a product we keep for the "Recently viewed" rail. */
export type RecentProduct = Pick<
  Product,
  'id' | 'slug' | 'name' | 'brand' | 'price' | 'sale_price' | 'image_urls' | 'stock' | 'rating' | 'review_count' | 'category_slug' | 'category_name'
>;

interface TasteState {
  categories: Record<string, CategoryTaste>;
  recentlyViewed: RecentProduct[];
  bump: (slug: string | null | undefined, name: string | null | undefined, signal: TasteSignal) => void;
  recordView: (product: Product) => void;
  /** Onboarding picks: seed these categories so the first Home already leans their way. */
  seedInterests: (items: { slug: string; name: string }[]) => void;
  clearRecentlyViewed: () => void;
}

function decayed(c: CategoryTaste, now: number): number {
  const days = (now - c.at) / 86_400_000;
  return c.score * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export const useTasteStore = create<TasteState>()(
  persist(
    (set, get) => ({
      categories: {},
      recentlyViewed: [],

      bump: (slug, name, signal) => {
        if (!slug) return;
        const now = Date.now();
        const prev = get().categories[slug];
        const next: CategoryTaste = {
          slug,
          name: name ?? prev?.name ?? slug,
          score: (prev ? decayed(prev, now) : 0) + WEIGHTS[signal],
          at: now,
        };
        const all = { ...get().categories, [slug]: next };
        // Cap the map so it can't grow without bound: keep the strongest.
        const keys = Object.keys(all);
        if (keys.length > MAX_CATEGORIES) {
          keys
            .sort((a, b) => decayed(all[b], now) - decayed(all[a], now))
            .slice(MAX_CATEGORIES)
            .forEach((k) => delete all[k]);
        }
        set({ categories: all });
      },

      seedInterests: (items) => {
        items.forEach((c) => get().bump(c.slug, c.name, 'interest'));
      },

      recordView: (product) => {
        if (!product.id) return;
        get().bump(product.category_slug, product.category_name, 'view');
        const snapshot: RecentProduct = {
          id: product.id,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          price: product.price,
          sale_price: product.sale_price,
          image_urls: product.image_urls?.slice(0, 1) ?? null,
          stock: product.stock,
          rating: product.rating,
          review_count: product.review_count,
          category_slug: product.category_slug,
          category_name: product.category_name,
        };
        set((s) => ({
          recentlyViewed: [snapshot, ...s.recentlyViewed.filter((p) => p.id !== product.id)].slice(0, MAX_RECENT),
        }));
      },

      clearRecentlyViewed: () => set({ recentlyViewed: [] }),
    }),
    {
      name: 'litways-taste',
      storage: createJSONStorage(() => storageAdapter()),
      partialize: (s) => ({ categories: s.categories, recentlyViewed: s.recentlyViewed }),
    }
  )
);

/** Categories ranked by (decayed) interest, strongest first. */
export function rankedCategories(categories: Record<string, CategoryTaste>, now = Date.now()): CategoryTaste[] {
  return Object.values(categories)
    .map((c) => ({ ...c, score: decayed(c, now) }))
    .filter((c) => c.score > 0.25)
    .sort((a, b) => b.score - a.score);
}
