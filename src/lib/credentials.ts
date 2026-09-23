import { promises as fs } from "node:fs";
import path from "node:path";
import { DESK_CREDENTIALS, usableGelatoKey } from "@/lib/desk-credentials";
import type { PrintifyGpsrStatus, PrintifyShopSummary } from "@/lib/printify-gpsr";
import { FERNORA_SHOPIFY_SHOP } from "@/lib/shopify-shop";

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

export type MetaCredentials = {
  accessToken: string;
  adAccountId: string;
  pixelId?: string;
  pageId?: string;
  instagramUserId?: string;
};

export type PrintifyCredentials = {
  apiToken: string;
  shopId?: string;
  shopTitle?: string;
  gpsrStatus?: PrintifyGpsrStatus;
  salesChannel?: string;
  fullyConnected?: boolean;
  shops?: PrintifyShopSummary[];
};

export type StoredCredentials = {
  etsy?: EtsyCredentials;
  gelatoApiKey?: string;
  shopify?: ShopifyCredentials;
  meta?: MetaCredentials;
  printify?: PrintifyCredentials;
};

const FILE = path.join(process.cwd(), "data", "credentials.json");

let cache: StoredCredentials | null = null;

function nonEmpty(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pickSecret(...candidates: Array<string | undefined | null>) {
  for (const candidate of candidates) {
    const value = nonEmpty(candidate);
    if (value) return value;
  }
  return undefined;
}

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
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(tmp, FILE);
  } catch (error) {
    console.warn("Could not persist credentials.json", error);
  }
}

export function normalizeShopDomain(shop?: string) {
  if (!shop) return undefined;
  const cleaned = shop
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (!cleaned) return undefined;
  return cleaned.includes(".") ? cleaned : `${cleaned}.myshopify.com`;
}

function mergeEtsy(current?: EtsyCredentials, patch?: Partial<EtsyCredentials>): EtsyCredentials | undefined {
  if (!current && !patch) return undefined;
  const apiKey = pickSecret(patch?.apiKey, current?.apiKey, DESK_CREDENTIALS.etsy?.apiKey) || "";
  const sharedSecret =
    pickSecret(patch?.sharedSecret, current?.sharedSecret, DESK_CREDENTIALS.etsy?.sharedSecret) || "";
  if (!apiKey && !sharedSecret) return current;
  return {
    apiKey,
    sharedSecret,
    accessToken: pickSecret(patch?.accessToken, current?.accessToken),
    refreshToken: pickSecret(patch?.refreshToken, current?.refreshToken),
    expiresAt: patch?.expiresAt ?? current?.expiresAt,
    userId: pickSecret(patch?.userId, current?.userId),
    shopId: pickSecret(patch?.shopId, current?.shopId),
    shopName: pickSecret(patch?.shopName, current?.shopName),
  };
}

function mergeShopify(
  current?: ShopifyCredentials,
  patch?: Partial<ShopifyCredentials>,
): ShopifyCredentials | undefined {
  if (!current && !patch) return undefined;
  const clientId = pickSecret(patch?.clientId, current?.clientId, DESK_CREDENTIALS.shopify?.clientId) || "";
  const clientSecret =
    pickSecret(patch?.clientSecret, current?.clientSecret, DESK_CREDENTIALS.shopify?.clientSecret) || "";
  const shop = normalizeShopDomain(
    pickSecret(patch?.shop, current?.shop, DESK_CREDENTIALS.shopify?.shop) || FERNORA_SHOPIFY_SHOP,
  );
  if (!clientId && !clientSecret) {
    return shop ? { clientId: "", clientSecret: "", shop } : current;
  }
  return {
    clientId,
    clientSecret,
    shop,
    accessToken: pickSecret(patch?.accessToken, current?.accessToken),
    scope: pickSecret(patch?.scope, current?.scope),
    expiresAt: patch?.expiresAt ?? current?.expiresAt,
    storefrontStatus: patch?.storefrontStatus ?? current?.storefrontStatus,
  };
}

