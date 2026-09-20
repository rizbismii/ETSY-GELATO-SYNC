import { readFile } from "node:fs/promises";
import { getCredentials, patchCredentials } from "@/lib/credentials";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  printifyIsFullyConnected,
  safetyInformationNeedsGpsr,
  type PrintifyGpsrBlock,
  type PrintifyGpsrStatus,
  type PrintifyShopSummary,
} from "@/lib/printify-gpsr";
import {
  buildPrintifyProductPayload,
  existingPrintifyProductId,
  FERNORA_PRINTIFY_STARTERS,
  printifyCatalogFile,
  printifyEnabledVariantIds,
  printifyImageFileName,
  type PrintifyStarterSpec,
} from "@/lib/printify-products";
import { restoreLiveCatalogInShop } from "@/lib/drop";
import { syncEtsyCatalogSections } from "@/lib/etsy";
import { syncShopifyCatalogMenu } from "@/lib/shopify-horizon";
import { updateShop } from "@/lib/store";
import { clearDeletedListings } from "@/lib/tombstones";

export {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyConnectionHeadline,
  printifyGpsrHeadline,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  printifyIsFullyConnected,
  printifyShopLine,
  PRINTIFY_EU_GPSR_NOTE,
  PRINTIFY_NON_EU_NOTE,
  safetyInformationNeedsGpsr,
} from "@/lib/printify-gpsr";
export type { PrintifyGpsrStatus, PrintifyShopSummary } from "@/lib/printify-gpsr";
export { FERNORA_PRINTIFY_STARTERS } from "@/lib/printify-products";

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
  variants?: Array<{ id?: number; is_enabled?: boolean }>;
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
  const json = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
    errors?: unknown;
  };
  if (!response.ok) {
    const extra = json.errors ? ` ${JSON.stringify(json.errors)}` : "";
    throw new Error(`${json.message || json.error || `Printify API ${response.status}`}${extra}`);
  }
  return json as T;
}

export async function listPrintifyShops(token?: string) {
  return printify<PrintifyShop[]>("/shops.json", { token });
}

export async function pingPrintify(token?: string) {
  const shops = await listPrintifyShops(token);
  const shop = pickPrintifyShop(shops);
  const shopSummaries: PrintifyShopSummary[] = [];
  for (const row of shops) {
    const products = await listShopProducts(row.id);
    shopSummaries.push({
      id: row.id,
      title: row.title,
      salesChannel: row.sales_channel || "disconnected",
      productCount: products.length,
    });
  }
  return {
    shopCount: shops.length,
    shopId: shop?.id,
    shopTitle: shop?.title,
    salesChannel: shop?.sales_channel || "disconnected",
    shops,
    shopSummaries,
    fullyConnected: printifyIsFullyConnected(shopSummaries),
  };
}

export type CreatedPrintifyProduct = {
  key: string;
  id: string;
  title: string;
  skipped: boolean;
  replaced?: boolean;
};

export async function uploadPrintifyImage(fileName: string, token?: string) {
  const bytes = await readFile(printifyCatalogFile(fileName));
  const uploadName = printifyImageFileName(fileName, bytes);
  const uploaded = await printify<{ id: string; file_name?: string }>("/uploads/images.json", {
    method: "POST",
    token,
    body: {
      file_name: uploadName,
      contents: bytes.toString("base64"),
    },
  });
  if (!uploaded.id) throw new Error(`Printify did not return an image id for ${uploadName}`);
  return uploaded;
}

async function createPrintifyProduct(shopId: number, spec: PrintifyStarterSpec, imageId: string, token?: string) {
  const created = await printify<{ id: string; title?: string }>(`/shops/${shopId}/products.json`, {
    method: "POST",
    token,
    body: buildPrintifyProductPayload(spec, imageId),
  });
  if (!created.id) throw new Error(`Printify did not return a product id for ${spec.title}`);
  return created;
}

async function getPrintifyProduct(shopId: number, productId: string, token?: string) {
  return printify<PrintifyProduct>(`/shops/${shopId}/products/${productId}.json`, { token });
}

async function deletePrintifyProduct(shopId: number, productId: string, token?: string) {
  await printify(`/shops/${shopId}/products/${productId}.json`, { method: "DELETE", token });
}

