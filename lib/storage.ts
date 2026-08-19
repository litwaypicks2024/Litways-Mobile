import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_RECENT_KEY = 'litways-search-recent';
const ONBOARDED_KEY = 'litways-onboarded';

// One-time onboarding flag. New installs see the intro once; returning users skip it.
export const onboarding = {
  hasSeen: async (): Promise<boolean> => {
    try {
      return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
    } catch {
      return false;
    }
  },
  markSeen: async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    } catch {}
  },
};

// AsyncStorage-backed Zustand persist adapter.
// Works in Expo Go and in dev/production builds.
export function storageAdapter() {
  return {
    getItem: (name: string) => AsyncStorage.getItem(name),
    setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
    removeItem: (name: string) => AsyncStorage.removeItem(name),
  };
}

// Async recent-search helpers used by shop.tsx.
export const recentSearches = {
  get: async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(SEARCH_RECENT_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  },
  save: async (term: string): Promise<void> => {
    try {
      const current = await recentSearches.get();
      const updated = [term, ...current.filter((s) => s !== term)].slice(0, 8);
      await AsyncStorage.setItem(SEARCH_RECENT_KEY, JSON.stringify(updated));
    } catch {}
  },
};