function hydrate(disk: StoredCredentials): StoredCredentials {
  const gelatoApiKey =
    usableGelatoKey(process.env.GELATO_API_KEY) ||
    usableGelatoKey(disk.gelatoApiKey) ||
    usableGelatoKey(DESK_CREDENTIALS.gelatoApiKey);
  const etsy = mergeEtsy(DESK_CREDENTIALS.etsy, {
    ...disk.etsy,
    apiKey: pickSecret(process.env.ETSY_API_KEY, disk.etsy?.apiKey, DESK_CREDENTIALS.etsy?.apiKey),
    sharedSecret: pickSecret(
      process.env.ETSY_SHARED_SECRET,
      disk.etsy?.sharedSecret,
      DESK_CREDENTIALS.etsy?.sharedSecret,
    ),
    accessToken: pickSecret(process.env.ETSY_ACCESS_TOKEN, disk.etsy?.accessToken),
    refreshToken: pickSecret(process.env.ETSY_REFRESH_TOKEN, disk.etsy?.refreshToken),
    userId: pickSecret(process.env.ETSY_USER_ID, disk.etsy?.userId),
    shopId: pickSecret(process.env.ETSY_SHOP_ID, disk.etsy?.shopId),
  });
  const shopify = mergeShopify(DESK_CREDENTIALS.shopify, {
    ...disk.shopify,
    clientId: pickSecret(process.env.SHOPIFY_CLIENT_ID, disk.shopify?.clientId, DESK_CREDENTIALS.shopify?.clientId),
    clientSecret: pickSecret(
      process.env.SHOPIFY_CLIENT_SECRET,
      disk.shopify?.clientSecret,
      DESK_CREDENTIALS.shopify?.clientSecret,
    ),
    shop: pickSecret(process.env.SHOPIFY_SHOP, disk.shopify?.shop, DESK_CREDENTIALS.shopify?.shop),
    accessToken: pickSecret(process.env.SHOPIFY_ACCESS_TOKEN, disk.shopify?.accessToken),
  });
  const meta = mergeMeta(disk.meta, {
    accessToken: pickSecret(process.env.META_ACCESS_TOKEN, disk.meta?.accessToken),
    adAccountId: pickSecret(process.env.META_AD_ACCOUNT_ID, disk.meta?.adAccountId),
    pixelId: pickSecret(process.env.META_PIXEL_ID, disk.meta?.pixelId),
    pageId: pickSecret(process.env.META_PAGE_ID, disk.meta?.pageId),
    instagramUserId: pickSecret(process.env.META_INSTAGRAM_USER_ID, disk.meta?.instagramUserId),
  });
  const printify = mergePrintify(disk.printify, {
    apiToken: pickSecret(process.env.PRINTIFY_API_TOKEN, disk.printify?.apiToken),
    shopId: pickSecret(process.env.PRINTIFY_SHOP_ID, disk.printify?.shopId),
    shopTitle: pickSecret(process.env.PRINTIFY_SHOP_TITLE, disk.printify?.shopTitle),
    gpsrStatus: disk.printify?.gpsrStatus,
    salesChannel: disk.printify?.salesChannel,
    fullyConnected: disk.printify?.fullyConnected,
    shops: disk.printify?.shops,
  });
  const next: StoredCredentials = { gelatoApiKey, etsy, shopify, meta, printify };
  if (next.etsy && !next.etsy.apiKey) delete next.etsy;
  if (next.shopify && !next.shopify.clientId) delete next.shopify;
  if (next.meta && !next.meta.accessToken && !next.meta.pixelId && !next.meta.adAccountId) delete next.meta;
  if (next.printify && !next.printify.apiToken) delete next.printify;
  return next;
}

export async function getCredentials(): Promise<StoredCredentials> {
  const disk = cache ?? (await readDisk());
  cache = disk;
  return hydrate(disk);
}

function mergeMeta(current?: MetaCredentials, patch?: Partial<MetaCredentials>): MetaCredentials | undefined {
  if (!current && !patch) return undefined;
  const accessToken = pickSecret(patch?.accessToken, current?.accessToken) || "";
  const adAccountId = pickSecret(patch?.adAccountId, current?.adAccountId) || "";
  const pixelId = pickSecret(patch?.pixelId, current?.pixelId);
  const pageId = pickSecret(patch?.pageId, current?.pageId);
  const instagramUserId = pickSecret(patch?.instagramUserId, current?.instagramUserId);
  if (!accessToken && !adAccountId && !pixelId && !pageId && !instagramUserId) return current;
  return { accessToken, adAccountId, pixelId, pageId, instagramUserId };
}

function mergePrintify(
  current?: PrintifyCredentials,
  patch?: Partial<PrintifyCredentials>,
): PrintifyCredentials | undefined {
  if (!current && !patch) return undefined;
  const apiToken = pickSecret(patch?.apiToken, current?.apiToken) || "";
  const shopId = pickSecret(patch?.shopId, current?.shopId);
  const shopTitle = pickSecret(patch?.shopTitle, current?.shopTitle);
  const gpsrStatus = patch && "gpsrStatus" in patch ? patch.gpsrStatus : current?.gpsrStatus;
  const salesChannel = patch && "salesChannel" in patch ? patch.salesChannel : current?.salesChannel;
  const fullyConnected = patch && "fullyConnected" in patch ? patch.fullyConnected : current?.fullyConnected;
  const shops = patch && "shops" in patch ? patch.shops : current?.shops;
  if (!apiToken && !shopId && !shopTitle && !gpsrStatus && !salesChannel && !shops) return current;
  return { apiToken, shopId, shopTitle, gpsrStatus, salesChannel, fullyConnected, shops };
}

export async function saveCredentials(next: StoredCredentials) {
  const persisted: StoredCredentials = {
    gelatoApiKey: usableGelatoKey(next.gelatoApiKey),
    etsy: next.etsy,
    shopify: next.shopify,
    meta: next.meta,
    printify: next.printify,
  };
  cache = persisted;
  await writeDisk(persisted);
}

export async function patchCredentials(patch: StoredCredentials) {
  const disk = cache ?? (await readDisk());
  const next: StoredCredentials = {
    gelatoApiKey:
      usableGelatoKey(patch.gelatoApiKey) ||
      usableGelatoKey(disk.gelatoApiKey) ||
      usableGelatoKey(DESK_CREDENTIALS.gelatoApiKey),
    etsy: mergeEtsy(disk.etsy, patch.etsy),
    shopify: mergeShopify(disk.shopify, patch.shopify),
    meta: mergeMeta(disk.meta, patch.meta),
    printify: mergePrintify(disk.printify, patch.printify),
  };
  await saveCredentials(next);
  return hydrate(next);
}

export { usableGelatoKey };
