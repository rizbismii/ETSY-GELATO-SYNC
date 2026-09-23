/**
 * Shop, Etsy, and catalog list prices are New Zealand dollars.
 * Printify’s dashboard always prefixes USD: retail cents are still the Etsy NZD
 * amount, while variant.cost is real USD production. Convert that cost to NZD
 * before pricing. Ignore the USD label on retail in Printify listing health.
 */

export const SHOP_CURRENCY = "NZD";

export const PRESENTMENT_CURRENCIES = ["NZD", "USD", "AUD", "GBP", "EUR"] as const;
export type PresentmentCurrency = (typeof PRESENTMENT_CURRENCIES)[number];

/**
 * NZD per 1 unit of presentment currency.
 * USD matches Printify catalog shipping (USD → shop NZD).
 * AUD / GBP / EUR are fixed crosses so Shopify Markets cannot drift off the cost table.
 */
export const NZD_PER_UNIT: Record<PresentmentCurrency, number> = {
  NZD: 1,
  USD: 1.67,
  AUD: 1.22,
  GBP: 2.2,
  EUR: 1.9,
};

export const PRINTIFY_USD_TO_NZD = NZD_PER_UNIT.USD;

export function isPresentmentCurrency(value?: string | null): value is PresentmentCurrency {
  return Boolean(value && PRESENTMENT_CURRENCIES.includes(value as PresentmentCurrency));
}

export function nzdPerUnit(currency?: string | null) {
  return isPresentmentCurrency(currency) ? NZD_PER_UNIT[currency] : NZD_PER_UNIT.USD;
}

export function usdToNzd(usd: number) {
  return Math.round(usd * PRINTIFY_USD_TO_NZD * 100) / 100;
}

/** Convert a shop-NZD amount into another currency without retail rounding. */
export function amountInCurrency(nzd: number, currency: string = SHOP_CURRENCY) {
  if (currency === SHOP_CURRENCY) return Math.round(nzd * 100) / 100;
  return Math.round((nzd / nzdPerUnit(currency)) * 100) / 100;
}

/** Customer list price: keep the catalog .99 ending after conversion. */
export function retailPriceInCurrency(nzd: number, currency: string = SHOP_CURRENCY) {
  if (currency === SHOP_CURRENCY) return nzd;
  return Math.ceil(nzd / nzdPerUnit(currency)) - 0.01;
}

/** Printify / Etsy list price in the destination shop currency, in cents. */
export function listCentsInCurrency(nzd: number, currency: string = SHOP_CURRENCY) {
  return Math.round(retailPriceInCurrency(nzd, currency) * 100);
}

/** Etsy-connected Printify shops publish this number in the Etsy shop currency (NZD). */
export function printifyListCents(priceNzd: number) {
  return listCentsInCurrency(priceNzd, SHOP_CURRENCY);
}
