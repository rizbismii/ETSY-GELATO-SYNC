import { LIVE_PRODUCTS, SHIP_BLURB, type LiveProduct } from "@/lib/live-catalog";
import { findClothingVariant, variantLabel } from "@/lib/clothing";
import type { Address, Order, OrderItem } from "@/lib/types";

export const FERNORA_NAME = "Fernora";
export const FERNORA_CURRENCY = "NZD";
export const FERNORA_SHIP_COUNTRIES = ["NZ", "AU"] as const;
export type FernoraCountry = (typeof FERNORA_SHIP_COUNTRIES)[number];

export const FERNORA_SHIP_BLURB =
  "Ships to Australia and New Zealand only. Printed near you by Gelato. Wellington 6012 is the studio address, not the parcel origin.";

export function isFernoraCountry(value: string): value is FernoraCountry {
  return value === "NZ" || value === "AU";
}

export function shopDescription(product: LiveProduct) {
  return product.description.replace(SHIP_BLURB, "").trim() + " " + FERNORA_SHIP_BLURB;
}

export function shopLane(product: LiveProduct, country: FernoraCountry) {
  return product.lanes.find((lane) => lane.country === country || lane.region === country);
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

export function quoteFernoraCart(lines: CartLine[], country: FernoraCountry) {
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
    if (!lane) throw new Error(`${product.title} cannot ship to ${country}`);
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
