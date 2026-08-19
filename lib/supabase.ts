import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// expo-secure-store caps each value at ~2048 bytes, but a Supabase session
// (access token + refresh token + user object, JSON-stringified) can exceed
// that comfortably. We chunk the serialized value across `key.0`, `key.1`, …
// entries plus a `key.count` entry recording how many chunks were written,
// and reassemble on read.
const CHUNK_SIZE = 2000;

async function getChunkedItem(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}.count`);
  if (countStr === null) return null;
  const count = parseInt(countStr, 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
    if (chunk === null) return null; // corrupted/partial write — treat as missing
    chunks.push(chunk);
  }
  return chunks.join('');
}

async function setChunkedItem(key: string, value: string): Promise<void> {
  // Clear any previously-written chunks first so a shorter new value doesn't
  // leave stale trailing chunks from a longer old value.
  await removeChunkedItem(key);

  const chunkCount = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < chunkCount; i++) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.${i}`, chunk);
  }
  await SecureStore.setItemAsync(`${key}.count`, String(chunkCount));
}

async function removeChunkedItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}.count`);
  const count = countStr ? parseInt(countStr, 10) : 0;
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}.count`);
}

// NOTE: we do NOT hardcode Supabase's default storage key. supabase-js
// (SupabaseClient, dist/index.cjs ~line 1208) computes it per-project as
// `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token` and passes
// that as `storageKey` to the auth client — it's whatever key this adapter
// is actually invoked with, not GoTrueClient's raw internal default. The
// adapter therefore migrates generically: on any SecureStore miss, it falls
// back to AsyncStorage using the SAME key it was called with, so existing
// sessions (under whatever key supabase-js derives) are picked up.
const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    let existing: string | null = null;
    try {
      existing = await getChunkedItem(key);
    } catch (e) {
      console.warn('[supabase] SecureStore read failed for', key, e);
    }
    if (existing !== null) return existing;

    // One-time migration: fall back to the old AsyncStorage value (unencrypted),
    // then copy it into SecureStore and delete the AsyncStorage copy so future
    // reads go through the encrypted path only.
    const legacyValue = await AsyncStorage.getItem(key).catch(() => null);
    if (legacyValue !== null) {
      try {
        await setChunkedItem(key, legacyValue);
        await AsyncStorage.removeItem(key);
      } catch (e) {
        // A failed SecureStore write (or AsyncStorage cleanup) during
        // migration must not lose the value we already read — the session
        // just won't be durably moved to SecureStore yet; it'll retry on
        // the next read/write.
        console.warn('[supabase] Failed to migrate legacy session into SecureStore for', key, e);
      }
      return legacyValue;
    }
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await setChunkedItem(key, value);
    } catch (e) {
      console.warn('[supabase] SecureStore write failed for', key, e);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await removeChunkedItem(key);
    } catch (e) {
      console.warn('[supabase] SecureStore remove failed for', key, e);
    }
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
