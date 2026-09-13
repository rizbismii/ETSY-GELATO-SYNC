import { createHash, randomBytes } from "node:crypto";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCredentials, patchCredentials } from "@/lib/credentials";
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

export function etsyAuthorizeUrl(
  apiKey: string,
  challenge: string,
  state: string,
  redirectUri: string,
) {
  const params = new URLSearchParams();
  params.set("response_type", "code");
  params.set("client_id", apiKey);
  params.set("redirect_uri", redirectUri);
  params.set("scope", SCOPES);
  params.set("state", state);
  params.set("code_challenge", challenge);
  params.set("code_challenge_method", "S256");
  return `${ETSY_AUTH}?${params.toString().replace(/\+/g, "%20")}`;
}

export function etsyApiKeyHeader(apiKey: string, sharedSecret?: string) {
  return sharedSecret ? `${apiKey}:${sharedSecret}` : apiKey;
}

async function etsyFetch(path: string, accessToken: string, apiKey: string, init?: RequestInit) {
  const creds = await getCredentials();
  const response = await fetch(`${ETSY_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "x-api-key": etsyApiKeyHeader(apiKey, creds.etsy?.sharedSecret),
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

export async function pingEtsy() {
  const creds = await getCredentials();
  if (!creds.etsy?.apiKey || !creds.etsy.sharedSecret) {
    throw new Error("Etsy keystring and shared secret are required");
  }
  const response = await fetch(`${ETSY_API}/openapi-ping`, {
    headers: {
      Accept: "application/json",
      "x-api-key": etsyApiKeyHeader(creds.etsy.apiKey, creds.etsy.sharedSecret),
    },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || body.error_description || `Etsy ${response.status}`);
  }
  return body as { application_id?: number };
}

export async function exchangeEtsyCode(code: string, verifier: string, redirectUri: string) {
  const creds = await getCredentials();
  if (!creds.etsy?.apiKey) throw new Error("Etsy API key is not configured");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    "x-api-key": etsyApiKeyHeader(creds.etsy.apiKey, creds.etsy.sharedSecret),
  };
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: creds.etsy.apiKey,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });
  const response = await fetch(ETSY_TOKEN, { method: "POST", headers, body });
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

export async function refreshEtsyToken(force = false) {
  const creds = await getCredentials();
  if (!creds.etsy?.refreshToken || !creds.etsy.apiKey) return creds.etsy;
  if (!force && creds.etsy.expiresAt && creds.etsy.expiresAt > Date.now() + 60_000) return creds.etsy;
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
    const prior = existing.listings.find(
      (row) =>
        (listing.etsyListingId && row.etsyListingId === listing.etsyListingId) ||
        row.title === listing.title,
    );
    if (!prior) return listing;
    return {
      ...listing,
      id: prior.id.startsWith("live_") ? prior.id : listing.id,
      category: prior.category || listing.category,
      drop: prior.drop,
      description: prior.description || listing.description,
      imageUrl: prior.imageUrl,
      gelatoProductUid: prior.gelatoProductUid,
      gelatoProductName: prior.gelatoProductName,
      printFileUrl: prior.printFileUrl,
      gelatoUnitCost: prior.gelatoUnitCost || listing.gelatoUnitCost,
      taxonomyId: prior.taxonomyId,
      shippingProfileId: prior.shippingProfileId,
      returnPolicyId: prior.returnPolicyId,
      publishState: listing.state === "active" ? "live" : prior.publishState || "draft",
      etsyUrl: prior.etsyUrl || listing.etsyUrl,
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
  const unpublished = existing.listings.filter(
    (row) =>
      row.id.startsWith("live_") &&
      !mergedListings.some(
        (live) =>
          (live.etsyListingId && live.etsyListingId === row.etsyListingId) || live.title === row.title,
      ),
  );
  const listings = [...mergedListings, ...unpublished];
  const orders = mergedOrders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const listing = listings.find(
        (row) =>
          row.id === item.listingId ||
          (row.etsyListingId && (item.listingId === `lst_${row.etsyListingId}` || item.listingId === row.etsyListingId)),
      );
      return listing ? { ...item, listingId: listing.id } : item;
    }),
  }));
  return {
    shopName,
    listings,
    orders,
    lastSyncAt: new Date().toISOString(),
  };
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

export async function createEtsyDraft(input: {
  title: string;
  description: string;
  price: number;
  taxonomyId: number;
  shippingProfileId: number;
  returnPolicyId: number;
  tags: string[];
  sku?: string;
  readinessStateId?: number;
}) {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken || !etsy.shopId) {
    throw new Error("Etsy is not authorized");
  }
  const params = new URLSearchParams();
  params.set("quantity", "999");
  params.set("title", input.title.slice(0, 140));
  params.set("description", input.description);
  params.set("price", input.price.toFixed(2));
  params.set("who_made", "i_did");
  params.set("when_made", "made_to_order");
  params.set("taxonomy_id", String(input.taxonomyId));
  params.set("type", "physical");
  params.set("shipping_profile_id", String(input.shippingProfileId));
  params.set("return_policy_id", String(input.returnPolicyId));
  params.set("readiness_state_id", String(input.readinessStateId || 1514454820482));
  params.set("should_auto_renew", "true");
  params.set("is_personalizable", "false");
  if (input.sku) params.set("sku", input.sku);
  for (const tag of input.tags.slice(0, 13)) {
    params.append("tags[]", tag.slice(0, 20));
  }
  const response = await fetch(`${ETSY_API}/shops/${etsy.shopId}/listings`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": etsyApiKeyHeader(etsy.apiKey, etsy.sharedSecret),
      Authorization: `Bearer ${etsy.accessToken}`,
    },
    body: params,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.error_description || `Etsy listing create ${response.status}`);
  }
  return data as { listing_id: number; url?: string; state?: string };
}

export async function uploadEtsyListingImage(listingId: string, filePath: string, rank = 1) {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken) throw new Error("Etsy is not authorized");
  const buffer = await readFile(filePath);
  const name = path.basename(filePath);
  const form = new FormData();
  form.append("image", new File([new Uint8Array(buffer)], name, { type: "image/png" }));
  form.append("listing_id", listingId);
  form.append("rank", String(rank));
  form.append("overwrite", "true");
  form.append("alt_text", name.replace(/[-_]/g, " ").replace(/\.png$/i, ""));
  const response = await fetch(`${ETSY_API}/shops/${etsy.shopId}/listings/${listingId}/images`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "x-api-key": etsyApiKeyHeader(etsy.apiKey, etsy.sharedSecret),
      Authorization: `Bearer ${etsy.accessToken}`,
    },
    body: form,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.error_description || `Etsy image ${response.status}`);
  }
  return data;
}

export async function setEtsyListingState(listingId: string, state: "draft" | "active" | "inactive") {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken) throw new Error("Etsy is not authorized");
  const params = new URLSearchParams({ state });
  const response = await fetch(`${ETSY_API}/shops/${etsy.shopId}/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": etsyApiKeyHeader(etsy.apiKey, etsy.sharedSecret),
      Authorization: `Bearer ${etsy.accessToken}`,
    },
    body: params,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.error_description || `Etsy listing update ${response.status}`);
  }
  return data as { listing_id: number; state: string; url?: string };
}

export async function updateEtsyListingPrice(listingId: string, price: number) {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken || !etsy.shopId) {
    throw new Error("Etsy is not authorized");
  }
  const params = new URLSearchParams({ price: price.toFixed(2) });
  const response = await fetch(`${ETSY_API}/shops/${etsy.shopId}/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": etsyApiKeyHeader(etsy.apiKey, etsy.sharedSecret),
      Authorization: `Bearer ${etsy.accessToken}`,
    },
    body: params,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.error_description || `Etsy price ${response.status}`);
  }
  return data;
}

export async function updateEtsyShopAnnouncement(announcement: string) {
  const etsy = await refreshEtsyToken();
  if (!etsy?.apiKey || !etsy.accessToken || !etsy.shopId) {
    throw new Error("Etsy is not authorized");
  }
  const params = new URLSearchParams({ announcement: announcement.slice(0, 5000) });
  const response = await fetch(`${ETSY_API}/shops/${etsy.shopId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": etsyApiKeyHeader(etsy.apiKey, etsy.sharedSecret),
      Authorization: `Bearer ${etsy.accessToken}`,
    },
    body: params,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.error_description || `Etsy shop ${response.status}`);
  }
  return data;
}
