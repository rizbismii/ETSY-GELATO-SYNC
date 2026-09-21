import { readFile } from "node:fs/promises";
import { getCredentials, patchCredentials } from "@/lib/credentials";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyChannelKey,
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
  printAreasForExistingVariants,
  printifyCatalogFile,
  printifyEnabledVariantIds,
  printifyImageFileName,
  type PrintifyStarterSpec,
} from "@/lib/printify-products";
import { restoreLiveCatalogInShop } from "@/lib/drop";
import { inactivateOlderEtsyListings, listEtsyShopListings, syncEtsyCatalogSections } from "@/lib/etsy";
import { deleteOlderGelatoProducts } from "@/lib/gelato-store";
import { etsyListingUrl } from "@/lib/live-catalog";
import { deleteOlderShopifyProducts, syncFernoraCatalogToShopify } from "@/lib/shopify";
import { syncShopifyCatalogMenu } from "@/lib/shopify-horizon";
import { fillShopifyCollections } from "@/lib/shopify-storefront";
import { updateShop } from "@/lib/store";

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
  external?: { id?: string; handle?: string };
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
  printRefreshed?: boolean;
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

async function refreshPrintifyPrintFile(
  shopId: number,
  productId: string,
  spec: PrintifyStarterSpec,
  token?: string,
) {
  const current = await getPrintifyProduct(shopId, productId, token);
  const image = await uploadPrintifyImage(spec.printFile, token);
  const variantIds = (current.variants || []).map((variant) => variant.id).filter((id): id is number => Boolean(id));
  await printify(`/shops/${shopId}/products/${productId}.json`, {
    method: "PUT",
    token,
    body: {
      tags: spec.tags,
      print_areas: printAreasForExistingVariants(spec, image.id, variantIds),
    },
  });
  try {
    await printify(`/shops/${shopId}/products/${productId}.json`, {
      method: "PUT",
      token,
      body: {
        variants: spec.variants.map((variant) => ({
          id: variant.id,
          price: variant.price,
          is_enabled: variant.is_enabled,
          ...(variant.is_default ? { is_default: true } : {}),
        })),
      },
    });
  } catch {
    /* price PUT can fail if Printify wants every blueprint variant; tags and print still saved */
  }
  return image.id;
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

export async function deletePrintifyProductByTitle(title: string, token?: string) {
  const ping = await pingPrintify(token);
  const shopId = ping.shopId;
  if (!shopId) return { deleted: false, note: "No Printify shop on this token" };
  const existing = await listShopProducts(shopId);
  const id = existingPrintifyProductId(existing, title);
  if (!id) return { deleted: false, note: "Not found on Printify" };
  await deletePrintifyProduct(shopId, id, token);
  return { deleted: true, id };
}

async function publishPrintifyProduct(shopId: number, productId: string, token?: string) {
  const body = {
    title: true,
    description: true,
    images: true,
    variants: true,
    tags: true,
    keyFeatures: true,
    shipping_template: true,
  };
  try {
    await printify(`/shops/${shopId}/products/${productId}/publish.json`, { method: "POST", token, body });
  } catch (error) {
    const message = (error as Error).message;
    if (!/shipping/i.test(message)) throw error;
    await printify(`/shops/${shopId}/products/${productId}/publish.json`, {
      method: "POST",
      token,
      body: { ...body, shipping_template: false },
    });
  }
}

async function attachPrintifyEtsyIds(
  shopId: number,
  products: CreatedPrintifyProduct[],
  token?: string,
) {
  const notes: string[] = [];
  let etsyByTitle = new Map<string, string>();
  try {
    const listings = await listEtsyShopListings(["active", "draft"]);
    etsyByTitle = new Map(
      listings
        .filter((row) => row.listing_id && row.title)
        .map((row) => [(row.title || "").trim().toLowerCase(), String(row.listing_id)]),
    );
  } catch (error) {
    notes.push(`Etsy listing match: ${(error as Error).message}`);
  }
  let attached = 0;
  for (const product of products) {
    let listingId = "";
    let url: string | undefined;
    try {
      const current = await getPrintifyProduct(shopId, product.id, token);
      listingId = String(current.external?.id || "");
      url = current.external?.handle;
    } catch (error) {
      notes.push(`Printify ${product.title}: ${(error as Error).message}`);
    }
    if (!listingId) listingId = etsyByTitle.get(product.title.trim().toLowerCase()) || "";
    if (!listingId) continue;
    url = url || etsyListingUrl(listingId);
    await updateShop((shop) => {
      const row = shop.listings.find((item) => item.id === product.key || item.title === product.title);
      if (!row) return;
      row.etsyListingId = listingId;
      row.etsyUrl = url;
      row.publishState = "live";
      row.state = "active";
    });
    attached += 1;
  }
  notes.unshift(
    attached
      ? `Pressroom Catalog now shows ${attached} live Etsy listing${attached === 1 ? "" : "s"}.`
      : "Printify published, but Etsy listing IDs are not on Catalog yet.",
  );
  return notes;
}

function wantedVariantIds(spec: PrintifyStarterSpec) {
  return spec.variants.filter((variant) => variant.is_enabled).map((variant) => variant.id);
}

function sameWantedVariants(spec: PrintifyStarterSpec, product: PrintifyProduct, title: string) {
  if ((product.title || "").trim() !== title.trim()) return false;
  const enabled = printifyEnabledVariantIds(product);
  const wanted = wantedVariantIds(spec);
  if (enabled.length !== wanted.length) return false;
  const want = new Set(wanted);
  return enabled.every((id) => typeof id === "number" && want.has(id));
}

async function deleteLeftoverDisconnectedPrintifyProducts(token?: string) {
  const shops = await listPrintifyShops(token);
  const keep = new Set(
    FERNORA_PRINTIFY_STARTERS.flatMap((spec) => [spec.title, ...(spec.aliases || [])]).map((title) =>
      title.trim().toLowerCase(),
    ),
  );
  const notes: string[] = [];
  for (const shop of shops) {
    if (printifyChannelKey(shop.sales_channel) !== "disconnected") continue;
    const existing = await listShopProducts(shop.id);
    let deleted = 0;
    for (const product of existing) {
      if (!product.id) continue;
      if (keep.has((product.title || "").trim().toLowerCase())) continue;
      try {
        await deletePrintifyProduct(shop.id, product.id, token);
        deleted += 1;
      } catch (error) {
        notes.push(`${product.title || product.id}: ${(error as Error).message}`);
      }
    }
    if (deleted) {
      notes.push(
        `Deleted ${deleted} leftover product${deleted === 1 ? "" : "s"} from disconnected ${shop.title || "shop"} (${shop.id}). Catalog with print templates is on the Etsy-connected Fernora Trends shop.`,
      );
    }
  }
  return notes;
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
      if (sameWantedVariants(spec, current, spec.title)) {
        claimed.add(already);
        try {
          await refreshPrintifyPrintFile(shopId, already, spec, input?.token);
          products.push({
            key: spec.key,
            id: already,
            title: spec.title,
            skipped: true,
            printRefreshed: true,
          });
          extraNotes.push(
            `Refreshed the ${spec.title} print file, 13 listing-health tags, and Printify price.`,
          );
          continue;
        } catch (error) {
          extraNotes.push(`Print refresh ${spec.title}: ${(error as Error).message}`);
        }
      }
      await deletePrintifyProduct(shopId, already, input?.token);
      const idx = existing.findIndex((row) => row.id === already);
      if (idx >= 0) existing.splice(idx, 1);
      extraNotes.push(`Replaced ${current.title || spec.title} with the catalog variants.`);
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
  const extras = existing.filter((row) => row.id && !claimed.has(row.id));
  let removedPrintify = 0;
  for (const extra of extras) {
    if (!extra.id) continue;
    try {
      await deletePrintifyProduct(shopId, extra.id, input?.token);
      removedPrintify += 1;
    } catch (error) {
      extraNotes.push(`Printify extra ${extra.title || extra.id}: ${(error as Error).message}`);
    }
  }
  if (removedPrintify) {
    extraNotes.push(
      `Deleted ${removedPrintify} older Printify product${removedPrintify === 1 ? "" : "s"} from ${shopId}.`,
    );
  }
  try {
    extraNotes.push(...(await deleteLeftoverDisconnectedPrintifyProducts(input?.token)));
  } catch (error) {
    extraNotes.push(`Disconnected Printify shop: ${(error as Error).message}`);
  }
  await updateShop((shop) => {
    restoreLiveCatalogInShop(shop);
  });
  try {
    extraNotes.push(...(await deleteOlderGelatoProducts()).notes);
  } catch (error) {
    extraNotes.push(`Gelato cleanup: ${(error as Error).message}`);
  }
  try {
    extraNotes.push(...(await inactivateOlderEtsyListings()).notes);
  } catch (error) {
    extraNotes.push(`Etsy cleanup: ${(error as Error).message}`);
  }
  try {
    extraNotes.push(...(await deleteOlderShopifyProducts()).notes);
  } catch (error) {
    extraNotes.push(`Shopify cleanup: ${(error as Error).message}`);
  }
  let publishedCount = 0;
  for (const product of products) {
    try {
      await publishPrintifyProduct(shopId, product.id, input?.token);
      publishedCount += 1;
    } catch (error) {
      extraNotes.push(`Printify publish ${product.title}: ${(error as Error).message}`);
    }
  }
  try {
    extraNotes.push(...(await attachPrintifyEtsyIds(shopId, products, input?.token)));
  } catch (error) {
    extraNotes.push(`Catalog Etsy IDs: ${(error as Error).message}`);
  }
  try {
    extraNotes.push(...(await syncFernoraCatalogToShopify()).notes);
    extraNotes.push(...(await fillShopifyCollections()));
  } catch (error) {
    extraNotes.push(`Shopify catalog: ${(error as Error).message}`);
  }
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
  const published = publishedCount === products.length && products.length > 0;
  return {
    shopId,
    shopTitle: gpsr.shopTitle || ping.shopTitle,
    published,
    products,
    gpsr,
    fullyConnected: gpsr.fullyConnected,
    notes: [
      `Catalog is seven products on ${
        gpsr.shopTitle || "Fernora Trends"
      } (${shopId}): five wall-art mixes plus men’s and women’s Southern Cross mesh sneakers. Created ${createdCount}, published ${publishedCount} to the Etsy sales channel. Not migrated from Gelato.`,
      "Older catalog products were removed from Printify, Etsy, Shopify, Gelato, and Pressroom.",
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
