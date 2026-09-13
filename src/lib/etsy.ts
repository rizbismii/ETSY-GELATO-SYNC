import { createHash, randomBytes } from "node:crypto";
import { etsyRedirectUri, getCredentials, patchCredentials } from "@/lib/credentials";
import type { Address, Listing, Order, ShopState } from "@/lib/types";

const ETSY_API = "https://openapi.etsy.com/v3/application";
const ETSY_TOKEN = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_AUTH = "https://www.etsy.com/oauth/connect";
const SCOPES = [
  "listings_r",
  "listings_w",
  "shops_r",
  "transactions_r",
  "transactions_w",
  "email_r",
  "billing_r",
].join(" ");

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  return { verifier, challenge, state };
}

export function etsyAuthorizeUrl(apiKey: string, challenge: string, state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: apiKey,
    redirect_uri: etsyRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${ETSY_AUTH}?${params.toString()}`;
}

async function etsyFetch(path: string, accessToken: string, apiKey: string, init?: RequestInit) {
  const response = await fetch(`${ETSY_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.error || body.error_description || `Etsy ${response.status}`);
  }
  return body;
}

export async function exchangeEtsyCode(code: string, verifier: string) {
  const creds = await getCredentials();
  if (!creds.etsy?.apiKey) throw new Error("Etsy API key is not configured");
  const response = await fetch(ETSY_TOKEN, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.etsy.apiKey,
      redirect_uri: etsyRedirectUri(),
      code,
      code_verifier: verifier,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Etsy token exchange failed");
  }
  const userId = String(data.access_token).split(".")[0];
  await patchCredentials({
    etsy: {
      ...creds.etsy,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      userId,
    },
  });
  return data;
}

export async function refreshEtsyToken() {
  const creds = await getCredentials();
  if (!creds.etsy?.refreshToken || !creds.etsy.apiKey) return creds.etsy;
  if (creds.etsy.expiresAt && creds.etsy.expiresAt > Date.now() + 60_000) return creds.etsy;
  const response = await fetch(ETSY_TOKEN, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.etsy.apiKey,
      refresh_token: creds.etsy.refreshToken,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "Etsy refresh failed");
  const next = {
    ...creds.etsy,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? creds.etsy.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  await patchCredentials({ etsy: next });
  return next;
}

export async function loadEtsyShop() {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken || !etsy.userId) {
    throw new Error("Etsy is not authorized");
  }
  const shops = await etsyFetch(`/users/${etsy.userId}/shops`, etsy.accessToken, etsy.apiKey);
  const shop = shops.results?.[0] ?? shops;
  const shopId = String(shop.shop_id);
  const shopName = shop.shop_name;
  await patchCredentials({ etsy: { ...etsy, shopId, shopName } });
  return { shopId, shopName, etsy: { ...etsy, shopId, shopName } };
}

function mapListing(row: Record<string, unknown>): Listing {
  const price =
    Number((row.price as { amount?: number; divisor?: number })?.amount ?? 0) /
    Number((row.price as { divisor?: number })?.divisor ?? 100);
  return {
    id: `lst_${row.listing_id}`,
    etsyListingId: String(row.listing_id),
    title: String(row.title ?? "Untitled listing"),
    state: (String(row.state) as Listing["state"]) || "active",
    price,
    currency: String((row.price as { currency_code?: string })?.currency_code ?? "USD"),
    quantity: Number(row.quantity ?? 0),
    views: Number(row.views ?? 0),
    favorites: Number(row.num_favorers ?? 0),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    category: "etsy",
    gelatoUnitCost: 0,
    issues: [],
  };
}

function mapAddress(row: Record<string, unknown>): Address {
  return {
    firstName: String(row.first_line ? row.name ?? "" : row.name ?? "Customer").split(" ")[0] || "Customer",
    lastName: String(row.name ?? "").split(" ").slice(1).join(" "),
    addressLine1: String(row.first_line ?? row.formatted_address ?? ""),
    addressLine2: row.second_line ? String(row.second_line) : undefined,
    city: String(row.city ?? ""),
    state: row.state ? String(row.state) : undefined,
    postCode: String(row.zip ?? ""),
    country: String(row.country_iso ?? row.country_id ?? "US"),
    email: row.buyer_email ? String(row.buyer_email) : undefined,
  };
}

