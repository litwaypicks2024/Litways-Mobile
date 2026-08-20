import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Push notifications require a dev/production build — they are not available in Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Module-level cache of the last Expo push token this device obtained, so
// syncPushTokenForUser can (re-)upsert it against a user_id that only became
// available after registration ran (e.g. registration happened signed-out,
// then the shopper signed in later in the same app session).
let cachedPushToken: string | null = null;

// Lazy getter so we never import expo-notifications at module level in Expo Go.
function getNotifications() {
  return require('expo-notifications') as typeof import('expo-notifications');
}

function getDevice() {
  return require('expo-device') as typeof import('expo-device');
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO) return null;

  try {
    const Notifications = getNotifications();
    const Device = getDevice();

    if (!Device.isDevice) return null;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ea580c',
        sound: 'default',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    cachedPushToken = token;
    return token;
  } catch {
    return null;
  }
}

export async function savePushToken(userId: string, token: string) {
  if (IS_EXPO_GO) return;
  cachedPushToken = token;
  try {
    const { supabase } = await import('./supabase');
    // `public.push_tokens` (token PK, user_id, platform, updated_at; own-row
    // RLS) is now the canonical store for Expo push tokens — this is what
    // the backend reads to target a push. onConflict: 'token' because a
    // device token moving to a different signed-in user (shared device,
    // sign-out/sign-in) must reassign user_id on that same token row rather
    // than erroring or leaving the token pointed at the previous user.
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'token' }
      );
    if (error) console.warn('savePushToken: push_tokens upsert failed:', error.message);

    // Kept for backward compat with whatever may still read the token off
    // the user's metadata — push_tokens above is the source of truth now.
    await supabase.auth.updateUser({ data: { push_token: token } });
  } catch {}
}

// Handles the case where registerForPushNotifications() ran while signed
// out (or before a session existed) and a session only appears afterwards —
// without this, that device's token would never get an owning user_id in
// push_tokens. Cheap no-op when no token has been cached yet this session.
export async function syncPushTokenForUser(userId: string) {
  if (IS_EXPO_GO) return;
  if (!cachedPushToken) return;
  await savePushToken(userId, cachedPushToken);
}

export async function sendLocalNotification(title: string, body: string, data?: Record<string, unknown>) {
  if (IS_EXPO_GO) return;
  try {
    const Notifications = getNotifications();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: null,
    });
  } catch {}
}

// Cold start: the app was launched by tapping a notification. Unlike
// addNotificationResponseReceivedListener (foreground/background taps only),
// this is the only way to learn about the notification that launched a
// killed app. Expo caches this response until cleared, so the caller is
// responsible for only acting on it once (see _layout.tsx's ref guard).
export async function getLastNotificationResponse(): Promise<any | null> {
  if (IS_EXPO_GO) return null;
  try {
    const Notifications = getNotifications();
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}

// Proper React hook — adds listeners on mount, cleans up on unmount.
export function useNotificationListener(
  onResponse: (r: any) => void,
) {
  useEffect(() => {
    if (IS_EXPO_GO) return;
    try {
      const Notifications = getNotifications();
      const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
      return () => sub.remove();
    } catch {}
  }, []);
}
