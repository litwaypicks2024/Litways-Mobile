import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WishlistItem } from '@/types';
import { storageAdapter } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

// `public.wishlists` landed on the backend (user_id, product_id, created_at —
// PK (user_id, product_id), own-row RLS). Sync design (v1, kept deliberately
// simple next to store/cart.ts's debounced/retry machinery):
//  - loadFromDb unions remote + local, never clobbers local on a fetch error.
//  - addItem/removeItem write straight through while signed in (no
//    debounce — one row per (user, product), so there's nothing to coalesce).
//  - KNOWN v1 TRADEOFF: an offline/failed REMOVAL write can resurrect on the
//    next loadFromDb union, since the remote row is still there and the union
//    only ever grows local state back in. Accepted for v1 — see design notes.

interface WishlistState {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  toggle: (item: WishlistItem) => void;
  isWishlisted: (productId: string) => boolean;
  clear: () => void;
  loadFromDb: (userId: string) => Promise<void>;
}

// Membership checks (`isWishlisted`) run once per mounted ProductCard on every
// wishlist mutation, so a linear `.some()` scan there scales as O(visible
// cards × wishlist size). Cache a productId Set keyed on the `items` array
// reference so it's only rebuilt when the wishlist actually changes, and every
// card's lookup after that is O(1) — without touching the store's public API.
let cachedItems: WishlistItem[] | null = null;
let cachedIds: Set<string> = new Set();

function idsFor(items: WishlistItem[]): Set<string> {
  if (cachedItems !== items) {
    cachedItems = items;
    cachedIds = new Set(items.map((i) => i.productId));
  }
  return cachedIds;
}

// Fire-and-forget write-through: local state is already the source of truth
// for the UI (set() has landed by the time these are called), so these just
// log on failure rather than blocking/throwing. A failed ADD self-heals on
// the next loadFromDb union; a failed REMOVE does not (see the v1 tradeoff
// comment above).
function syncAdd(productId: string) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  supabase
    .from('wishlists')
    .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
    .then(({ error }) => {
      if (error) console.warn('Wishlist add sync failed:', error.message);
    });
}

function syncRemove(productId: string) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  supabase
    .from('wishlists')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
    .then(({ error }) => {
      if (error) console.warn('Wishlist remove sync failed:', error.message);
    });
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          if (idsFor(state.items).has(item.productId)) return state;
          syncAdd(item.productId);
          return { items: [...state.items, item] };
        }),

      removeItem: (productId) =>
        set((state) => {
          if (!idsFor(state.items).has(productId)) return state;
          syncRemove(productId);
          return { items: state.items.filter((i) => i.productId !== productId) };
        }),

      toggle: (item) => {
        const { isWishlisted, addItem, removeItem } = get();
        if (isWishlisted(item.productId)) {
          removeItem(item.productId);
        } else {
          addItem(item);
        }
      },

      isWishlisted: (productId) => idsFor(get().items).has(productId),

      clear: () => set({ items: [] }),

      // Fetch the user's remote wishlist rows, union them with whatever's
      // local, and write the union back as local state. Remote rows only
      // carry product_id, so any remote id not already represented locally
      // needs a products lookup to build a renderable WishlistItem — if that
      // lookup fails, that id is silently skipped this pass rather than
      // failing the whole load (it'll be picked up again on a later sync).
      // On a fetch error, local state is left completely untouched (no
      // clobber) — just logged.
      loadFromDb: async (userId) => {
        const { data, error } = await supabase
          .from('wishlists')
          .select('product_id')
          .eq('user_id', userId);

        if (error) {
          console.warn('Wishlist loadFromDb failed:', error.message);
          return;
        }

        const remoteIds = new Set((data ?? []).map((r) => r.product_id));
        const localItems = get().items;
        const localIds = idsFor(localItems);

        const missingIds = [...remoteIds].filter((id) => !localIds.has(id));
        let newItems: WishlistItem[] = [];
        if (missingIds.length > 0) {
          const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, brand, price, sale_price, image_urls, slug, stock')
            .in('id', missingIds);

          if (productsError) {
            console.warn(
              'Wishlist loadFromDb: failed to fetch product details for remote items:',
              productsError.message
            );
          } else {
            newItems = (products ?? []).map((p) => ({
              productId: p.id,
              name: p.name,
              brand: p.brand,
              price: p.price,
              salePrice: p.sale_price ?? undefined,
              imageUrl: p.image_urls?.[0] ?? '',
              slug: p.slug,
              stock: p.stock,
            }));
          }
        }

        if (newItems.length > 0) {
          set((state) => ({ items: [...state.items, ...newItems] }));
        }

        // Push local-only ids up to the backend so items added offline (or
        // before this device ever synced) get persisted. Upsert with
        // ignoreDuplicates so a race against another sync (or the write-
        // through in addItem) is a harmless no-op rather than an error.
        const localOnlyIds = [...localIds].filter((id) => !remoteIds.has(id));
        if (localOnlyIds.length > 0) {
          const { error: pushError } = await supabase
            .from('wishlists')
            .upsert(
              localOnlyIds.map((product_id) => ({ user_id: userId, product_id })),
              { onConflict: 'user_id,product_id', ignoreDuplicates: true }
            );
          if (pushError) {
            console.warn('Wishlist loadFromDb: failed to push local-only items:', pushError.message);
          }
        }
      },
    }),
    {
      name: 'litways-wishlist',
      storage: createJSONStorage(() => storageAdapter()),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
