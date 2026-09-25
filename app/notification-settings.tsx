import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, Switch, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { alertDialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/Toast';
import { ListGroup, ListRow } from '@/components/account/ListRow';
import { useInbox } from '@/lib/inbox';
import { getPermissionState, registerForPushNotifications, type PermissionState } from '@/lib/notifications';
import { useInboxStore } from '@/store/inbox';
import { color, gutter, spacing } from '@/theme/tokens';

const STATUS: Record<PermissionState, { title: string; body: string }> = {
  granted: { title: 'Push notifications are on', body: 'You will hear about payments, deliveries and saved items as they happen.' },
  undetermined: { title: 'Push notifications are off', body: 'Turn them on to hear about payments and deliveries the moment they happen.' },
  denied: { title: 'Push notifications are off', body: 'They are switched off for Litway Picks in your phone settings.' },
  unavailable: { title: 'Push notifications are unavailable', body: "This build can't receive push notifications (Expo Go and some simulators can't)." },
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderIds } = useInbox();
  const alertsEnabled = useInboxStore((s) => s.alertsEnabled);
  const [perm, setPerm] = useState<PermissionState>('unavailable');

  useFocusEffect(
    useCallback(() => {
      void getPermissionState().then(setPerm);
    }, [])
  );

  async function enable() {
    if (perm === 'denied') {
      void Linking.openSettings();
      return;
    }
    await registerForPushNotifications();
    setPerm(await getPermissionState());
  }

  function clearAll() {
    alertDialog('Clear all notifications?', 'This empties your inbox. New updates will still arrive.', [
      { text: 'Clear all', style: 'destructive', onPress: () => { useInboxStore.getState().clearAll(orderIds); showToast({ title: 'Inbox cleared', tone: 'success' }); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const status = STATUS[perm];
  const on = perm === 'granted';

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Notification settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing['2xl'] }} showsVerticalScrollIndicator={false}>
        <View style={{ marginHorizontal: gutter, marginTop: spacing.lg, backgroundColor: color.surface, borderRadius: 20, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: on ? '#dcfce7' : color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={on ? 'notifications' : 'notifications-off-outline'} size={20} color={on ? '#166534' : color.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{status.title}</Text>
            <Text variant="caption" tone="body" style={{ marginTop: 2 }}>{status.body}</Text>
            {(perm === 'undetermined' || perm === 'denied') && (
              <View style={{ alignSelf: 'flex-start', marginTop: spacing.md }}>
                <Button title={perm === 'denied' ? 'Open Settings' : 'Turn on'} onPress={enable} size="sm" />
              </View>
            )}
          </View>
        </View>

        <ListGroup title="In your inbox">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.lg }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="receipt-outline" size={19} color={color.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Order updates</Text>
              <Text variant="meta" tone="muted">Payment and delivery news. Always on.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.lg }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pricetag-outline" size={19} color={color.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Saved-item alerts</Text>
              <Text variant="meta" tone="muted">Price drops and restocks on your Favorites.</Text>
            </View>
            <Switch
              value={alertsEnabled}
              onValueChange={(v) => useInboxStore.getState().setAlertsEnabled(v)}
              trackColor={{ false: color.border, true: color.accentFill }}
              thumbColor="#fff"
              accessibilityLabel="Saved-item alerts"
            />
          </View>
        </ListGroup>

        <ListGroup>
          <ListRow icon="trash-outline" label="Clear all notifications" danger noChevron onPress={clearAll} />
        </ListGroup>

        <Text variant="meta" tone="muted" style={{ marginHorizontal: gutter + 4, marginTop: spacing.lg }}>
          Offers and recommendations arrive as push notifications when you allow them, and are kept in your inbox so you can find them later.
        </Text>
      </ScrollView>
    </View>
  );
}
