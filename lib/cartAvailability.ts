import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { refreshAvailability, useCartStore } from '@/store/cart';
import type { CartItem } from '@/types';

/** What changed in the cart when it was checked against live stock and prices. */
export interface AvailabilityReport {
  /** Names of items that are sold out or gone from the catalogue (removed). */
  removed: string[];
  /** Items whose quantity was lowered to what's left. */
  reduced: { name: string; to: number }[];
  /** Items whose price moved. */
  repriced: string[];
}

const keyOf = (i: Pick<CartItem, 'productId' | 'size' | 'color'>) => `${i.productId}::${i.size ?? ''}::${i.color ?? ''}`;

/**
 * Checks the cart against live stock and price and applies the result, so a
 * guest's stale cart (nothing else revalidates it before the pay tap) is
 * corrected while they can still act on it. Returns what changed, or null when
 * nothing did or the check couldn't run (offline): a failed check must never
 * touch the cart or claim anything.
 */
export async function checkCartAvailability(): Promise<AvailabilityReport | null> {
  const before = useCartStore.getState().items;
  if (before.length === 0) return null;
  try {
    const { items: after } = await refreshAvailability(before);
    // The shopper edited the cart while the query ran: skip, the next check will catch up.
    if (useCartStore.getState().items !== before) return null;

    const afterByKey = new Map(after.map((i) => [keyOf(i), i]));
    const report: AvailabilityReport = { removed: [], reduced: [], repriced: [] };
    for (const item of before) {
      const next = afterByKey.get(keyOf(item));
      if (!next) report.removed.push(item.name);
      else {
        if (next.quantity < item.quantity) report.reduced.push({ name: item.name, to: next.quantity });
        if (next.price !== item.price) report.repriced.push(item.name);
      }
    }
    const changed = report.removed.length + report.reduced.length + report.repriced.length > 0;
    // Stock counts refresh even when nothing visible changed, so "Only 2 left" stays truthful,
    // but an identical cart isn't rewritten (that would trigger a needless server sync).
    const beforeByKey = new Map(before.map((i) => [keyOf(i), i]));
    const drifted = after.some((i) => {
      const old = beforeByKey.get(keyOf(i));
      return !old || old.stock !== i.stock || old.price !== i.price || old.listPrice !== i.listPrice;
    });
    if (changed || drifted) useCartStore.setState({ items: after });
    return changed ? report : null;
  } catch {
    return null;
  }
}

/**
 * Runs the availability check whenever the screen gains focus (throttled), and
 * exposes the latest report so a banner can explain what changed.
 */
export function useCartAvailability(minIntervalMs = 20_000) {
  const [report, setReport] = useState<AvailabilityReport | null>(null);
  const last = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - last.current < minIntervalMs) return;
      last.current = Date.now();
      void checkCartAvailability().then((r) => {
        if (mounted.current && r) setReport(r);
      });
    }, [minIntervalMs])
  );

  return { report, dismiss: () => setReport(null) };
}
