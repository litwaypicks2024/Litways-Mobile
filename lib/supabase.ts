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

// Supabase's default GoTrue storage key (we never override `storageKey`), used
// by the AsyncStorage adapter this file previously used. Existing signed-in
// users have a live session sitting under this key — the migration below
// moves it into SecureStore on first read so nobody gets signed out.
const LEGACY_ASYNC_STORAGE_KEY = 'supabase.auth.token';

const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const existing = await getChunkedItem(key);
    if (existing !== null) return existing;

    // One-time migration: fall back to the old AsyncStorage value (unencrypted),
    // then copy it into SecureStore and delete the AsyncStorage copy so future
    // reads go through the encrypted path only.
    if (key === LEGACY_ASYNC_STORAGE_KEY) {
      const legacyValue = await AsyncStorage.getItem(key);
      if (legacyValue !== null) {
        await setChunkedItem(key, legacyValue);
        await AsyncStorage.removeItem(key);
        return legacyValue;
      }
    }
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await setChunkedItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await removeChunkedItem(key);
    if (key === LEGACY_ASYNC_STORAGE_KEY) {
      await AsyncStorage.removeItem(key).catch(() => {});
    }
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
