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
    // Cancel any pending debounced cart sync first so a stale write from the
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
