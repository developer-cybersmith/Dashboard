/**
 * Currency conversion service using ExchangeRate-API v6.
 * Rates are cached in-memory for 1 hour to avoid redundant API calls.
 * Only called when a project is created, its income changes, or its currency changes.
 */

const API_KEY = process.env.EXCHANGE_RATE_API_KEY || 'cdf56eb8b100704e0b242cd4';
const BASE_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}`;

// In-memory rate cache: { 'USD->INR': { rate, fetchedAt } }
const rateCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(from) {
  return `${from}->INR`;
}

async function fetchRateFromAPI(fromCurrency) {
  const url = `${BASE_URL}/pair/${fromCurrency}/INR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ExchangeRate-API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  if (data.result !== 'success') {
    throw new Error(`ExchangeRate-API: ${data['error-type'] ?? 'unknown error'}`);
  }
  return data.conversion_rate;
}

async function getExchangeRate(fromCurrency) {
  if (!fromCurrency || fromCurrency === 'INR') return 1;

  const key  = cacheKey(fromCurrency);
  const hit  = rateCache.get(key);
  const now  = Date.now();

  if (hit && (now - hit.fetchedAt) < CACHE_TTL_MS) {
    console.log(`[Currency] Cache hit for ${fromCurrency}->INR: ${hit.rate}`);
    return hit.rate;
  }

  console.log(`[Currency] Fetching live rate for ${fromCurrency}->INR…`);
  const rate = await fetchRateFromAPI(fromCurrency);
  rateCache.set(key, { rate, fetchedAt: now });
  console.log(`[Currency] ${fromCurrency}->INR = ${rate} (cached 1h)`);
  return rate;
}

/**
 * Convert an amount in any currency to INR.
 * @param {number} amount  - The original amount in fromCurrency
 * @param {string} fromCurrency - ISO 4217 currency code (e.g. 'USD', 'EUR')
 * @returns {{ exchangeRate, amountINR, exchangeRateUpdatedAt }}
 */
export async function convertCurrencyToINR(amount, fromCurrency) {
  if (!fromCurrency || fromCurrency === 'INR') {
    return {
      exchangeRate:          1,
      amountINR:             Number(amount) || 0,
      exchangeRateUpdatedAt: new Date(),
    };
  }

  const exchangeRate = await getExchangeRate(fromCurrency);
  // Keep full 2-decimal paise precision — no rounding
  const amountINR    = parseFloat(((Number(amount) || 0) * exchangeRate).toFixed(2));
  return { exchangeRate, amountINR, exchangeRateUpdatedAt: new Date() };
}

/**
 * Check whether a project's currency conversion needs to be (re)calculated.
 * Returns true if income or currency changed, or if amountINR is missing.
 */
export function needsConversion(incoming, existing) {
  if (!existing) return true;
  if (!incoming.currency || incoming.currency === 'INR') return false; // INR is always income
  return (
    incoming.income    !== existing.income    ||
    incoming.currency  !== existing.currency  ||
    existing.amountINR == null
  );
}
