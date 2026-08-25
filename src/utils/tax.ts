/** GST applied on project income — only when currency is INR. */
export const GST_RATE = 0.18;

/** TDS deducted from project income — only when currency is INR. */
export const TDS_RATE = 0.1;

function round2(n: number): number {
  return parseFloat((Number(n) || 0).toFixed(2));
}

function isInr(currency?: string): boolean {
  return !currency || currency === 'INR';
}

/** GST amount = 18% of income when INR; otherwise 0. */
export function gstOf(income: number, currency = 'INR'): number {
  if (!isInr(currency)) return 0;
  return round2((Number(income) || 0) * GST_RATE);
}

/** TDS amount = 10% of income when INR; otherwise 0. */
export function tdsOf(income: number, currency = 'INR'): number {
  if (!isInr(currency)) return 0;
  return round2((Number(income) || 0) * TDS_RATE);
}

/**
 * Amount used for INR Value (before FX conversion):
 * - INR:     Income + GST − TDS  (= income × 1.08)
 * - Non-INR: Income as-is (no GST/TDS)
 */
export function netOfIncome(income: number, currency = 'INR'): number {
  const i = Number(income) || 0;
  if (!isInr(currency)) return round2(i);
  return round2(i + i * GST_RATE - i * TDS_RATE);
}
