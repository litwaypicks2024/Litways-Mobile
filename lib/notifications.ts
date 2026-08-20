import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Push notifications require a dev/production build — they are not available in Expo Go.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

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
    return token;
  } catch {
    return null;
  }
}

export async function savePushToken(userId: string, token: string) {
  if (IS_EXPO_GO) return;
  try {
    const { supabase } = await import('./supabase');
    // BACKEND HANDOFF: types/database.types.ts's public.users table has no
    // push_token (or similar) column, so this is the only place a token is
    // ever written today. The backend must either (a) read Expo push tokens
    // from auth.users.raw_user_meta_data.push_token — this write location —
    // or (b) add a queryable column/table (e.g. push_tokens: user_id, token,
    // device_id, platform) and this function should be pointed at it
    // instead. Not fixable client-side without that confirmation.
    await supabase.auth.updateUser({ data: { push_token: token } });
  } catch {}
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
