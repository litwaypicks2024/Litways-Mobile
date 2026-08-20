import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@/types';
import { supabase } from '@/lib/supabase';
import { storageAdapter } from '@/lib/storage';

function cartKey(item: Pick<CartItem, 'productId' | 'size' | 'color'>): string {
  return `${item.productId}::${item.size ?? ''}::${item.color ?? ''}`;
}

/**
 * The `carts` table (`{ user_id, items: jsonb[] }`) is shared with the web
 * app, but the two apps have never agreed on an item shape. A row can be any
 * of three shapes:
 *
 *   MOBILE (this app writes):
 *     { productId, name, brand, price, imageUrl, size?, color?, quantity,
 *       stock, slug }
 *     `price` is already the effective (discounted) price.
 *
 *   WEB (lib/cart-context.jsx in the web repo):
 *     { ...product, cartKey, selectedSize, selectedColor, quantity }
 *     i.e. id, name, brand, price, sale_price?, image_urls[], images[],
 *     slug, stock, sizes, colors, category, … plus cartKey (composite of
 *     [id, size, color]) and selectedSize/selectedColor (null when unset).
 *     Web's own cart total uses `sale_price ?? price` — `price` alone is
 *     the pre-discount list price.
 *
 *   LEGACY WEB (pre-cartKey web rows): same as WEB but without
 *     cartKey/selectedSize/selectedColor.
 *
 * `fromWire`/`toWire` are the adapter pair that lets this store read and
 * write any of the three without the merge engine below ever seeing a raw
 * wire shape — it only ever operates on normalized `CartItem`s. There is no
 * shared contract between the two apps yet (web-side canonicalization onto
 * one shape is a later follow-up); until then `toWire` writes a SUPERSET of
 * fields so either app's reader finds what it expects in a row written by
 * the other.
 */

/**
 * Normalizes one raw `carts.items[]` entry (any of the three shapes above)
 * into a `CartItem`, or `null` if it's unusable (no id, or no positive
 * quantity) so the caller can filter it out rather than merge in garbage.
 */
export function fromWire(raw: any): CartItem | null {
  if (raw == null || typeof raw !== 'object') return null;

  const productId = raw.productId ?? raw.id;
  if (!productId) return null;

  const quantity = Number(raw.quantity);
  if (!(quantity > 0)) return null;

  const name = raw.name ?? '';
  const brand = raw.brand ?? '';
  const slug = raw.slug ?? '';

  // Mobile rows already carry the effective (post-discount) price in
  // `price`. Web rows carry the list price in `price` plus an optional
  // `sale_price` — the effective price is the lower of the two, mirroring
  // web's own `sale_price ?? price` total logic. `raw.productId` is the
  // mobile-only field, so its presence is what distinguishes the two.
  let price: number;
  if (raw.productId != null) {
    price = Number(raw.price) || 0;
  } else {
    const listPrice = raw.price;
    const salePrice = raw.sale_price;
    const effective = salePrice != null && salePrice < listPrice ? salePrice : listPrice;
    price = Number(effective) || 0;
  }

  const imageUrl = raw.imageUrl ?? raw.image_urls?.[0] ?? raw.images?.[0] ?? '';

  const rawSize = raw.size ?? raw.selectedSize;
  const size = rawSize === null || rawSize === '' || rawSize === undefined ? undefined : rawSize;
  const rawColor = raw.color ?? raw.selectedColor;
  const color = rawColor === null || rawColor === '' || rawColor === undefined ? undefined : rawColor;

  const stock = Number(raw.stock ?? 0);

  return { productId, name, brand, price, imageUrl, size, color, quantity, stock, slug };
}

