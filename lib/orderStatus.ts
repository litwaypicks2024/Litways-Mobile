import type { Ionicons } from '@expo/vector-icons';

/**
 * How an order's payment_status reads to a shopper. The data only carries
 * payment status (no fulfilment tracking), so PENDING/SUCCESSFUL are both
 * "in progress" and COMPLETED is the finished state.
 */

export type OrderGroup = 'progress' | 'completed' | 'cancelled';

export interface OrderStatusInfo {
  label: string;
  group: OrderGroup;
  icon: keyof typeof Ionicons.glyphMap;
  /** Pill background / text / icon colours. */
  bg: string;
  fg: string;
}

const INFO: Record<string, OrderStatusInfo> = {
  PENDING: { label: 'Awaiting payment', group: 'progress', icon: 'time-outline', bg: '#fef3c7', fg: '#92400e' },
  SUCCESSFUL: { label: 'Paid · preparing', group: 'progress', icon: 'checkmark-circle-outline', bg: '#dbeafe', fg: '#1e40af' },
  DISPUTED: { label: 'In dispute', group: 'progress', icon: 'alert-circle-outline', bg: '#fef3c7', fg: '#92400e' },
  COMPLETED: { label: 'Completed', group: 'completed', icon: 'checkmark-circle', bg: '#dcfce7', fg: '#166534' },
  FAILED: { label: 'Payment failed', group: 'cancelled', icon: 'close-circle-outline', bg: '#fee2e2', fg: '#991b1b' },
  REFUNDED: { label: 'Refunded', group: 'cancelled', icon: 'return-down-back-outline', bg: '#e5e7eb', fg: '#374151' },
};

const FALLBACK: OrderStatusInfo = { label: 'Unknown', group: 'progress', icon: 'help-circle-outline', bg: '#e5e7eb', fg: '#374151' };

export function orderStatus(paymentStatus: string | null | undefined): OrderStatusInfo {
  return INFO[paymentStatus ?? ''] ?? FALLBACK;
}

/** "ORDER-0642ca57-6b9d-…" → "#0642CA57": the readable head of the id, not the whole UUID. */
export function shortOrderId(externalId: string | null | undefined): string {
  const parts = (externalId ?? '').split('-');
  const head = parts[0].toUpperCase() === 'ORDER' ? parts[1] : parts[0];
  return `#${(head ?? '').toUpperCase()}`;
}
