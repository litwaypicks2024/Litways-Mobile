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
