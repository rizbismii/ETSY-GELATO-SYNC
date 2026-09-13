import { promises as fs } from "node:fs";
import path from "node:path";

export type EtsyCredentials = {
  apiKey: string;
  sharedSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  shopId?: string;
  shopName?: string;
};

export type ShopifyCredentials = {
  clientId: string;
  clientSecret: string;
  shop?: string;
  accessToken?: string;
  scope?: string;
  expiresAt?: number;
  storefrontStatus?: "live" | "frozen" | "missing" | "unknown";
};

export type StoredCredentials = {
  etsy?: EtsyCredentials;
  gelatoApiKey?: string;
  shopify?: ShopifyCredentials;
};

const FILE = path.join(process.cwd(), "data", "credentials.json");

let cache: StoredCredentials | null = null;

async function readDisk(): Promise<StoredCredentials> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as StoredCredentials;
  } catch {
    return {};
  }
}

async function writeDisk(value: StoredCredentials) {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(value, null, 2));
  } catch {
    /* keep the in-memory copy if the disk is read-only */
  }
}

function normalizeShopDomain(shop?: string) {
  if (!shop) return undefined;
  const cleaned = shop
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (!cleaned) return undefined;
  return cleaned.includes(".") ? cleaned : `${cleaned}.myshopify.com`;
}

export async function getCredentials(): Promise<StoredCredentials> {
  if (!cache) cache = await readDisk();
  const env: StoredCredentials = {
    gelatoApiKey: process.env.GELATO_API_KEY || cache.gelatoApiKey,
    etsy: {
      apiKey: process.env.ETSY_API_KEY || cache.etsy?.apiKey || "",
      sharedSecret: process.env.ETSY_SHARED_SECRET || cache.etsy?.sharedSecret || "",
      accessToken: process.env.ETSY_ACCESS_TOKEN || cache.etsy?.accessToken,
      refreshToken: process.env.ETSY_REFRESH_TOKEN || cache.etsy?.refreshToken,
      expiresAt: cache.etsy?.expiresAt,
      userId: process.env.ETSY_USER_ID || cache.etsy?.userId,
      shopId: process.env.ETSY_SHOP_ID || cache.etsy?.shopId,
      shopName: cache.etsy?.shopName,
    },
    shopify: {
      clientId: process.env.SHOPIFY_CLIENT_ID || cache.shopify?.clientId || "",
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET || cache.shopify?.clientSecret || "",
      shop: normalizeShopDomain(process.env.SHOPIFY_SHOP || cache.shopify?.shop),
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || cache.shopify?.accessToken,
      scope: cache.shopify?.scope,
      expiresAt: cache.shopify?.expiresAt,
      storefrontStatus: cache.shopify?.storefrontStatus,
    },
  };
  if (!env.etsy?.apiKey) delete env.etsy;
  if (!env.shopify?.clientId) delete env.shopify;
  return env;
}

export async function saveCredentials(next: StoredCredentials) {
  cache = next;
  await writeDisk(next);
}

export async function patchCredentials(patch: StoredCredentials) {
  const current = await getCredentials();
  const next: StoredCredentials = {
    gelatoApiKey: patch.gelatoApiKey ?? current.gelatoApiKey,
    etsy: patch.etsy ? { ...current.etsy, ...patch.etsy } : current.etsy,
    shopify: patch.shopify
      ? {
          ...current.shopify,
          ...patch.shopify,
          shop: normalizeShopDomain(patch.shopify.shop || current.shopify?.shop),
        }
      : current.shopify,
  };
  if (next.etsy && !next.etsy.apiKey) delete next.etsy;
  if (next.shopify && !next.shopify.clientId) delete next.shopify;
  await saveCredentials(next);
  return next;
}

export { normalizeShopDomain };
