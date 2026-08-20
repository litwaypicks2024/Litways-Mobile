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
  /** Set when loadFromDb's merge visibly changed the local cart (different
   * item count or a bumped quantity), so the Cart screen can tell the
   * shopper what happened instead of silently rewriting their cart. */
  mergeNotice: boolean;
  dismissMergeNotice: () => void;
  /** Set when a syncToDb write AND its one automatic retry both failed. The
   * Cart screen surfaces a small non-blocking notice + manual retry when
   * this is true. Cleared on the next successful sync. Local cart state is
   * never lost while this is true — only the server copy is behind. */
  syncFailed: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  reconcile: (fresh: { productId: string; price: number; stock: number }[]) => void;
  clearCart: () => void;
  /** Cancels any pending debounced syncToDb writes and scheduled retries,
   * for every user, without performing them. Used on sign-out so a stale
   * in-flight write can't resurrect the previous user's cart onto the next
   * signed-in user's row. */
  cancelSync: () => void;
  syncToDb: (userId: string) => Promise<void>;
  /** Clears any pending debounced/retry write for this user and performs the
   * sync immediately, but only if one is actually pending. No-ops otherwise
   * — used to flush on app background, where iOS can fire 'inactive' then
   * 'background' back to back and would otherwise write twice (once with
   * nothing to flush). */
  flushSync: (userId: string) => Promise<void>;
  /** Always performs a sync now, regardless of whether a timer is pending.
   * This is the manual retry affordance the Cart screen offers when
   * syncFailed is true — by that point both the original write and its one
   * automatic retry have already fired and cleared their timers, so
   * flushSync's "only if pending" guard would otherwise no-op here. */
  retrySync: (userId: string) => Promise<void>;
  loadFromDb: (userId: string) => Promise<void>;
  itemCount: () => number;
  subtotal: () => number;
}

// Keyed per userId so one user's cancel/schedule can never clear or collide
// with another user's pending write (e.g. across a fast sign-out/sign-in).
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      // Performs the actual upsert. On failure, schedules exactly one retry
      // 5s later; if that also fails, sets syncFailed so the UI can surface
      // it. Never throws — a sync failure must never lose local cart state.
      async function performSync(userId: string, isRetry = false) {
        const { items } = get();
        const { error } = await supabase
          .from('carts')
          .upsert({ user_id: userId, items: items as any, updated_at: new Date().toISOString() });

        if (!error) {
          retryTimers.delete(userId);
          set({ syncFailed: false });
          return;
        }

        console.warn(`Cart syncToDb failed${isRetry ? ' (retry)' : ''}:`, error.message);

        if (isRetry) {
          // The one automatic retry also failed — surface it, but keep the
          // local cart exactly as-is.
          set({ syncFailed: true });
          return;
        }

        const existingRetry = retryTimers.get(userId);
        if (existingRetry) clearTimeout(existingRetry);
        const retryTimer = setTimeout(() => {
          retryTimers.delete(userId);
          void performSync(userId, true);
        }, 5000);
        retryTimers.set(userId, retryTimer);
      }

      return {
      items: [],
      mergeNotice: false,
      syncFailed: false,

      dismissMergeNotice: () => set({ mergeNotice: false }),

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

      // Also resets syncFailed — both sign-out paths (store/auth.ts signOut
      // and _layout.tsx's signed-in-to-signed-out hydrate transition) route
      // through clearCart(), and syncFailed is otherwise a module-independent
      // boolean that would leak the outgoing user's failure notice onto the
      // next signed-in user's Cart screen.
      clearCart: () => set({ items: [], syncFailed: false }),

      cancelSync: () => {
        for (const t of debounceTimers.values()) clearTimeout(t);
        debounceTimers.clear();
        for (const t of retryTimers.values()) clearTimeout(t);
        retryTimers.clear();
      },

      syncToDb: async (userId) => {
        const existing = debounceTimers.get(userId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          debounceTimers.delete(userId);
          void performSync(userId);
        }, 800);
        debounceTimers.set(userId, timer);
      },

      flushSync: async (userId) => {
        const debounceT = debounceTimers.get(userId);
        const retryT = retryTimers.get(userId);
        if (!debounceT && !retryT) return; // nothing pending — avoid a redundant write
        if (debounceT) {
          clearTimeout(debounceT);
          debounceTimers.delete(userId);
        }
        if (retryT) {
          clearTimeout(retryT);
          retryTimers.delete(userId);
        }
        await performSync(userId);
      },

      retrySync: async (userId) => {
        const debounceT = debounceTimers.get(userId);
        const retryT = retryTimers.get(userId);
        if (debounceT) {
          clearTimeout(debounceT);
          debounceTimers.delete(userId);
        }
        if (retryT) {
          clearTimeout(retryT);
          retryTimers.delete(userId);
        }
        await performSync(userId);
      },

      loadFromDb: async (userId) => {
        const { data, error } = await supabase
          .from('carts')
          .select('items')
          .eq('user_id', userId)
          .single();

        // PGRST116 = "no rows" from .single() — a brand-new user with no
        // cart row yet, which is a genuinely empty cart, not a fetch error.
        // Any other error (network, RLS, transient 5xx) must never clobber
        // local state: log it and leave the local cart untouched, skipping
        // the merge entirely rather than writing back an empty result.
        if (error && error.code !== 'PGRST116') {
          console.warn('Cart loadFromDb failed:', error.message);
          return;
        }

        const remote = (data?.items as unknown as CartItem[]) ?? [];
        if (remote.length === 0) return;

        set((state) => {
          const local = state.items;
          const merged = new Map<string, CartItem>();
          // Local first so its metadata (price/name/image) wins on a
          // duplicate key — the local copy is whatever the shopper has been
          // looking at this session, so it's the freshest.
          for (const item of [...local, ...remote]) {
            const k = cartKey(item);
            const existing = merged.get(k);
            if (!existing) {
              merged.set(k, item);
            } else {
              merged.set(k, {
                ...existing,
                // Cap against the CHOSEN (local-preferred, `existing`)
                // item's stock, not the remote item's — `existing` is the
                // metadata that actually won the merge above.
                quantity: Math.min(Math.max(existing.quantity, item.quantity), existing.stock),
              });
            }
          }
          const mergedItems = Array.from(merged.values());

          // Only surface the banner when the merge actually changed
          // something visible vs. the pre-merge local cart — a different
          // item count, or a bumped quantity on an existing line.
          const localByKey = new Map(local.map((i) => [cartKey(i), i]));
          const changed =
            mergedItems.length !== local.length ||
            mergedItems.some((i) => (localByKey.get(cartKey(i))?.quantity ?? 0) !== i.quantity);

          return { items: mergedItems, mergeNotice: changed };
        });
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      };
    },
    {
      name: 'litways-cart',
      storage: createJSONStorage(() => storageAdapter()),
      // Only persist the items array — methods are not serializable
      partialize: (state) => ({ items: state.items }),
    }
  )
);
