const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://litwaypicks.com';

export const momoAPI = {
  async initiatePayment(payload: object) {
    const res = await fetch(`${BASE_URL}/api/momo/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? 'Payment initiation failed');
    }
    return res.json() as Promise<{ referenceId: string; externalId: string }>;
  },

  // SECURITY (backend handoff — not fixable client-side): this endpoint is
  // unauthenticated and `referenceId` is enumerable/guessable, so any caller
  // can poll another customer's order status (including the embedded `order`
  // object) with no ownership check. The backend must require the caller to
  // be the authenticated order owner (or a single-use polling token) before
  // returning this data. See wave1-security.md finding for lib/api.ts:17.
  async checkStatus(referenceId: string) {
    const res = await fetch(`${BASE_URL}/api/momo/status/${referenceId}`);
    if (!res.ok) throw new Error('Status check failed');
    return res.json() as Promise<{ status: string; order?: object }>;
  },

  // SECURITY (backend handoff — not fixable client-side): this endpoint is
  // unauthenticated and `referenceId` is enumerable/guessable (IDOR), so any
  // caller can fetch another customer's full order + PII (name, email, phone,
  // delivery address, totals, line items) with no ownership check. The
  // backend must require the caller to be the authenticated order owner (or
  // present a one-time possession token minted at payment-initiation) before
  // returning this data. See wave1-security.md finding for lib/api.ts:23.
  async getOrder(referenceId: string) {
    const res = await fetch(`${BASE_URL}/api/momo/order/${referenceId}`);
    if (!res.ok) throw new Error('Order fetch failed');
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