/**
 * Serializes a normalized `CartItem` back into the wire superset both apps'
 * readers understand. `raw` — the original remote object this item was last
 * read from (see rawRemoteByCartKey below) — is spread first so any
 * web-only metadata (sizes, colors, category, …) survives a mobile
 * read-modify-write round-trip instead of being dropped.
 *
 * `sale_price` is always nulled out here, NOT preserved from `raw`: the
 * item's `price` already holds the effective (post-discount) price computed
 * by `fromWire`, and web's total reads `sale_price ?? price` — leaving a
 * stale `sale_price` in place would make web double-apply the discount.
 *
 * `image_urls`/`images` keep the raw row's full gallery when present (web
 * may have uploaded several images) and only fall back to a single-entry
 * array derived from `imageUrl` when the raw row had none.
 */
export function toWire(item: CartItem, raw?: Record<string, unknown>): Record<string, unknown> {
  const base = raw ?? {};
  const rawImageUrls = (base as { image_urls?: unknown }).image_urls;
  const rawImages = (base as { images?: unknown }).images;
  const imageUrls =
    Array.isArray(rawImageUrls) && rawImageUrls.length > 0 ? rawImageUrls : [item.imageUrl].filter(Boolean);
  const images = Array.isArray(rawImages) && rawImages.length > 0 ? rawImages : [item.imageUrl].filter(Boolean);

  return {
    ...base, // web-only metadata survives a mobile round-trip
    id: item.productId,
    productId: item.productId,
    name: item.name,
    brand: item.brand,
    slug: item.slug,
    stock: item.stock,
    quantity: item.quantity,
    price: item.price, // effective price; web reads sale_price ?? price
    sale_price: null, // never let a stale web sale_price override our effective price
    imageUrl: item.imageUrl,
    image_urls: imageUrls,
    images,
    size: item.size ?? null,
    color: item.color ?? null,
    selectedSize: item.size ?? null,
    selectedColor: item.color ?? null,
    cartKey: [item.productId, item.size, item.color].filter(Boolean).join('::') || item.productId,
  };
}

/**
 * Raw remote objects from the most recent loadFromDb/manualSync fetch,
 * keyed by the mobile cartKey() of their normalized CartItem. writeCartRow
 * consults this so an item that round-trips through this device still
 * carries whatever web-only fields it arrived with (see toWire above)
 * instead of losing them the moment mobile re-writes the row. Cleared on
 * clearCart so a stale entry can never leak metadata onto a different
 * user's or a brand-new item's write.
 */
const rawRemoteByCartKey = new Map<string, Record<string, unknown>>();

/**
 * Normalizes a raw remote `carts.items` array (any of the three wire
 * shapes) into CartItems via fromWire, dropping anything unparseable, and
 * refreshes rawRemoteByCartKey to reflect this — the most recent — fetch.
 */
function normalizeRemoteItems(rawItems: unknown[]): CartItem[] {
  rawRemoteByCartKey.clear();
  const result: CartItem[] = [];
  for (const raw of rawItems) {
    const item = fromWire(raw);
    if (!item) continue;
    result.push(item);
    if (raw && typeof raw === 'object') {
      rawRemoteByCartKey.set(cartKey(item), raw as Record<string, unknown>);
    }
  }
  return result;
}

/**
 * Three-way merges a cart across three snapshots: the last-synced BASE (what
 * this device and the server agreed on after the previous sync), the current
 * LOCAL cart, and the current REMOTE (server) cart. Per cartKey, the merged
 * quantity is:
 *
 *   qty = max(0, baseQty + (localQty - baseQty) + (remoteQty - baseQty))
 *
 * i.e. base plus the SUM OF EACH SIDE'S INDEPENDENT DELTA from base — not a
 * straight `local + remote`. The double-count trap that guards against: if
 * base already has 2 of an item and neither side touched it, `local + remote`
 * would report 4 (both copies of the same 2 counted again), while the
 * base+deltas form correctly reports 2 (delta 0 + delta 0). An independent
 * add on one side (local 2→3, remote unchanged at 2) still lands at 3 (delta
 * +1 + delta 0). Because every quantity is expressed as a delta from a
 * shared base, re-running the merge with nothing new on either side is a
 * no-op (both deltas are 0), and a removal on either side (delta walks down
 * to -baseQty) sticks instead of being resurrected by the other side's
 * untouched copy.
 *
 * The base MUST be scoped per-user (see lastSyncedUserId below) — a base
 * captured for a different account could reuse the same cartKeys to
 * describe an entirely different cart, corrupting the delta math here.
 *
 * Metadata (name/brand/price/imageUrl/slug/stock/size/color) prefers the
 * local entry, then remote, then base — local is whatever the shopper has
 * actually been looking at this session.
 */
