import { useCallback, useMemo, useMemo as useMemoReact } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { shortOrderId } from '@/lib/orderStatus';
import { formatCurrency } from '@/lib/currency';
import { useAuthStore } from '@/store/auth';
import { useInboxStore, type InboxItem } from '@/store/inbox';
import { useWishlistStore } from '@/store/wishlist';

/* ── Order updates: read live from the server, one item per order ─────────────── */

interface OrderRow {
  id: string;
  external_id: string;
  payment_status: string;
  created_at: string | null;
  updated_at: string | null;
  payment_confirmed_at: string | null;
  failure_reason: string | null;
  final_total: number;
}

/**
 * The orders table only carries the current state (no history), so each order
 * contributes ONE item describing where it is now, timed at its last change. A
 * change of state gets a new id, so it shows up as a fresh, unread update.
 */
export function orderEvent(o: OrderRow): InboxItem | null {
  const ref = shortOrderId(o.external_id);
  const created = o.created_at ? Date.parse(o.created_at) : Date.now();
  const updated = o.updated_at ? Date.parse(o.updated_at) : created;
  const base = { id: `order:${o.id}:${o.payment_status}`, kind: 'order' as const, href: `/order/${o.id}` };
  switch (o.payment_status) {
    case 'PENDING':
      return { ...base, at: created, title: 'Waiting for your payment', body: `Approve the MoMo prompt on your phone to finish order ${ref}.` };
    case 'SUCCESSFUL':
      return { ...base, at: o.payment_confirmed_at ? Date.parse(o.payment_confirmed_at) : updated, title: 'Payment received', body: `Order ${ref} · ${formatCurrency(o.final_total)}. We're preparing it now.` };
    case 'COMPLETED':
      return { ...base, at: updated, title: 'Order complete', body: `Order ${ref} is complete. Tell us how it was.` };
    case 'FAILED':
      return { ...base, at: updated, title: "Payment didn't go through", body: o.failure_reason ? `${o.failure_reason}. Nothing was charged.` : `Order ${ref} wasn't paid, so nothing was charged.` };
    case 'REFUNDED':
      return { ...base, at: updated, title: 'Order refunded', body: `Order ${ref} was refunded.` };
    case 'DISPUTED':
      return { ...base, at: updated, title: 'Order in dispute', body: `We're looking into order ${ref}. We'll be in touch.` };
    default:
      return null;
  }
}

export const INBOX_ORDERS_KEY = 'inbox-orders';
export const INBOX_SERVER_KEY = 'inbox-server';

/* ── Server inbox (public.notifications), when the migration is applied ───────── */

interface ServerRow {
  id: string;
  kind: InboxItem['kind'];
  title: string;
  body: string;
  href: string | null;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
}

/** Server ids are prefixed so they can't collide with local ones and are easy to route. */
export const SERVER_PREFIX = 'srv:';
const isServerId = (id: string) => id.startsWith(SERVER_PREFIX);
const rawId = (id: string) => id.slice(SERVER_PREFIX.length);

/** "The table isn't there yet" (migration not applied) as opposed to a real failure. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message ?? '');
}

/**
 * The shopper's server-side notifications. `undefined` while loading, `null`
 * when the table doesn't exist yet (the app then derives order updates itself),
 * otherwise the rows. Failures other than a missing table are treated like a
 * missing table for display so the inbox never goes blank because of a hiccup.
 */
function useServerRows() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [INBOX_SERVER_KEY, userId],
    enabled: !!userId,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<ServerRow[] | null> => {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('id, kind, title, body, href, image_url, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (isMissingTable(error)) return null;
        throw error;
      }
      return (data ?? []) as unknown as ServerRow[];
    },
  });
}