function mapReceipt(row: Record<string, unknown>): Order {
  const transactions = (row.transactions as Record<string, unknown>[]) ?? [];
  const items = transactions.map((txn) => ({
    id: `txn_${txn.transaction_id}`,
    listingId: `lst_${txn.listing_id}`,
    title: String(txn.title ?? "Item"),
    quantity: Number(txn.quantity ?? 1),
    price:
      Number((txn.price as { amount?: number })?.amount ?? 0) /
      Number((txn.price as { divisor?: number })?.divisor ?? 100),
    variation: Array.isArray(txn.variations)
      ? (txn.variations as Array<{ formatted_name?: string; formatted_value?: string }>)
          .map((v) => `${v.formatted_value ?? ""}`)
          .filter(Boolean)
          .join(" / ")
      : undefined,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingPaid =
    Number((row.total_shipping_cost as { amount?: number })?.amount ?? 0) /
    Number((row.total_shipping_cost as { divisor?: number })?.divisor ?? 100);
  const status: Order["status"] = row.is_shipped ? "shipped" : row.is_paid ? "paid" : "paid";
  return {
    id: `ord_${row.receipt_id}`,
    etsyReceiptId: String(row.receipt_id),
    buyerName: String(row.name ?? "Buyer"),
    createdAt: new Date(Number(row.created_timestamp ?? Date.now() / 1000) * 1000).toISOString(),
    paidAt: row.is_paid
      ? new Date(Number(row.created_timestamp ?? Date.now() / 1000) * 1000).toISOString()
      : undefined,
    status,
    subtotal,
    shippingPaid,
    currency: String(row.grandtotal ? (row.grandtotal as { currency_code?: string }).currency_code : "USD"),
    items,
    shippingAddress: mapAddress(row),
    trackingPushedToEtsy: Boolean(row.is_shipped),
    issues: [],
  };
}

export async function pullEtsyCatalog(existing: ShopState): Promise<Partial<ShopState>> {
  const { shopId, shopName, etsy } = await loadEtsyShop();
  const listingsRes = await etsyFetch(
    `/shops/${shopId}/listings?state=active&limit=100`,
    etsy.accessToken!,
    etsy.apiKey,
  );
  const receiptsRes = await etsyFetch(
    `/shops/${shopId}/receipts?was_paid=true&limit=100`,
    etsy.accessToken!,
    etsy.apiKey,
  );
  const liveListings = ((listingsRes.results ?? []) as Record<string, unknown>[]).map(mapListing);
  const mergedListings = liveListings.map((listing) => {
    const prior = existing.listings.find((row) => row.etsyListingId === listing.etsyListingId);
    if (!prior) return listing;
    return {
      ...listing,
      gelatoProductUid: prior.gelatoProductUid,
      gelatoProductName: prior.gelatoProductName,
      printFileUrl: prior.printFileUrl,
      gelatoUnitCost: prior.gelatoUnitCost || listing.gelatoUnitCost,
    };
  });
  const liveOrders = ((receiptsRes.results ?? []) as Record<string, unknown>[]).map(mapReceipt);
  const mergedOrders = liveOrders.map((order) => {
    const prior = existing.orders.find((row) => row.etsyReceiptId === order.etsyReceiptId);
    if (!prior) return order;
    return {
      ...order,
      items: order.items.map((item) => {
        const listing = mergedListings.find((row) => row.id === item.listingId);
        return {
          ...item,
          gelatoProductUid: item.gelatoProductUid ?? listing?.gelatoProductUid,
          printFileUrl: item.printFileUrl ?? listing?.printFileUrl,
        };
      }),
      gelatoOrderId: prior.gelatoOrderId,
      gelatoStatus: prior.gelatoStatus,
      trackingNumber: order.trackingNumber ?? prior.trackingNumber,
      trackingCarrier: order.trackingCarrier ?? prior.trackingCarrier,
      trackingPushedToEtsy: order.trackingPushedToEtsy || prior.trackingPushedToEtsy,
      status: prior.status === "in_production" || prior.status === "blocked" ? prior.status : order.status,
    };
  });
  return { shopName, listings: mergedListings, orders: mergedOrders, lastSyncAt: new Date().toISOString() };
}

export async function pushEtsyTracking(order: Order) {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken || !etsy.shopId || !order.trackingNumber) {
    throw new Error("Missing Etsy authorization or tracking number");
  }
  await etsyFetch(
    `/shops/${etsy.shopId}/receipts/${order.etsyReceiptId}/tracking`,
    etsy.accessToken,
    etsy.apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracking_code: order.trackingNumber,
        carrier_name: order.trackingCarrier || "other",
        send_bcc: true,
      }),
    },
  );
}