export function threeWayMergeCarts(base: CartItem[], local: CartItem[], remote: CartItem[]): CartItem[] {
  const byKey = (list: CartItem[]) => {
    const map = new Map<string, CartItem>();
    for (const item of list) map.set(cartKey(item), item);
    return map;
  };
  const baseMap = byKey(base);
  const localMap = byKey(local);
  const remoteMap = byKey(remote);

  const keys = new Set<string>([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const result: CartItem[] = [];

  for (const key of keys) {
    const b = baseMap.get(key);
    const l = localMap.get(key);
    const r = remoteMap.get(key);
    const baseQty = b?.quantity ?? 0;
    const localQty = l?.quantity ?? 0;
    const remoteQty = r?.quantity ?? 0;
    const qty = Math.max(0, baseQty + (localQty - baseQty) + (remoteQty - baseQty));
    if (qty <= 0) continue;
    const meta = l ?? r ?? b!;
    result.push({ ...meta, quantity: qty });
  }

  return result;
}

/**
 * Revalidates surviving cart items against live catalog stock/price in a
 * single query. Used by manualSync only — NOT by loadFromDb, which needs to
 * stay fast and tolerant of the device being offline at sign-in; checkout
 * revalidates independently anyway before charging anyone.
 *
 * Missing product id or stock <= 0 drops the item (counted in `dropped`).
 * qty > live stock clamps to live stock (counted in `adjusted`). Surviving
 * items get their price refreshed to (sale_price ?? price) and stock to the
 * live value. Throws on a query error — the caller decides how to surface
 * that rather than this silently reporting an empty result.
 */
export async function refreshAvailability(
  items: CartItem[]
): Promise<{ items: CartItem[]; dropped: number; adjusted: number }> {
  if (items.length === 0) return { items: [], dropped: 0, adjusted: 0 };

  const ids = [...new Set(items.map((i) => i.productId))];
  const { data, error } = await supabase
    .from('products')
    .select('id, stock, price, sale_price')
    .in('id', ids);

  if (error) throw error;

  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  let dropped = 0;
  let adjusted = 0;
  const result: CartItem[] = [];

  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p || (p.stock ?? 0) <= 0) {
      dropped++;
      continue;
    }
    const liveStock = p.stock ?? 0;
    const livePrice = p.sale_price ?? p.price ?? item.price;
    const clampedQty = Math.min(item.quantity, liveStock);
    if (clampedQty !== item.quantity) adjusted++;
    result.push({ ...item, price: livePrice, stock: liveStock, quantity: clampedQty });
  }

  return { items: result, dropped, adjusted };
}

/**
 * Performs the carts upsert for an EXPLICIT items array. No retry
 * scheduling, no state mutation beyond the write itself — just the raw
 * write. Returns whether it succeeded; never throws. This is the single
 * upsert implementation shared by performSync's debounced/retry path and
 * manualSync's write-then-apply path below.
 */
async function writeCartRow(userId: string, items: CartItem[]): Promise<boolean> {
  const wireItems = items.map((item) => toWire(item, rawRemoteByCartKey.get(cartKey(item))));
  const { error } = await supabase
    .from('carts')
    .upsert({ user_id: userId, items: wireItems as any, updated_at: new Date().toISOString() });

  if (error) {
    console.warn('Cart write failed:', error.message);
    return false;
  }
  return true;
}

