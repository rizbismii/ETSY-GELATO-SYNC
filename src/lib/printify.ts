import { getCredentials } from "@/lib/credentials";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  PRINTIFY_EU_GPSR_NOTE,
  safetyInformationNeedsGpsr,
  type PrintifyGpsrBlock,
} from "@/lib/printify-gpsr";

export { formatPrintifySafetyInformation, pickPrintifyShop, PRINTIFY_EU_GPSR_NOTE, safetyInformationNeedsGpsr };

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
  if (!shopId) {
    return {
      shopId: undefined,
      shopTitle: undefined,
      scanned: 0,
      updated: 0,
      notes: [PRINTIFY_EU_GPSR_NOTE, "No Printify shop on this token yet. Create the store, keep EU selected, then Save again."],
    };
  }
  const products = await listShopProducts(shopId);
  let updated = 0;
  const notes: string[] = [PRINTIFY_EU_GPSR_NOTE];
  for (const product of products) {
    if (!safetyInformationNeedsGpsr(product.safety_information)) continue;
    let blocks: PrintifyGpsrBlock[] = [];
    try {
      blocks = await printify<PrintifyGpsrBlock[]>(`/shops/${shopId}/products/${product.id}/gpsr.json`, {
        token: input?.token,
      });
    } catch (error) {
      notes.push(`${product.title || product.id}: ${(error as Error).message}`);
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
  notes.push(
    products.length
      ? `GPSR safety text checked on ${products.length} product${products.length === 1 ? "" : "s"}; updated ${updated}.`
      : "Shop is empty. Add products in Printify, then Save again to stamp GPSR.",
  );
  return {
    shopId,
    shopTitle: ping.shopTitle,
    scanned: products.length,
    updated,
    notes,
  };
}
