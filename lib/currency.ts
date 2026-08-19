export function formatCurrency(amount: number): string {
  const n = Number(amount);
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export function discountPercent(price: number, salePrice: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(((price - salePrice) / price) * 100);
}