interface CartState {
  items: CartItem[];
  /** The three-way merge BASE: the item set this device and the server last
   * agreed on, captured after every successful loadFromDb/manualSync merge.
   * Persisted so it survives an app restart. */
  lastSyncedItems: CartItem[];
  /** Whose cart lastSyncedItems describes. A base captured for one account
   * must never be applied as the base for another — checked before every
   * merge (see manualSync/loadFromDb) and reset to null on clearCart. */
  lastSyncedUserId: string | null;
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
  /** True while a manualSync() is in flight — lets the Cart screen disable
   * the sync control and show a spinner instead of double-firing. */
  syncing: boolean;
  /** Human-readable outcome of the last manualSync() call — success (with
   * an honest description of what changed) or failure. The Cart screen
   * renders this in the same banner slot as mergeNotice. */
  syncNotice: string | null;
  dismissSyncNotice: () => void;
  /** Shopper-triggered three-way sync: fetches the server cart, merges it
   * with local against the shared base, revalidates availability, and
   * writes the merged result straight back to the server (in addition to
   * the debounced write the items-change already triggers). */
  manualSync: (userId: string) => Promise<void>;
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
      // Returns whether THIS attempt wrote successfully (a failed non-retry
      // attempt still returns false even though a retry is now pending) —
      // manualSync uses that to decide its own success/failure notice.
      async function performSync(userId: string, isRetry = false): Promise<boolean> {
        const ok = await writeCartRow(userId, get().items);

        if (ok) {
          retryTimers.delete(userId);
          set({ syncFailed: false });
          return true;
        }

        if (isRetry) {
          // The one automatic retry also failed — surface it, but keep the
          // local cart exactly as-is.
          console.warn('Cart syncToDb retry also failed');
          set({ syncFailed: true });
          return false;
        }

        const existingRetry = retryTimers.get(userId);
        if (existingRetry) clearTimeout(existingRetry);
        const retryTimer = setTimeout(() => {
          retryTimers.delete(userId);
          void performSync(userId, true);
        }, 5000);
        retryTimers.set(userId, retryTimer);
        return false;
      }

