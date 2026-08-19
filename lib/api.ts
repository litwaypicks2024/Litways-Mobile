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

  async checkStatus(referenceId: string) {
    const res = await fetch(`${BASE_URL}/api/momo/status/${referenceId}`);
    if (!res.ok) throw new Error('Status check failed');
    return res.json() as Promise<{ status: string; order?: object }>;
  },

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
