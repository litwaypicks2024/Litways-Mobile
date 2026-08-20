import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storageAdapter } from '@/lib/storage';

// Device-local record of "this order/product pair already got a review from
// this shopper", so the account.tsx review chip can stay disabled after a
// successful submit instead of inviting a duplicate (the server still
// rejects duplicates as a backstop — see ReviewModal.handleSubmit).
function reviewKey(orderId: string, productId: string): string {
  return `${orderId}:${productId}`;
}

interface ReviewedState {
  keys: string[];
  markReviewed: (orderId: string, productId: string) => void;
  isReviewed: (orderId: string, productId: string) => boolean;
}

export const useReviewedStore = create<ReviewedState>()(
  persist(
    (set, get) => ({
      keys: [],

      markReviewed: (orderId, productId) => {
        const key = reviewKey(orderId, productId);
        set((state) => (state.keys.includes(key) ? state : { keys: [...state.keys, key] }));
      },

      isReviewed: (orderId, productId) => get().keys.includes(reviewKey(orderId, productId)),
    }),
    {
      name: 'litways-reviewed',
      storage: createJSONStorage(() => storageAdapter()),
      partialize: (state) => ({ keys: state.keys }),
    }
  )
);
