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

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          if (state.items.some((i) => i.productId === item.productId)) return state;
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

      isWishlisted: (productId) => get().items.some((i) => i.productId === productId),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'litways-wishlist',
      storage: createJSONStorage(() => storageAdapter()),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
