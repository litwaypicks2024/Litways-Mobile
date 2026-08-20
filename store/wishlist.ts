import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WishlistItem } from '@/types';
import { storageAdapter } from '@/lib/storage';

interface WishlistState {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  toggle: (item: WishlistItem) => void;
  isWishlisted: (productId: string) => boolean;
  clear: () => void;
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

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          if (idsFor(state.items).has(item.productId)) return state;
          return { items: [...state.items, item] };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

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
    }),
    {
      name: 'litways-wishlist',
      storage: createJSONStorage(() => storageAdapter()),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
