// Liberian mobile-number helpers for MTN Mobile Money.
//
// Canonical wire format used when sending to the payment API: 231XXXXXXXX
// (international MSISDN, no '+'). If the MoMo backend expects a different
// format, change ONLY normalizeLiberianPhone — every caller goes through it.
// See docs/ACTION_ITEMS.md (confirm MoMo phone format).

export function normalizeLiberianPhone(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '');
  if (digits.startsWith('231')) return digits;
  if (digits.startsWith('0')) return '231' + digits.slice(1);
  return '231' + digits;
}

export function isValidLiberianMobile(input: string): boolean {
  const n = normalizeLiberianPhone(input);
  // 231 + 8–9 subscriber digits (length varies by carrier).
  return /^231\d{8,9}$/.test(n);
}
