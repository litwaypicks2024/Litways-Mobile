import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@/types';
import { supabase } from '@/lib/supabase';
import { storageAdapter } from '@/lib/storage';

function cartKey(item: Pick<CartItem, 'productId' | 'size' | 'color'>): string {
  return `${item.productId}::${item.size ?? ''}::${item.color ?? ''}`;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  reconcile: (fresh: { productId: string; price: number; stock: number }[]) => void;
  clearCart: () => void;
  syncToDb: (userId: string) => Promise<void>;
  loadFromDb: (userId: string) => Promise<void>;
  itemCount: () => number;
  subtotal: () => number;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        set((state) => {
          const key = cartKey(newItem);
          const existing = state.items.find((i) => cartKey(i) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                cartKey(i) === key
                  ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...newItem, quantity: 1 }] };
        });
      },

      removeItem: (productId, size, color) => {
        const key = cartKey({ productId, size, color });
        set((state) => ({ items: state.items.filter((i) => cartKey(i) !== key) }));
      },

      updateQuantity: (productId, quantity, size, color) => {
        const key = cartKey({ productId, size, color });
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => cartKey(i) !== key)
              : state.items.map((i) =>
                  cartKey(i) === key
                    ? { ...i, quantity: Math.min(quantity, i.stock) }
                    : i
                ),
        }));
      },

      // Update cart items to live catalog price/stock and drop anything now
      // unavailable. Used to reconcile against the server before checkout.
      reconcile: (fresh) => {
        set((state) => ({
          items: state.items
            .map((i) => {
              const f = fresh.find((x) => x.productId === i.productId);
              if (!f) return i;
              return { ...i, price: f.price, stock: f.stock, quantity: Math.min(i.quantity, f.stock) };
            })
            .filter((i) => i.stock > 0 && i.quantity > 0),
        }));
      },

      clearCart: () => set({ items: [] }),

      syncToDb: async (userId) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const { items } = get();
          await supabase
            .from('carts')
            .upsert({ user_id: userId, items: items as any, updated_at: new Date().toISOString() });
        }, 800);
      },

      loadFromDb: async (userId) => {
        const { data } = await supabase
          .from('carts')
          .select('items')
          .eq('user_id', userId)
          .single();
        if (data?.items) {
          set((state) => {
            const remote = data.items as unknown as CartItem[];
            const local = state.items;
            const merged = new Map<string, CartItem>();
            for (const item of [...remote, ...local]) {
              const k = cartKey(item);
              const existing = merged.get(k);
              if (!existing) {
                merged.set(k, item);
              } else {
                merged.set(k, {
                  ...existing,
                  quantity: Math.min(Math.max(existing.quantity, item.quantity), item.stock),
                });
              }
            }
            return { items: Array.from(merged.values()) };
          });
        }
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'litways-cart',
      storage: createJSONStorage(() => storageAdapter()),
      // Only persist the items array — methods are not serializable
      partialize: (state) => ({ items: state.items }),
    }
  )
);
