import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

/**
 * Keeps a small allow-listed slice of the query cache on disk so a cold start
 * paints the last-seen shelves immediately and refreshes them in the
 * background, instead of opening on skeletons every launch.
 *
 * Only public catalogue queries are listed. Anything user-specific (orders,
 * profile, active order) is deliberately left out. Bounded by construction:
 * only queries alive in the cache are written, and the cache holds a handful
 * of small card lists.
 */
const STORAGE_KEY = 'litways-query-cache-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WRITE_DELAY_MS = 1500;
const PERSISTED = new Set(['home-feed', 'categories', 'picked-for-you', 'category-rail']);

const isPersisted = (key: readonly unknown[]) => PERSISTED.has(String(key[0]));

/** Load the saved cache into the client. Never throws; a bad or old copy is just ignored. */
export async function restoreQueryCache(client: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { savedAt: number; state: ReturnType<typeof dehydrate> };
    if (Date.now() - saved.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    hydrate(client, saved.state);
  } catch {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
}

/** Write the allow-listed slice shortly after the cache changes. Returns an unsubscribe. */
export function persistQueryCache(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    timer = null;
    try {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (q) => q.state.status === 'success' && isPersisted(q.queryKey),
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state })).catch(() => {});
    } catch {}
  };
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (!timer) timer = setTimeout(write, WRITE_DELAY_MS);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
