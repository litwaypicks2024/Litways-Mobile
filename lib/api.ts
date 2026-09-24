import { supabase } from '@/lib/supabase';

// www is canonical — the naked domain 307-redirects there; going direct
// avoids a redirect round-trip on every payment call.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://www.litwaypicks.com';

/**
 * All /api/momo/* endpoints require the authenticated order owner (verified
 * server-side against user_id / legacy customer_email, or admin). The mobile
 * app has no cookies, so it authenticates with the Supabase access token as
 * a Bearer header — see the web repo's lib/session.js getServerUser().
 */
/** Error carrying the HTTP status so callers can distinguish auth failures
 *  (401/403 — sign in / wrong account) from transient network trouble. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * The pay request may or may not have reached the server: the connection
 * dropped or timed out, or the server answered 5xx after possibly having created
 * the order. Distinct from a 4xx rejection, which is definitive (nothing was
 * created). Callers must NOT tell the shopper "it failed" or let them blindly
 * retry on this: check for an order first.
 */
export class PaymentUncertainError extends Error {
  constructor(message = 'Could not confirm the payment request') {
    super(message);
    this.name = 'PaymentUncertainError';
  }
}

// Long enough for a slow mobile link, short enough that a dead one doesn't spin forever.
const PAY_TIMEOUT_MS = 30_000;

export const momoAPI = {
  async initiatePayment(payload: object) {
    const headers = await authHeaders();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAY_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api/momo/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      // Offline, dropped mid-request, or timed out: the request may still have landed.
      throw new PaymentUncertainError();
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      if (res.status >= 500) throw new PaymentUncertainError();
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? (err as any).message ?? 'Payment initiation failed');
    }
    try {
      return (await res.json()) as { success: boolean; referenceId: string; orderId: string; amount: number };
    } catch {
      throw new PaymentUncertainError();
    }
  },

  async checkStatus(referenceId: string) {
    const res = await fetch(`${BASE_URL}/api/momo/status/${referenceId}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new ApiError('Status check failed', res.status);
    return res.json() as Promise<{ status: string; order?: object }>;
  },

  async getOrder(referenceId: string) {
    const res = await fetch(`${BASE_URL}/api/momo/order/${referenceId}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new ApiError('Order fetch failed', res.status);
    return res.json();
  },
};

export async function submitContactForm(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const res = await fetch(`${BASE_URL}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}
