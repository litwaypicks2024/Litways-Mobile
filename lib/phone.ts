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

/** MTN Liberia (Lonestar Cell MTN) is the only operator that can receive a
 *  MoMo collection prompt — mirrors the server's MTN_PREFIXES check so the
 *  shopper hears it before paying, not after. National numbers start 55/88
 *  (dialled locally as 055…/088…). */
export function isMtnMobile(input: string): boolean {
  const n = normalizeLiberianPhone(input);
  const national = n.slice(3);
  return /^(55|88)\d{7}$/.test(national);
}
