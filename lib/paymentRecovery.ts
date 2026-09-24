import { momoAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { pendingPayment } from '@/lib/storage';
import { useCartStore } from '@/store/cart';

/** A payment reference older than this that is still unresolved is dropped (the order stays in Orders). */
const PENDING_PAYMENT_MAX_AGE_MS = 30 * 60 * 1000;
/** Unreachable for a whole day: stop carrying the record around. */
const PENDING_PAYMENT_HARD_TTL_MS = 24 * 60 * 60 * 1000;

const isSuccess = (s?: string | null) => ['SUCCESSFUL', 'COMPLETED'].includes((s ?? '').toUpperCase());
const isFailure = (s?: string | null) => ['FAILED', 'DISPUTED'].includes((s ?? '').toUpperCase());

export type EarlierOrder =
  | { kind: 'found'; referenceId: string }
  /** Reached the server and there is no such order: the earlier request never landed. */
  | { kind: 'none' }
  /** Couldn't reach the server, so we can't say either way. */
  | { kind: 'unreachable' };

/**
 * Looks for an unpaid order this shopper created since `startedAt` (small
 * grace for clock skew). Used after a pay request whose reply was lost: if the
 * order exists we adopt it instead of creating a second one.
 */
export async function findEarlierPendingOrder(userId: string, startedAt: number): Promise<EarlierOrder> {
  const since = new Date(startedAt - 60_000).toISOString();
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('reference_id, created_at')
      .eq('user_id', userId)
      .eq('payment_status', 'PENDING')
      .gte('created_at', since)
      .not('reference_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { kind: 'unreachable' };
    const ref = data?.[0]?.reference_id;
    return ref ? { kind: 'found', referenceId: ref } : { kind: 'none' };
  } catch {
    return { kind: 'unreachable' };
  }
}

export type PendingOutcome =
  | { kind: 'none' }
  | { kind: 'success' }
  | { kind: 'failed' }
  | { kind: 'pending'; referenceId: string }
  /** Couldn't ask (offline / signed out): the record is kept for next time. */
  | { kind: 'unknown'; referenceId: string };

/**
 * Settles a payment that was left in flight (app killed, phone died, closed
 * mid-wait). Asks the server for its status and finishes the job locally: a
 * paid order empties the cart (so the shopper isn't left looking at a full cart
 * and tempted to buy again), a failed one just clears the record.
 */
export async function resolvePendingPayment(): Promise<PendingOutcome> {
  const record = await pendingPayment.get();
  if (!record) return { kind: 'none' };
  const age = Date.now() - record.createdAt;
  if (age > PENDING_PAYMENT_HARD_TTL_MS) {
    await pendingPayment.clear();
    return { kind: 'none' };
  }

  let status: string;
  try {
    status = (await momoAPI.checkStatus(record.referenceId)).status;
  } catch {
    // Offline, or signed out (401/403): can't ask right now, so keep the record for next launch.
    return { kind: 'unknown', referenceId: record.referenceId };
  }

  if (isSuccess(status)) {
    useCartStore.getState().clearCart();
    await pendingPayment.clear();
    return { kind: 'success' };
  }
  if (isFailure(status)) {
    await pendingPayment.clear();
    return { kind: 'failed' };
  }
  if (age > PENDING_PAYMENT_MAX_AGE_MS) {
    // Still unpaid after half an hour: stop nagging. The order remains in Orders.
    await pendingPayment.clear();
    return { kind: 'none' };
  }
  return { kind: 'pending', referenceId: record.referenceId };
}
