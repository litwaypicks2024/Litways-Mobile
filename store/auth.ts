import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '@/types';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('fetchProfile: failed to load profile', error);
      set({ profile: null });
      return;
    }
    set({ profile: data });
  },

  signOut: async () => {
    // Flush any pending cart sync for the outgoing user BEFORE signing out —
    // clearCart() below wipes local state, so anything not written by then
    // is lost for good. Best-effort, one-shot: if syncFailed is already set
    // (the original write AND its one automatic retry both failed),
    // flushSync's "only if pending" guard would no-op since neither timer is
    // still running — use retrySync's always-performs-now semantics for one
    // last attempt instead. Either way, never block sign-out on this.
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      const cart = useCartStore.getState();
      try {
        if (cart.syncFailed) {
          await cart.retrySync(userId);
        } else {
          await cart.flushSync(userId);
        }
      } catch {
        // Best-effort only — proceed with sign-out regardless.
      }
    }
    // Cancel any pending debounced cart sync so a stale write from the
    // outgoing user can't land after we've cleared local state.
    useCartStore.getState().cancelSync();
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
    // Purge local cart/wishlist so the next sign-in on this device doesn't
    // merge/see this user's items — cross-account data leak on shared
    // devices (wave2b-ux-flows.md).
    useCartStore.getState().clearCart();
    useWishlistStore.getState().clear();
  },
}));
