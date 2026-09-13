export const ETSY_TRANSACTION_RATE = 0.065;
export const ETSY_PAYMENT_RATE = 0.03;
export const ETSY_PAYMENT_FIXED = 0.25;

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
}) {
  const fees = etsyFees(input.subtotal, input.shippingPaid);
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

export function destinationEconomics(price: number, printCost: number, shipping: number) {
  const fees = etsyFees(price, shipping);
  const net = price + shipping - fees - printCost - shipping;
  const margin = price > 0 ? net / price : 0;
  return { fees, printCost, shipping, net, margin };
}

export function recommendedPrice(
  unitCost: number,
  shippingCost: number,
  targetMargin = 0.42,
) {
  const denominator = 1 - ETSY_TRANSACTION_RATE - ETSY_PAYMENT_RATE - targetMargin;
  const raw = (unitCost + shippingCost + ETSY_PAYMENT_FIXED) / denominator;
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
