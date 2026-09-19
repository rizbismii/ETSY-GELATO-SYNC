import { getCredentials } from "@/lib/credentials";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  safetyInformationNeedsGpsr,
  type PrintifyGpsrBlock,
  type PrintifyGpsrStatus,
} from "@/lib/printify-gpsr";

export {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyGpsrHeadline,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  PRINTIFY_EU_GPSR_NOTE,
  PRINTIFY_NON_EU_NOTE,
  safetyInformationNeedsGpsr,
} from "@/lib/printify-gpsr";
export type { PrintifyGpsrStatus } from "@/lib/printify-gpsr";

const API = "https://api.printify.com/v1";

export type PrintifyShop = {
  id: number;
  title?: string;
  sales_channel?: string;
};

type PrintifyProduct = {
  id: string;
  title?: string;
  safety_information?: string;
};

type PrintifyProductPage = {
  current_page?: number;
  last_page?: number;
  data?: PrintifyProduct[];
};

export function usablePrintifyToken(value?: string | null) {
  const token = value?.trim();
  if (!token) return "";
  if (token.length < 20) return "";
  return token;
}

async function printify<T>(
  path: string,
  init?: { method?: string; body?: Record<string, unknown>; token?: string },
) {
  const creds = await getCredentials();
  const token = init?.token || usablePrintifyToken(creds.printify?.apiToken);
  if (!token) throw new Error("Save a Printify personal access token on Connections first");
  const response = await fetch(`${API}${path.startsWith("/") ? path : `/${path}`}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Pressroom/1.0",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(json.message || json.error || `Printify API ${response.status}`);
  }
  return json as T;
}

export async function listPrintifyShops(token?: string) {
  return printify<PrintifyShop[]>("/shops.json", { token });
}

export async function pingPrintify(token?: string) {
  const shops = await listPrintifyShops(token);
  const shop = pickPrintifyShop(shops);
  return {
    shopCount: shops.length,
    shopId: shop?.id,
    shopTitle: shop?.title,
    salesChannel: shop?.sales_channel,
    shops,
  };
}

async function listShopProducts(shopId: number) {
  const products: PrintifyProduct[] = [];
  let page = 1;
  let last = 1;
  while (page <= last && page <= 20) {
    const pack = await printify<PrintifyProductPage>(`/shops/${shopId}/products.json?page=${page}&limit=50`);
    products.push(...(pack.data || []));
    last = pack.last_page || 1;
    page += 1;
  }
  return products;
}

export async function applyPrintifyGpsr(input?: { shopId?: number; token?: string }) {
  const ping = await pingPrintify(input?.token);
  const shopId = input?.shopId || ping.shopId;
  const shopTitle = ping.shops.find((shop) => shop.id === shopId)?.title || ping.shopTitle;
  if (!shopId) {
    return {
      shopId: undefined,
      shopTitle: undefined,
      scanned: 0,
      updated: 0,
      gpsrStatus: "no-shop" as PrintifyGpsrStatus,
      notes: printifyGpsrNotes("no-shop", 0, 0),
    };
  }
  const products = await listShopProducts(shopId);
  let updated = 0;
  let gpsrUnavailable = false;
  const extraNotes: string[] = [];
  for (const product of products) {
    if (!safetyInformationNeedsGpsr(product.safety_information)) continue;
    let blocks: PrintifyGpsrBlock[] = [];
    try {
      blocks = await printify<PrintifyGpsrBlock[]>(`/shops/${shopId}/products/${product.id}/gpsr.json`, {
        token: input?.token,
      });
    } catch (error) {
      const message = (error as Error).message;
      if (printifyGpsrIsUnavailable(message)) {
        gpsrUnavailable = true;
        break;
      }
      extraNotes.push(`${product.title || product.id}: ${message}`);
      continue;
    }
    const safety = formatPrintifySafetyInformation(blocks);
    if (!safety) continue;
    await printify(`/shops/${shopId}/products/${product.id}.json`, {
      method: "PUT",
      token: input?.token,
      body: { safety_information: safety },
    });
    updated += 1;
  }
  const alreadyStamped = products.filter((product) => !safetyInformationNeedsGpsr(product.safety_information)).length;
  const gpsrStatus = printifyGpsrModeFromProbe({
    shopId,
    productCount: products.length,
    updated,
    gpsrUnavailable,
    alreadyStamped,
  });
  return {
    shopId,
    shopTitle,
    scanned: products.length,
    updated,
    gpsrStatus,
    notes: [...printifyGpsrNotes(gpsrStatus, products.length, updated), ...extraNotes],
  };
}
