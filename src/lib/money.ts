export const ETSY_TRANSACTION_RATE = 0.065;
export const ETSY_PAYMENT_RATE = 0.03;
export const ETSY_PAYMENT_FIXED = 0.25;
/** Etsy Offsite Ads: 15% of an attributed sale. Opted out 19 September 2026 — keep off. Pressroom runs a capped Meta daily budget instead. Prices still survive a leftover Offsite hit. */
export const OFFSITE_ADS_RATE = 0.15;
/** Keep at least this share of listing price after marketplace fees, print, and a worst-case Offsite hit. */
export const TARGET_AFTER_ADS_MARGIN = 0.4;
/** Shop Manager → Marketing → Offsite Ads. Opted out 19 September 2026. Do not turn back on. */
export const ETSY_OFFSITE_ADS_ENABLED = false;
export const ETSY_OFFSITE_OPTED_OUT_ON = "19 September 2026";
/** On-site Etsy Ads are CPC. Keep them off so spend never runs without a sale. */
export const ETSY_CPC_ADS_ENABLED = false;

export const SHOPIFY_PAYMENT_RATE = 0.029;
export const SHOPIFY_PAYMENT_FIXED = 0.3;

export function shopifyFees(itemTotal: number, shippingPaid: number) {
  return (itemTotal + shippingPaid) * SHOPIFY_PAYMENT_RATE + SHOPIFY_PAYMENT_FIXED;
}

export function etsyFees(itemTotal: number, shippingPaid: number) {
  const taxable = itemTotal + shippingPaid;
  return taxable * ETSY_TRANSACTION_RATE + taxable * ETSY_PAYMENT_RATE + ETSY_PAYMENT_FIXED;
}

export function orderCogs(
  items: Array<{ quantity: number; gelatoUnitCost?: number; listingId: string }>,
  listings: Array<{ id: string; gelatoUnitCost: number }>,
  shippingCost: number,
) {
  const print = items.reduce((sum, item) => {
    const listing = listings.find((l) => l.id === item.listingId);
    const unit = item.gelatoUnitCost ?? listing?.gelatoUnitCost ?? 0;
    return sum + unit * item.quantity;
  }, 0);
  return print + shippingCost;
}

export function orderProfit(input: {
  subtotal: number;
  shippingPaid: number;
  items: Array<{ quantity: number; listingId: string }>;
  listings: Array<{ id: string; gelatoUnitCost: number }>;
  gelatoShipping: number;
  channel?: "etsy" | "shopify" | "fernora";
}) {
  const fees =
    input.channel === "shopify"
      ? shopifyFees(input.subtotal, input.shippingPaid)
      : input.channel === "fernora"
        ? 0
        : etsyFees(input.subtotal, input.shippingPaid);
  const cogs = orderCogs(input.items, input.listings, input.gelatoShipping);
  const net = input.subtotal + input.shippingPaid - fees - cogs;
  return { fees, cogs, net };
}

export function listingFees(price: number) {
  return etsyFees(price, 0) - ETSY_PAYMENT_FIXED + ETSY_PAYMENT_FIXED;
}

export function listingNet(price: number, unitCost: number, shippingCost: number) {
  const fees = etsyFees(price, shippingCost);
  return price + shippingCost - fees - unitCost - shippingCost;
}

export function offsiteAdsFee(itemTotal: number, shippingPaid: number, rate = OFFSITE_ADS_RATE) {
  return (itemTotal + shippingPaid) * rate;
}

export function destinationEconomics(
  price: number,
  printCost: number,
  shipping: number,
  adsRate = 0,
) {
  const marketplace = etsyFees(price, shipping);
  const ads = offsiteAdsFee(price, shipping, adsRate);
  const fees = marketplace + ads;
  const net = price + shipping - fees - printCost - shipping;
  const margin = price > 0 ? net / price : 0;
  return { fees: marketplace, ads, printCost, shipping, net, margin };
}

export function recommendedPrice(
  unitCost: number,
  shippingCost: number,
  targetMargin = TARGET_AFTER_ADS_MARGIN,
  adsRate = OFFSITE_ADS_RATE,
) {
  const stack = ETSY_TRANSACTION_RATE + ETSY_PAYMENT_RATE + adsRate + targetMargin;
  const denominator = 1 - stack;
  const extraOnShip = shippingCost * (ETSY_TRANSACTION_RATE + ETSY_PAYMENT_RATE + adsRate);
  const raw = (unitCost + extraOnShip + ETSY_PAYMENT_FIXED) / denominator;
  return Math.ceil(raw) - 0.01;
}

export function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
