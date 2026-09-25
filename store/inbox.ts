import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';

/**
 * The notification inbox's local half. Order updates are read live from the
 * `orders` table (see lib/inbox.ts) and never stored here; what IS stored is
 * everything the server can't give back later: pushes this device received and
 * saved-item alerts (price drop / back in stock) this device detected, plus the
 * read and deleted state for every item, order updates included.
 */

export type InboxKind = 'order' | 'stock' | 'price' | 'promo' | 'system';

export interface InboxItem {
  /** Stable and deduplicating: `order:<id>:<status>`, `push:<identifier>`, `stock:<product>:<day>`, … */
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  /** Epoch ms. */
  at: number;
  /** Where tapping goes (an in-app path). */
  href?: string;
  imageUrl?: string;
}

const MAX_ITEMS = 100;
const MAX_STATE = 400;

/** Keep the newest `max` entries of an id → timestamp map. */
function trimMap<T extends number | true>(m: Record<string, T>, max: number): Record<string, T> {
  const keys = Object.keys(m);
  if (keys.length <= max) return m;
  return Object.fromEntries(keys.slice(keys.length - max).map((k) => [k, m[k]]));
}

interface InboxState {
  items: InboxItem[];
  /** id → when it was read. */
  read: Record<string, number>;
  deleted: Record<string, true>;
  /** Local saved-item alerts (price drops, back in stock). Order updates are always shown. */
  alertsEnabled: boolean;
  lastSavedCheck: number;

  add: (item: InboxItem) => void;
  markRead: (ids: string[]) => void;
  markUnread: (id: string) => void;
  remove: (id: string) => void;
  clearAll: (orderIds: string[]) => void;
  setAlertsEnabled: (on: boolean) => void;
  setLastSavedCheck: (t: number) => void;
}

export const useInboxStore = create<InboxState>()(
  persist(
    (set) => ({
      items: [],
      read: {},
      deleted: {},
      alertsEnabled: true,
      lastSavedCheck: 0,

      add: (item) =>
        set((s) => {
          if (s.items.some((i) => i.id === item.id) || s.deleted[item.id]) return s;
          return { items: [item, ...s.items].sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS) };
        }),

      markRead: (ids) =>
        set((s) => {
          const now = Date.now();
          const next = { ...s.read };
          ids.forEach((id) => { if (!next[id]) next[id] = now; });
          return { read: trimMap(next, MAX_STATE) };
        }),

      markUnread: (id) =>
        set((s) => {
          const { [id]: _drop, ...rest } = s.read;
          return { read: rest };
        }),

      remove: (id) =>
        set((s) => ({
          items: s.items.filter((i) => i.id !== id),
          deleted: trimMap({ ...s.deleted, [id]: true as const }, MAX_STATE),
        })),

      // Order updates come from the server, so "clear" hides them by id rather than deleting them.
      clearAll: (orderIds) =>
        set((s) => ({
          items: [],
          deleted: trimMap({ ...s.deleted, ...Object.fromEntries(orderIds.map((id) => [id, true as const])) }, MAX_STATE),
        })),

      setAlertsEnabled: (on) => set({ alertsEnabled: on }),
      setLastSavedCheck: (t) => set({ lastSavedCheck: t }),
    }),
    {
      name: 'litways-inbox',
      storage: createJSONStorage(() => storageAdapter()),
      partialize: (s) => ({ items: s.items, read: s.read, deleted: s.deleted, alertsEnabled: s.alertsEnabled, lastSavedCheck: s.lastSavedCheck }),
    }
  )
);
