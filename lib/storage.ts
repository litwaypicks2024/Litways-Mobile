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

const PENDING_PAYMENT_KEY = 'litways-pending-payment';

export interface PendingPayment {
  referenceId: string;
  createdAt: number;
}

// Tracks a MoMo payment from the moment initiatePayment() returns a
// referenceId until a terminal outcome is known. checkout.tsx's realtime
// subscription + polling only track this in memory, so if the OS kills the
// app mid-poll the reference would otherwise be lost — the cart is never
// cleared until a terminal state is reached, so the shopper could end up
// re-attempting (and being double-charged for) a payment that already went
// through. Persisting it here lets app/_layout.tsx offer to resume checking
// its status on the next cold start (see the 'You have a payment in
// progress' prompt).
export const pendingPayment = {
  save: async (record: PendingPayment): Promise<void> => {
    try {
      await AsyncStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(record));
    } catch {}
  },
  get: async (): Promise<PendingPayment | null> => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
      return raw ? (JSON.parse(raw) as PendingPayment) : null;
    } catch {
      return null;
    }
  },
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
    } catch {}
  },
};

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
  remove: async (term: string): Promise<void> => {
    try {
      const current = await recentSearches.get();
      await AsyncStorage.setItem(SEARCH_RECENT_KEY, JSON.stringify(current.filter((s) => s !== term)));
    } catch {}
  },
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(SEARCH_RECENT_KEY);
    } catch {}
  },
};

const PAYMENT_ATTEMPT_KEY = 'litways-payment-attempt';

/**
 * Written BEFORE the pay request leaves the phone and cleared once we know the
 * outcome. If the connection drops after the request was sent but before the
 * reply arrived, the server may have created the order and sent the MoMo prompt
 * while the app never learned the reference. This record is what lets the next
 * Pay tap look for that order first instead of creating a second one.
 */
export const paymentAttempt = {
  save: async (startedAt: number): Promise<void> => {
    try {
      await AsyncStorage.setItem(PAYMENT_ATTEMPT_KEY, JSON.stringify({ startedAt }));
    } catch {}
  },
  get: async (): Promise<{ startedAt: number } | null> => {
    try {
      const raw = await AsyncStorage.getItem(PAYMENT_ATTEMPT_KEY);
      return raw ? (JSON.parse(raw) as { startedAt: number }) : null;
    } catch {
      return null;
    }
  },
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(PAYMENT_ATTEMPT_KEY);
    } catch {}
  },
};
