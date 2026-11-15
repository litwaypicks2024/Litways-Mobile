import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Lightweight activity tracking for the admin Analytics page.
 *
 * Writes one row to public.app_events per action. No personal data is sent:
 * each install gets a random id, plus the user id when signed in. Purchases
 * are not tracked here; the dashboard reads them from paid orders.
 *
 * Tracking must never break or slow the app, so every call is fire-and-forget
 * and swallows its own errors.
 */

export type TrackedEvent = 'app_open' | 'product_view' | 'add_to_cart' | 'checkout_start';

const ANON_ID_KEY = 'litways-analytics-id';
// Ignore an identical event fired again within this window (re-renders,
// adding several units of one product in a row).
const DEDUPE_MS = 5_000;
// A new "app open" counts only after the app has been away this long.
const APP_OPEN_GAP_MS = 30 * 60_000;

let anonIdPromise: Promise<string> | null = null;
const lastSent = new Map<string, number>();
let lastAppOpen = 0;

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function getAnonId(): Promise<string> {
  if (!anonIdPromise) {
    anonIdPromise = (async () => {
      try {
        const existing = await AsyncStorage.getItem(ANON_ID_KEY);
        if (existing) return existing;
        const id = randomId();
        await AsyncStorage.setItem(ANON_ID_KEY, id);
        return id;
      } catch {
        return randomId();
      }
    })();
  }
  return anonIdPromise;
}

const platform: 'ios' | 'android' | 'web' =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

export function track(event: TrackedEvent, productId?: string | null): void {
  const key = `${event}:${productId ?? ''}`;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < DEDUPE_MS) return;
  lastSent.set(key, now);

  void (async () => {
    try {
      const anonId = await getAnonId();
      // Read from the Supabase client (local, no network) rather than the auth
      // store: the cart store imports this module, and the auth store imports
      // the cart store, so importing it here would create a cycle.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const { error } = await supabase.from('app_events').insert({
        event,
        platform,
        anon_id: anonId,
        user_id: userId,
        product_id: productId ?? null,
      });
      if (error && __DEV__) console.warn('analytics:', error.message);
    } catch {
      // never surface tracking failures
    }
  })();
}

/** Call on launch and whenever the app returns to the foreground. */
export function trackAppOpen(): void {
  const now = Date.now();
  if (now - lastAppOpen < APP_OPEN_GAP_MS) return;
  lastAppOpen = now;
  track('app_open');
}