function useOrderEvents(): InboxItem[] {
  const userId = useAuthStore((s) => s.user?.id);
  const { data } = useQuery({
    queryKey: [INBOX_ORDERS_KEY, userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, external_id, payment_status, created_at, updated_at, payment_confirmed_at, failure_reason, final_total')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });
  return useMemo(() => (data ?? []).map(orderEvent).filter((x): x is InboxItem => !!x), [data]);
}

/* ── The merged inbox ─────────────────────────────────────────────────────────── */

export interface InboxEntry extends InboxItem {
  unread: boolean;
}

export function useInbox() {
  const derivedOrders = useOrderEvents();
  const server = useServerRows();
  const local = useInboxStore((s) => s.items);
  const read = useInboxStore((s) => s.read);
  const deleted = useInboxStore((s) => s.deleted);

  const serverRows = server.data ?? null;
  // Once the table exists it is the source of truth for order updates, so the
  // ones derived from `orders` step aside (they'd be duplicates). While the
  // table is missing (or failed), the derived ones keep the inbox working.
  const serverActive = Array.isArray(serverRows);
  const orderItems = serverActive ? [] : derivedOrders;

  const entries = useMemoReact<InboxEntry[]>(() => {
    const fromServer: InboxEntry[] = (serverRows ?? []).map((r) => ({
      id: SERVER_PREFIX + r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      at: Date.parse(r.created_at),
      href: r.href ?? undefined,
      imageUrl: r.image_url ?? undefined,
      unread: !r.read_at,
    }));
    const fromDevice: InboxEntry[] = [...orderItems, ...local]
      .filter((i) => !deleted[i.id])
      .map((i) => ({ ...i, unread: !read[i.id] }));
    return [...fromServer, ...fromDevice].sort((a, b) => b.at - a.at);
  }, [serverRows, orderItems, local, read, deleted]);

  const unreadCount = useMemoReact(() => entries.filter((e) => e.unread).length, [entries]);
  return { entries, unreadCount, derivedOrderIds: derivedOrders.map((o) => o.id) };
}

/**
 * Read / unread / delete for an entry, routed to wherever it lives: server rows
 * are updated in the database (optimistically, and put back if that fails);
 * device rows in the local store.
 */
export function useInboxActions() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const key = useMemoReact(() => [INBOX_SERVER_KEY, userId], [userId]);

  const patchCache = useCallback(
    (fn: (rows: ServerRow[]) => ServerRow[]) => {
      queryClient.setQueryData<ServerRow[] | null>(key, (rows) => (rows ? fn(rows) : rows));
    },
    [queryClient, key]
  );
  const resync = useCallback(() => void queryClient.invalidateQueries({ queryKey: [INBOX_SERVER_KEY] }), [queryClient]);

  const setRead = useCallback(
    (ids: string[], read: boolean) => {
      const local = ids.filter((i) => !isServerId(i));
      const server = ids.filter(isServerId).map(rawId);
      if (local.length) {
        const store = useInboxStore.getState();
        if (read) store.markRead(local);
        else local.forEach((id) => store.markUnread(id));
      }
      if (server.length) {
        const at = read ? new Date().toISOString() : null;
        patchCache((rows) => rows.map((r) => (server.includes(r.id) ? { ...r, read_at: at } : r)));
        void supabase
          .from('notifications' as any)
          .update({ read_at: at })
          .in('id', server)
          .then(({ error }) => { if (error) resync(); });
      }
    },
    [patchCache, resync]
  );

  const remove = useCallback(
    (id: string) => {
      if (!isServerId(id)) return useInboxStore.getState().remove(id);
      const uuid = rawId(id);
      patchCache((rows) => rows.filter((r) => r.id !== uuid));
      void supabase
        .from('notifications' as any)
        .delete()
        .eq('id', uuid)
        .then(({ error }) => { if (error) resync(); });
    },
    [patchCache, resync]
  );

  const clearAll = useCallback(
    (derivedOrderIds: string[]) => {
      useInboxStore.getState().clearAll(derivedOrderIds);
      if (!userId) return;
      patchCache(() => []);
      void supabase
        .from('notifications' as any)
        .delete()
        .eq('user_id', userId)
        .then(({ error }) => { if (error) resync(); });
    },
    [patchCache, resync, userId]
  );

  return {
    markRead: (ids: string[]) => setRead(ids, true),
    markUnread: (id: string) => setRead([id], false),
    remove,
    clearAll,
  };
}

export function useUnreadCount(): number {
  return useInbox().unreadCount;
}

/* ── Saved-item alerts: price drops and back-in-stock, detected on this device ─── */

const CHECK_EVERY_MS = 30 * 60_000;
const MAX_ALERTS_PER_CHECK = 5;

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

/**
 * Compares each saved item with the live catalogue. A drop in the effective
 * price or a sold-out item returning to stock becomes an inbox alert, and the
 * saved snapshot is brought up to date so the same change never alerts twice.
 * Throttled, and silent when offline or when the shopper turned alerts off.
 */
export async function checkSavedItems(force = false): Promise<void> {
  const inbox = useInboxStore.getState();
  if (!inbox.alertsEnabled) return;
  if (!force && Date.now() - inbox.lastSavedCheck < CHECK_EVERY_MS) return;
  const saved = useWishlistStore.getState().items;
  if (saved.length === 0) return;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, price, sale_price, stock')
      .in('id', saved.map((i) => i.productId));
    if (error || !data) return;
    const live = new Map(data.map((p) => [p.id, p]));

    let alerts = 0;
    const updated = saved.map((item) => {
      const p = live.get(item.productId);
      if (!p) return item;
      const livePrice = p.sale_price ?? p.price;
      const savedPrice = item.salePrice ?? item.price;
      const fresh = { ...item, price: p.price, salePrice: p.sale_price ?? undefined, stock: p.stock };
      const common = { at: Date.now(), href: `/product/${item.slug}`, imageUrl: item.imageUrl };
      if (alerts < MAX_ALERTS_PER_CHECK && item.stock <= 0 && p.stock > 0) {
        useInboxStore.getState().add({ ...common, id: `stock:${item.productId}:${day()}`, kind: 'stock', title: 'Back in stock', body: `${item.name} is available again. Grab it before it sells out.` });
        alerts++;
      } else if (alerts < MAX_ALERTS_PER_CHECK && p.stock > 0 && livePrice < savedPrice) {
        useInboxStore.getState().add({ ...common, id: `price:${item.productId}:${livePrice}`, kind: 'price', title: 'Price drop on a saved item', body: `${item.name} is now ${formatCurrency(livePrice)}, down from ${formatCurrency(savedPrice)}.` });
        alerts++;
      }
      return fresh;
    });

    useWishlistStore.setState({ items: updated });
    useInboxStore.getState().setLastSavedCheck(Date.now());
  } catch {
    // Offline or a transient error: try again on the next foreground.
  }
}

/* ── Display helpers ──────────────────────────────────────────────────────────── */

export type InboxSection = 'Today' | 'Yesterday' | 'This week' | 'Earlier';

export function sectionOf(at: number, now = Date.now()): InboxSection {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (at >= startOfToday) return 'Today';
  if (at >= startOfToday - 86_400_000) return 'Yesterday';
  if (at >= startOfToday - 6 * 86_400_000) return 'This week';
  return 'Earlier';
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
