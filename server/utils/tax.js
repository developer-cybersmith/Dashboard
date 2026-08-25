/** GST applied on project income — only when currency is INR. */
export const GST_RATE = 0.18;

/** TDS deducted from project income — only when currency is INR. */
export const TDS_RATE = 0.1;

function round2(n) {
  return parseFloat((Number(n) || 0).toFixed(2));
}

function isInr(currency) {
  return !currency || currency === 'INR';
}

/**
 * Amount used for INR Value (before FX conversion):
 * - INR:     Income + GST − TDS
 * - Non-INR: Income as-is (no GST/TDS)
 */
export function netOfIncome(income, currency = 'INR') {
  const i = Number(income) || 0;
  if (!isInr(currency)) return round2(i);
  return round2(i + i * GST_RATE - i * TDS_RATE);
}