function wantedVariantIds(spec: PrintifyStarterSpec) {
  return spec.variants.filter((variant) => variant.is_enabled).map((variant) => variant.id);
}

function sameOneVariant(spec: PrintifyStarterSpec, product: PrintifyProduct, title: string) {
  if ((product.title || "").trim() !== title.trim()) return false;
  const enabled = printifyEnabledVariantIds(product);
  const wanted = wantedVariantIds(spec);
  return enabled.length === 1 && wanted.length === 1 && enabled[0] === wanted[0];
}

export async function createFernoraPrintifyProducts(input?: { shopId?: number; token?: string }) {
  const ping = await pingPrintify(input?.token);
  const shopId = input?.shopId || ping.shopId;
  if (!shopId) throw new Error("No Printify shop on this token. Save Printify on Connections first.");
  const existing = await listShopProducts(shopId);
  const products: CreatedPrintifyProduct[] = [];
  const extraNotes: string[] = [];
  const claimed = new Set<string>();
  for (const spec of FERNORA_PRINTIFY_STARTERS) {
    const already = existingPrintifyProductId(
      existing.filter((row) => row.id && !claimed.has(row.id)),
      spec.title,
      spec.aliases,
    );
    if (already) {
      const current = await getPrintifyProduct(shopId, already, input?.token);
      if (sameOneVariant(spec, current, spec.title)) {
        claimed.add(already);
        products.push({ key: spec.key, id: already, title: spec.title, skipped: true });
        continue;
      }
      await deletePrintifyProduct(shopId, already, input?.token);
      const idx = existing.findIndex((row) => row.id === already);
      if (idx >= 0) existing.splice(idx, 1);
      extraNotes.push(`Replaced ${current.title || spec.title} with one enabled variant.`);
    }
    const image = await uploadPrintifyImage(spec.printFile, input?.token);
    const created = await createPrintifyProduct(shopId, spec, image.id, input?.token);
    claimed.add(created.id);
    existing.push({ id: created.id, title: created.title || spec.title });
    products.push({
      key: spec.key,
      id: created.id,
      title: created.title || spec.title,
      skipped: false,
      replaced: Boolean(already),
    });
  }
  clearDeletedListings();
  await updateShop((shop) => {
    restoreLiveCatalogInShop(shop);
  });
  try {
    extraNotes.push(...(await syncEtsyCatalogSections()));
  } catch (error) {
    extraNotes.push(`Etsy Catalog sections: ${(error as Error).message}`);
  }
  try {
    extraNotes.push(...(await syncShopifyCatalogMenu()));
  } catch (error) {
    extraNotes.push(`Shopify Catalog menu: ${(error as Error).message}`);
  }
  const gpsr = await applyPrintifyGpsr({ token: input?.token, shopId });
  await patchCredentials({
    printify: {
      apiToken: input?.token || (await getCredentials()).printify?.apiToken || "",
      shopId: String(gpsr.shopId || shopId),
      shopTitle: gpsr.shopTitle,
      gpsrStatus: gpsr.gpsrStatus,
      salesChannel: ping.salesChannel,
      fullyConnected: gpsr.fullyConnected,
      shops: gpsr.shopSummaries || ping.shopSummaries,
    },
  });
  const createdCount = products.filter((row) => !row.skipped).length;
  return {
    shopId,
    shopTitle: gpsr.shopTitle || ping.shopTitle,
    published: false,
    products,
    gpsr,
    fullyConnected: gpsr.fullyConnected,
    notes: [
      `Created ${createdCount} Printify product${createdCount === 1 ? "" : "s"} on ${
        gpsr.shopTitle || "Fernora Trends"
      } (${shopId}), one enabled variant each. Left unpublished — not migrated from Gelato.`,
      "Catalog dropdowns match Printify: All, Quotes, Botanical, Scenic, Home décor, Original fern.",
      ...extraNotes,
      ...gpsr.notes,
    ],
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
      shopSummaries: ping.shopSummaries,
      fullyConnected: false,
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
    shopSummaries: ping.shopSummaries,
    fullyConnected: ping.fullyConnected,
    notes: [...printifyGpsrNotes(gpsrStatus, products.length, updated), ...extraNotes],
  };
}
