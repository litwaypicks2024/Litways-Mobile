import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { INBOX_ORDERS_KEY, checkSavedItems } from '@/lib/inbox';
import { addReceivedListener, addResponseListener, getPresentedNotifications } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth';
import { useInboxStore, type InboxItem, type InboxKind } from '@/store/inbox';

const ALLOWED_SCREENS = ['/product/', '/category/', '/confirmation', '/order/', '/orders', '/notifications', '/(tabs)'];
const KINDS: InboxKind[] = ['order', 'stock', 'price', 'promo', 'system'];

/** Turns an Expo notification into an inbox item (same id whether it's seen live, tapped or found in the tray). */
function toItem(n: any): InboxItem {
  const req = n?.request;
  const content = req?.content ?? {};
  const data = (content.data ?? {}) as Record<string, string>;
  const screen = typeof data.screen === 'string' && ALLOWED_SCREENS.some((p) => data.screen.startsWith(p)) ? data.screen : undefined;
  const kind: InboxKind = KINDS.includes(data.type as InboxKind)
    ? (data.type as InboxKind)
    : screen?.startsWith('/confirmation') || screen?.startsWith('/order') ? 'order' : 'promo';
  return {
    id: `push:${req?.identifier ?? `${content.title}:${n?.date}`}`,
    kind,
    title: content.title || 'Litway Picks',
    body: content.body || '',
    at: typeof n?.date === 'number' ? n.date * 1000 : Date.now(),
    href: screen,
  };
}

/**
 * Mounted once at the root. Keeps the inbox current without a screen being
 * open: refreshes order updates when an order changes, captures pushes
 * (including ones that arrived while the app was closed), and checks saved
 * items for price drops and restocks.
 */
export function InboxSync() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  // An order changed (payment confirmed, failed, …): refresh the derived updates.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: [INBOX_ORDERS_KEY] });
      })
      .subscribe();
    return () => {
      void channel.unsubscribe();
    };
  }, [userId, queryClient]);

  useEffect(() => {
    const { add, markRead } = useInboxStore.getState();

    async function importTray() {
      const presented = await getPresentedNotifications();
      presented.forEach((n) => add(toItem(n)));
    }
    void importTray();
    const t = setTimeout(() => void checkSavedItems(), 4000);

    const foreground = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void importTray();
      void checkSavedItems();
      void queryClient.invalidateQueries({ queryKey: [INBOX_ORDERS_KEY] });
    });
    const offReceived = addReceivedListener((n) => add(toItem(n)));
    // Tapping a push means they've seen it: file it as read.
    const offResponse = addResponseListener((r) => {
      const item = toItem(r?.notification);
      add(item);
      markRead([item.id]);
    });

    return () => {
      clearTimeout(t);
      foreground.remove();
      offReceived();
      offResponse();
    };
  }, [queryClient]);

  return null;
}
