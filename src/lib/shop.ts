import { LIVE_PRODUCTS, SHIP_BLURB, type LiveProduct } from "@/lib/live-catalog";
import { findClothingVariant, variantLabel } from "@/lib/clothing";
import {
  GELATO_COUNTRY_CODES,
  GELATO_SHIP_BLURB,
  gelatoCountryName,
  gelatoDestination,
  isGelatoCountry,
  shipLaneForCountry,
  type ShipLaneCode,
} from "@/lib/gelato-countries";
import type { Address, Order, OrderItem } from "@/lib/types";

export const FERNORA_NAME = "Fernora";
export const FERNORA_CURRENCY = "NZD";
/** ISO country codes Gelato delivers to (AU, NZ, and the rest of the catalog lanes). */
export const FERNORA_SHIP_COUNTRIES = GELATO_COUNTRY_CODES;
export type FernoraCountry = string;
export type FernoraShipLane = ShipLaneCode;

export const FERNORA_SHIP_BLURB = GELATO_SHIP_BLURB;

export function isFernoraCountry(value: string): boolean {
  return isGelatoCountry(value);
}

export function shopDescription(product: LiveProduct) {
  const stripped = product.description.replace(SHIP_BLURB, "").trim();
  return `${stripped} ${FERNORA_SHIP_BLURB}`.trim();
}

export function shopLane(product: LiveProduct, country: string) {
  const lane = shipLaneForCountry(country);
  if (!lane) return undefined;
  return product.lanes.find((row) => row.region === lane || row.country === country);
}

export function fernoraCatalog() {
  return LIVE_PRODUCTS.map((product) => ({
    ...product,
    description: shopDescription(product),
  }));
}

export function fernoraProduct(id: string) {
  return fernoraCatalog().find((row) => row.id === id);
}

export type CartLine = { id: string; quantity: number; variantId?: string };

export function cartLineKey(line: CartLine) {
  return line.variantId ? `${line.id}::${line.variantId}` : line.id;
}

export function quoteFernoraCart(lines: CartLine[], country: string) {
  if (!isFernoraCountry(country)) {
    throw new Error("Fernora only ships to countries Gelato delivers to");
  }
  const dest = gelatoDestination(country);
  const items: Array<{
    product: LiveProduct;
    quantity: number;
    unitPrice: number;
    shipping: number;
    printCost: number;
    days: string;
    variantId?: string;
    variantLabel?: string;
    gelatoProductUid?: string;
  }> = [];
  for (const line of lines) {
    const product = fernoraProduct(line.id);
    if (!product || line.quantity < 1) continue;
    const lane = shopLane(product, country);
    if (!lane) throw new Error(`${product.title} cannot ship to ${gelatoCountryName(country)}`);
    const variant = findClothingVariant(product.variants, line.variantId);
    items.push({
      product,
      quantity: Math.min(99, Math.floor(line.quantity)),
      unitPrice: product.price,
      shipping: lane.shipping,
      printCost: lane.printCost,
      days: lane.days,
      variantId: variant?.id,
      variantLabel: variant ? variantLabel(variant) : undefined,
      gelatoProductUid: variant?.gelatoProductUid || product.gelatoProductUid,
    });
  }
  if (!items.length) throw new Error("Your bag is empty");
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = items.reduce((sum, item) => sum + item.shipping * item.quantity, 0);
  const print = items.reduce((sum, item) => sum + item.printCost * item.quantity, 0);
  return {
    items,
    subtotal,
    shipping,
    print,
    total: subtotal + shipping,
    currency: FERNORA_CURRENCY,
    country,
    countryName: dest?.name || country,
    lane: dest?.lane,
    days: items.map((item) => item.days).sort()[0],
  };
}

export function checkoutToOrder(input: {
  quote: ReturnType<typeof quoteFernoraCart>;
  address: Address;
}): Omit<Order, "id"> {
  const items: OrderItem[] = input.quote.items.map((item, index) => ({
    id: `frn_${item.product.id}_${item.variantId || "default"}_${index}`,
    listingId: item.product.id,
    title: item.variantLabel ? `${item.product.title} · ${item.variantLabel}` : item.product.title,
    quantity: item.quantity,
    price: item.unitPrice,
    variation: item.variantLabel,
    gelatoProductUid: item.gelatoProductUid,
    printFileUrl: item.product.printFileUrl,
  }));
  const now = new Date().toISOString();
  return {
    etsyReceiptId: `FRN-${Date.now().toString(36).toUpperCase()}`,
    buyerName: `${input.address.firstName} ${input.address.lastName}`.trim(),
    createdAt: now,
    status: "pending",
    channel: "fernora",
    subtotal: input.quote.subtotal,
    shippingPaid: input.quote.shipping,
    currency: FERNORA_CURRENCY,
    items,
    shippingAddress: input.address,
    trackingPushedToEtsy: true,
    issues: ["Awaiting payment before Gelato print"],
  };
}
