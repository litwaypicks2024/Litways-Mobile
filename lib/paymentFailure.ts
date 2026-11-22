/**
 * Plain-language explanation of why a MoMo payment failed. Mirrors
 * public.describe_payment_failure() in the database so the inbox, order list
 * and emails all say the same thing. Never shows MTN's raw codes.
 */
export function describePaymentFailure(reason: string | null | undefined, ref = 'this order'): string {
  const r = (reason ?? '').toUpperCase();
  if ((reason ?? '').toLowerCase().startsWith('amount mismatch')) {
    return `We received a payment that doesn't match the total for ${ref}. Our team will contact you to sort it out.`;
  }
  if (r.includes('NOT_ENOUGH_FUNDS')) return `Your MoMo balance wasn't enough for ${ref}. Nothing was charged. Top up and try again.`;
  if (r.includes('LIMIT')) return 'This payment is over your MoMo transaction limit. Nothing was charged.';
  if (/REJECT|DECLIN|CANCEL/.test(r)) return 'The payment was declined on your phone, so nothing was charged. You can try again anytime.';
  if (/EXPIRE|TIMEOUT|TIMED OUT/.test(r)) return "The MoMo prompt wasn't approved in time, so nothing was charged. You can try again.";
  if (r.includes('PAYER_NOT_FOUND')) return "That phone number isn't registered for MTN MoMo. Nothing was charged.";
  return `${ref.charAt(0).toUpperCase()}${ref.slice(1)} wasn't paid, so nothing was charged. You can try again.`;
}
