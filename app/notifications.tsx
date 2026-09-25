import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { alertDialog } from '@/components/ui/Dialog';
import { LottiePlayer } from '@/components/motion/LottiePlayer';
import { InboxRow } from '@/components/notifications/InboxRow';
import { InboxNotice } from '@/components/notifications/InboxNotice';
import { sectionOf, useInbox, useInboxActions, type InboxEntry, type InboxSection } from '@/lib/inbox';
import { getPermissionState, registerForPushNotifications, type PermissionState } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth';
import { color, gutter, radius, spacing } from '@/theme/tokens';

type Filter = 'all' | 'unread' | 'order' | 'alerts';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'order', label: 'Orders' },
  { key: 'alerts', label: 'Deals & alerts' },
];

type Row =
  | { type: 'header'; key: string; title: InboxSection }
  | { type: 'item'; key: string; entry: InboxEntry; first: boolean; last: boolean };

function matches(e: InboxEntry, f: Filter): boolean {
  if (f === 'unread') return e.unread;
  if (f === 'order') return e.kind === 'order';
  if (f === 'alerts') return e.kind !== 'order';
  return true;
}

/**
 * The notification inbox. Order updates come live from the server; pushes and
 * saved-item alerts (price drops, back in stock) are kept on this device. Grouped
 * by day, unread first in the eye via a tinted row and dot; tapping opens the
 * thing and files it as read.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { entries, unreadCount } = useInbox();
  const { markRead, markUnread, remove } = useInboxActions();
  const [filter, setFilter] = useState<Filter>('all');
  const [perm, setPerm] = useState<PermissionState>('unavailable');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getPermissionState().then(setPerm);
    }, [])
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const visible = entries.filter((e) => matches(e, filter));
    let lastSection: InboxSection | null = null;
    visible.forEach((entry, i) => {
      const section = sectionOf(entry.at);
      if (section !== lastSection) {
        out.push({ type: 'header', key: `h:${section}`, title: section });
        lastSection = section;
      }
      const prevSame = i > 0 && sectionOf(visible[i - 1].at) === section;
      const nextSame = i < visible.length - 1 && sectionOf(visible[i + 1].at) === section;
      out.push({ type: 'item', key: entry.id, entry, first: !prevSame, last: !nextSame });
    });
    return out;
  }, [entries, filter]);

  function open(entry: InboxEntry) {
    markRead([entry.id]);
    if (entry.href) router.push(entry.href as any);
  }

  function menu(entry: InboxEntry) {
    alertDialog(entry.title, undefined, [
      entry.unread
        ? { text: 'Mark as read', onPress: () => markRead([entry.id]) }
        : { text: 'Mark as unread', onPress: () => markUnread(entry.id) },
      { text: 'Delete', style: 'destructive', onPress: () => remove(entry.id) },
      { text: 'Cancel', style: 'cancel' },
    ], 'info');
  }

  async function enablePush() {
    if (perm === 'denied') {
      void Linking.openSettings();
      return;
    }
    await registerForPushNotifications();
    setPerm(await getPermissionState());
  }

  const showPushNotice = !bannerDismissed && (perm === 'undetermined' || perm === 'denied');
  const empty = entries.length === 0;

  const header = (
    <View style={{ paddingHorizontal: gutter, paddingTop: spacing.md }}>
      {showPushNotice ? (
        <InboxNotice
          icon="notifications-outline"
          title="Get updates the moment they happen"
          body={perm === 'denied' ? 'Notifications are off for Litway Picks in your phone settings.' : 'Payment confirmed, order on its way, saved items back in stock.'}
          actionLabel={perm === 'denied' ? 'Open Settings' : 'Turn on notifications'}
          onAction={enablePush}
          onDismiss={() => setBannerDismissed(true)}
        />
      ) : !user ? (
        <InboxNotice
          icon="person-circle-outline"
          title="Sign in to see order updates"
          body="Payment and delivery news for your orders shows up here."
          actionLabel="Sign in"
          onAction={() => router.push('/(auth)/login')}
        />
      ) : null}

      {!empty && (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    height: 36, paddingHorizontal: 14, borderRadius: radius.full, justifyContent: 'center',
                    backgroundColor: on ? color.ink : color.surface,
                    borderWidth: 1.5, borderColor: on ? color.ink : color.fieldBorder,
                  }}
                >
                  <Text variant="small" style={{ color: on ? color.onInk : color.ink }}>
                    {f.key === 'unread' && unreadCount > 0 ? `Unread · ${unreadCount}` : f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => markRead(entries.filter((e) => e.unread).map((e) => e.id))}
              accessibilityRole="button"
              hitSlop={8}
              style={{ alignSelf: 'flex-end', marginTop: spacing.md }}
            >
              <Text variant="small" tone="accent">Mark all as read</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        right={<IconButton icon="settings-outline" onPress={() => router.push('/notification-settings')} accessibilityLabel="Notification settings" />}
      />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['2xl'], flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <Text variant="overline" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, marginHorizontal: gutter + 4 }}>{item.title}</Text>
          ) : (
            <View style={{ marginHorizontal: gutter, overflow: 'hidden', borderTopLeftRadius: item.first ? radius.xl : 0, borderTopRightRadius: item.first ? radius.xl : 0, borderBottomLeftRadius: item.last ? radius.xl : 0, borderBottomRightRadius: item.last ? radius.xl : 0 }}>
              <InboxRow entry={item.entry} first={item.first} last={item.last} onPress={() => open(item.entry)} onMenu={() => menu(item.entry)} />
            </View>
          )
        }
        ListEmptyComponent={
          empty ? (
            <View style={{ alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing.xl }}>
              <LottiePlayer source={require('@/assets/lottie/inbox-empty.json')} size={220} label="A bell that has rung and settled: you're all caught up" />
              <Text variant="title" style={{ textAlign: 'center', marginTop: spacing.sm }}>You're all caught up</Text>
              <Text variant="bodyLg" tone="body" style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 }}>
                Order updates, price drops on saved items and offers will show up here.
              </Text>
              <View style={{ marginTop: spacing.xl }}>
                <Button title="Explore deals" variant="outline" onPress={() => router.push('/(tabs)/shop')} />
              </View>
            </View>
          ) : (
            <Text variant="body" tone="muted" style={{ textAlign: 'center', marginTop: spacing['3xl'] }}>Nothing here.</Text>
          )
        }
      />
    </View>
  );
}