      return {
      items: [],
      lastSyncedItems: [],
      lastSyncedUserId: null,
      mergeNotice: false,
      syncFailed: false,
      syncing: false,
      syncNotice: null,

      dismissMergeNotice: () => set({ mergeNotice: false }),
      dismissSyncNotice: () => set({ syncNotice: null }),

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

      // Also resets syncFailed/syncNotice and the three-way merge base — both
      // sign-out paths (store/auth.ts signOut and _layout.tsx's
      // signed-in-to-signed-out hydrate transition) route through
      // clearCart(), and all of these are otherwise module-independent state
      // that would leak the outgoing user's cart/notices onto the next
      // signed-in user's Cart screen, or — worse, for the base — get used as
      // the merge base for a different account entirely.
      clearCart: () => {
        rawRemoteByCartKey.clear();
        set({ items: [], syncFailed: false, syncNotice: null, lastSyncedItems: [], lastSyncedUserId: null });
      },

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

      // Shopper-triggered sync (the header's "Sync cart" control). Unlike
      // the debounced auto-sync, this is a full three-way merge against the
      // shared base PLUS a live availability check, and it write-throughs
      // immediately rather than waiting on the debounce.
      manualSync: async (userId) => {
        if (get().syncing) return;
        set({ syncing: true });
        try {
          // A queued debounced write must not race the merge below — it
          // would read a half-merged `items` or clobber the merge result
          // right after this function sets it.
          get().cancelSync();

          const { data, error: fetchError } = await supabase
            .from('carts')
            .select('items')
            .eq('user_id', userId)
            .single();

          // PGRST116 = "no rows" — a brand-new user with no cart row yet,
          // a genuinely empty remote cart, not a fetch error.
          if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

          const remote = normalizeRemoteItems((data?.items as unknown[]) ?? []);
          const { items: local, lastSyncedItems, lastSyncedUserId } = get();
          // A base captured under a different account must never be used
          // here — its deltas would describe a different cart entirely.
          const base = lastSyncedUserId === userId ? lastSyncedItems : [];

          const merged = threeWayMergeCarts(base, local, remote);
          const { items: finalItems, dropped, adjusted } = await refreshAvailability(merged);

          // Write BEFORE applying anything locally. Availability-driven
          // drops/clamps must never land on the shopper's local cart unless
          // the server write actually succeeds — applying them first (the
          // old ordering) meant an offline shopper could watch items vanish
          // or shrink while the failure notice claimed nothing had happened.
          // On failure, items/lastSyncedItems/lastSyncedUserId are left
          // completely untouched below.
          const wrote = await writeCartRow(userId, finalItems);

          if (!wrote) {
            set({ syncNotice: "Couldn't sync your cart — check your connection and try again." });
            return;
          }

          set({ items: finalItems, lastSyncedItems: finalItems, lastSyncedUserId: userId });

          // The `set` above triggers _layout's items-subscriber, which
          // schedules a normal debounced syncToDb re-write of these same
          // (now-current) items — redundant since we just wrote them
          // ourselves, but idempotent and harmless, so no extra flush or
          // cancel is needed here.

          // Count keys whose quantity visibly changed vs. the pre-sync
          // local cart (added, bumped, or dropped) so the notice can be
          // honest about what actually moved.
          const localByKey = new Map(local.map((i) => [cartKey(i), i]));
          const finalKeys = new Set(finalItems.map((i) => cartKey(i)));
          let updatedCount = 0;
          for (const item of finalItems) {
            if ((localByKey.get(cartKey(item))?.quantity ?? 0) !== item.quantity) updatedCount++;
          }
          for (const item of local) {
            if (!finalKeys.has(cartKey(item))) updatedCount++;
          }

          let notice = updatedCount > 0
            ? `Cart synced — ${updatedCount} item${updatedCount === 1 ? '' : 's'} updated from your other devices`
            : 'Cart synced';
          const extras: string[] = [];
          if (adjusted > 0) extras.push(`${adjusted} adjusted to available stock`);
          if (dropped > 0) extras.push(`${dropped} no longer available`);
          if (extras.length > 0) notice += ' · ' + extras.join(' · ');

          set({ syncNotice: notice });
        } catch (err) {
          console.warn('Cart manualSync failed:', err instanceof Error ? err.message : err);
          // Do NOT touch `items` here — whatever local state already held
          // (pre-merge) is left exactly as-is on any failure path (fetch,
          // availability, or write all reach here without having called
          // `set` on items/lastSyncedItems/lastSyncedUserId).
          set({ syncNotice: "Couldn't sync your cart — check your connection and try again." });
        } finally {
          set({ syncing: false });
        }
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

        const remote = normalizeRemoteItems((data?.items as unknown[]) ?? []);

        set((state) => {
          const local = state.items;
          // Same per-user base rule as manualSync — a base from another
          // account must never apply here.
          const base = state.lastSyncedUserId === userId ? state.lastSyncedItems : [];
          const merged = threeWayMergeCarts(base, local, remote);

          // Only surface the banner when the merge actually changed
          // something visible vs. the pre-merge local cart — a different
          // item count, or a bumped quantity on an existing line.
          const localByKey = new Map(local.map((i) => [cartKey(i), i]));
          const changed =
            merged.length !== local.length ||
            merged.some((i) => (localByKey.get(cartKey(i))?.quantity ?? 0) !== i.quantity);

          return {
            items: merged,
            lastSyncedItems: merged,
            lastSyncedUserId: userId,
            mergeNotice: changed,
          };
        });
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      };
    },
    {
      name: 'litways-cart',
      storage: createJSONStorage(() => storageAdapter()),
      // Only persist serializable cart state — methods are excluded. The
      // merge base (lastSyncedItems/lastSyncedUserId) must survive an app
      // restart too, or the very next sync after a relaunch would fall back
      // to an empty base and risk re-summing quantities already agreed on.
      partialize: (state) => ({
        items: state.items,
        lastSyncedItems: state.lastSyncedItems,
        lastSyncedUserId: state.lastSyncedUserId,
      }),
    }
  )
);
