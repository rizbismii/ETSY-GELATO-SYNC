import { getCredentials } from "@/lib/credentials";
import { templateByUid } from "@/lib/catalog";
import { absoluteAssetUrl } from "@/lib/origin";
import type { Order } from "@/lib/types";

const ORDER_API = "https://order.gelatoapis.com/v4";
const PRODUCT_API = "https://product.gelatoapis.com/v3";

async function gelatoFetch(url: string, init?: RequestInit) {
  const creds = await getCredentials();
  if (!creds.gelatoApiKey) throw new Error("Gelato API key is not configured");
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": creds.gelatoApiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.message || body.error || `Gelato ${response.status}`);
  }
  return body;
}

export async function pingGelato() {
  const body = await gelatoFetch(`${ORDER_API}/orders:search`, {
    method: "POST",
    body: JSON.stringify({ limit: 1, orderTypes: ["order", "draft"] }),
  });
  return { ok: true, count: Array.isArray(body.orders) ? body.orders.length : 0 };
}

export async function createGelatoOrder(order: Order) {
  const items = await Promise.all(
    order.items.map(async (item, index) => {
      const uid = item.gelatoProductUid;
      if (!uid) throw new Error(`Item ${item.title} is not mapped to Gelato`);
      if (!item.printFileUrl) throw new Error(`Item ${item.title} is missing a print file`);
      const printFileUrl = await absoluteAssetUrl(item.printFileUrl);
      return {
        itemReferenceId: item.id || `item-${index}`,
        productUid: uid,
        quantity: item.quantity,
        files: [{ type: "default", url: printFileUrl }],
      };
    }),
  );
  const payload = {
    orderType: "order",
    orderReferenceId: order.shopifyOrderId || order.etsyReceiptId || order.id,
    customerReferenceId: order.buyerName.replace(/\s+/g, "-").toLowerCase(),
    currency: order.currency,
    items,
    shipmentMethodUid: "normal",
    shippingAddress: {
      firstName: order.shippingAddress.firstName,
      lastName: order.shippingAddress.lastName,
      addressLine1: order.shippingAddress.addressLine1,
      addressLine2: order.shippingAddress.addressLine2,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postCode: order.shippingAddress.postCode,
      country: order.shippingAddress.country,
      email: order.shippingAddress.email,
      phone: order.shippingAddress.phone,
    },
  };
  return gelatoFetch(`${ORDER_API}/orders`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function findGelatoOrder(orderReferenceId: string) {
  const body = await gelatoFetch(`${ORDER_API}/orders:search`, {
    method: "POST",
    body: JSON.stringify({ orderReferenceIds: [orderReferenceId], limit: 1 }),
  });
  return (body.orders?.[0] ?? null) as Record<string, unknown> | null;
}

export async function listGelatoCatalogs() {
  try {
    return await gelatoFetch(`${PRODUCT_API}/catalogs`);
  } catch {
    return { catalogs: [] };
  }
}

export function demoFulfill(order: Order) {
  const id = `GEL-${Math.floor(800000 + Math.random() * 90000)}`;
  return {
    id,
    fulfillmentStatus: "passed_to_production",
    shipment: templateByUid(order.items[0]?.gelatoProductUid),
  };
}

export function demoShip(order: Order) {
  return {
    ...order,
    status: "shipped" as const,
    gelatoStatus: "shipped",
    trackingNumber: order.trackingNumber || `9400${Date.now().toString().slice(-16)}`,
    trackingCarrier: order.trackingCarrier || "USPS",
  };
}
