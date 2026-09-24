import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CLOTHING_COLORS,
  TEE_COLOR_IMAGE,
  TEE_COLORS,
  TEE_PRINTIFY,
  ZIP_HOODIE_COLOR_IMAGE,
  ZIP_HOODIE_PRINTIFY,
} from "@/lib/clothing";
import { getCredentials, patchCredentials } from "@/lib/credentials";
import { galleryForListing } from "@/lib/listing-health";
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
  matchPrintifyColorSizes,
  mergePrintAreaVariantIds,
  printAreasForExistingVariants,
  printFileForPosition,
  printifyCatalogFile,
  printifyEnabledVariantIds,
  printifyImageFileName,
  printifyVariantsWithIds,
  uniquePrintFiles,
  type PrintifyCatalogVariant,
  type PrintifyImageIds,
  type PrintifyStarterSpec,
} from "@/lib/printify-products";
import { restoreLiveCatalogInShop } from "@/lib/drop";
import {
  inactivateOlderEtsyListings,
  listEtsyShopListings,
  syncEtsyCatalogSections,
  uploadEtsyListingImage,
} from "@/lib/etsy";
import { deleteOlderGelatoProducts } from "@/lib/gelato-store";
import { etsyListingUrl } from "@/lib/live-catalog";
import { deleteOlderShopifyProducts, syncFernoraCatalogToShopify } from "@/lib/shopify";
import { syncShopifyCatalogMenu } from "@/lib/shopify-horizon";
import { fillShopifyCollections, syncShopifyPresentmentPrices } from "@/lib/shopify-storefront";
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
  variants?: Array<{ id?: number; is_enabled?: boolean; cost?: number }>;
  images?: Array<{ src?: string; variant_ids?: number[]; position?: string }>;
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

async function uploadPrintifyImagesForSpec(spec: PrintifyStarterSpec, token?: string) {
  const byFile: Record<string, string> = {};
  for (const file of uniquePrintFiles(spec)) {
    const uploaded = await uploadPrintifyImage(file, token);
    byFile[file] = uploaded.id;
  }
  const images: Record<string, string> = {};
  for (const position of spec.positions) {
    images[position] = byFile[printFileForPosition(spec, position)];
  }
  return images;
}

async function refreshPrintifyPrintFile(
  shopId: number,
  productId: string,
  spec: PrintifyStarterSpec,
  token?: string,
) {
  const current = await getPrintifyProduct(shopId, productId, token);
  const images = await uploadPrintifyImagesForSpec(spec, token);
  const currentIds = (current.variants || []).map((variant) => variant.id).filter((id): id is number => Boolean(id));
  const catalogIds = await listBlueprintVariantIds(spec.blueprintId, spec.printProviderId, token);
  const variantIds = mergePrintAreaVariantIds(catalogIds, currentIds);
  await printify(`/shops/${shopId}/products/${productId}.json`, {
    method: "PUT",
    token,
    body: {
      title: spec.title,
      description: spec.description,
      tags: spec.tags,
      print_areas: printAreasForExistingVariants(spec, images, variantIds),
    },
  });
  try {
    await printify(`/shops/${shopId}/products/${productId}.json`, {
      method: "PUT",
      token,
      body: {
        variants: printifyVariantsWithIds(spec).map((variant) => ({
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

async function createPrintifyProduct(
  shopId: number,
  spec: PrintifyStarterSpec,
  images: PrintifyImageIds,
  token?: string,
) {
  const created = await printify<{ id: string; title?: string }>(`/shops/${shopId}/products.json`, {
    method: "POST",
    token,
    body: buildPrintifyProductPayload(spec, images),
  });
  if (!created.id) throw new Error(`Printify did not return a product id for ${spec.title}`);
  return created;
}

async function getPrintifyProduct(shopId: number, productId: string, token?: string) {
  return printify<PrintifyProduct>(`/shops/${shopId}/products/${productId}.json`, { token });
}

async function listBlueprintCatalog(blueprintId: number, printProviderId: number, token?: string) {
  const catalog = await printify<{ variants?: PrintifyCatalogVariant[] }>(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { token },
  );
  return catalog.variants || [];
}

async function listBlueprintVariantIds(blueprintId: number, printProviderId: number, token?: string) {
  const catalog = await listBlueprintCatalog(blueprintId, printProviderId, token);
  return catalog.map((variant) => variant.id).filter((id): id is number => Boolean(id));
}

/** Colour rows without a saved Printify id are matched on the blueprint so later apparel gets the same colours. */
async function resolveStarterSpec(spec: PrintifyStarterSpec, token?: string) {
  const needsMatch = spec.variants.some((variant) => variant.color && variant.size && typeof variant.id !== "number");
  if (!needsMatch) return spec;
  const catalog = await listBlueprintCatalog(spec.blueprintId, spec.printProviderId, token);
  return { ...spec, variants: matchPrintifyColorSizes(spec.variants, catalog) };
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
  return printifyVariantsWithIds(spec).map((variant) => variant.id);
}

function sameWantedVariants(spec: PrintifyStarterSpec, product: PrintifyProduct, title: string) {
  if ((product.title || "").trim() !== title.trim()) return false;
  const enabled = new Set(printifyEnabledVariantIds(product));
  const wanted = wantedVariantIds(spec);
  if (!wanted.length) return false;
  return wanted.every((id) => enabled.has(id));
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
  const unresolvedTitles = new Set<string>();
  for (const starter of FERNORA_PRINTIFY_STARTERS) {
    let spec = starter;
    try {
      spec = await resolveStarterSpec(starter, input?.token);
    } catch (error) {
      extraNotes.push(`${starter.title}: ${(error as Error).message}`);
      for (const title of [starter.title, ...(starter.aliases || [])]) {
        unresolvedTitles.add(title.trim().toLowerCase());
      }
      continue;
    }
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
    const images = await uploadPrintifyImagesForSpec(spec, input?.token);
    const created = await createPrintifyProduct(shopId, spec, images, input?.token);
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
  const extras = existing.filter(
    (row) => row.id && !claimed.has(row.id) && !unresolvedTitles.has((row.title || "").trim().toLowerCase()),
  );
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
    extraNotes.push(...(await syncShopifyPresentmentPrices()));
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
      `Catalog is nine products on ${
        gpsr.shopTitle || "Fernora Trends"
      } (${shopId}): five wall-art mixes, black-camo men’s and Southern Cross women’s mesh sneakers, the embroidered zip hoodie, and the embroidered heavy cotton tee. Created ${createdCount}, published ${publishedCount} to the Etsy sales channel. Not migrated from Gelato.`,
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

const PRINTIFY_FRONT_CAMERA = 108335;
const PRINTIFY_BACK_CAMERA = 108336;
const TEE_FRONT_CAMERA = 92575;
const TEE_BACK_CAMERA = 92571;
const TEE_NECK_CAMERA = 92586;
const HOODIE_PRINTIFY_ID = "6ab311b3f483ddf88402ac9b";
const TEE_PRINTIFY_ID = "6ab468c10f032ace3e089227";

async function downloadPrintifyMockup(url: string, dest: string) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Printify mockup ${response.status}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await response.arrayBuffer()));
}

function apparelPhotoPlan(key: string) {
  if (key === "live_tee_bloom") {
    return {
      colors: TEE_COLORS,
      variantId: (uid: string) => TEE_PRINTIFY[uid]?.m,
      fileForColor: (uid: string) =>
        TEE_COLOR_IMAGE[uid]?.replace("/catalog/", "") || `catalog-tee-bloom-${uid}.jpg`,
      backFile: "gallery-live_tee_bloom-back.jpg",
      modelFile: "gallery-live_tee_bloom-model.jpg",
      neckFile: "gallery-live_tee_bloom-neck.jpg",
      slug: "grow-with-purpose-embroidered-heavy-cotton-tee",
      frontCamera: TEE_FRONT_CAMERA,
      backCamera: TEE_BACK_CAMERA,
      neckCamera: TEE_NECK_CAMERA,
      defaultId: TEE_PRINTIFY_ID,
    };
  }
  return {
    colors: CLOTHING_COLORS,
    variantId: (uid: string) => ZIP_HOODIE_PRINTIFY[uid]?.m,
    fileForColor: (uid: string) =>
      ZIP_HOODIE_COLOR_IMAGE[uid]?.replace("/catalog/", "") || `catalog-hoodie-bloom-${uid}.jpg`,
    backFile: "gallery-live_hoodie_bloom-back.jpg",
    modelFile: "gallery-live_hoodie_bloom-model.jpg",
    neckFile: "",
    slug: "grow-with-purpose-embroidered-zip-hoodie",
    frontCamera: PRINTIFY_FRONT_CAMERA,
    backCamera: PRINTIFY_BACK_CAMERA,
    neckCamera: 0,
    defaultId: HOODIE_PRINTIFY_ID,
  };
}

/** Official Printify colour photos — never homemade garment composites. */
export async function pullPrintifyVariantPhotos(productId?: string, key = "live_hoodie_bloom") {
  const destDir = path.join(process.cwd(), "public", "catalog");
  const written: string[] = [];
  const plan = apparelPhotoPlan(key);
  const id = productId || plan.defaultId;
  for (const color of plan.colors) {
    const variantId = plan.variantId(color.uid);
    if (!variantId) continue;
    const file = plan.fileForColor(color.uid);
    const url = `https://images.printify.com/mockup/${id}/${variantId}/${plan.frontCamera}/${plan.slug}.jpg`;
    await downloadPrintifyMockup(url, path.join(destDir, file));
    written.push(`/catalog/${file}`);
  }
  const whiteM = plan.variantId("white");
  if (whiteM) {
    try {
      await downloadPrintifyMockup(
        `https://images.printify.com/mockup/${id}/${whiteM}/${plan.backCamera}/${plan.slug}.jpg`,
        path.join(destDir, plan.backFile),
      );
      written.push(`/catalog/${plan.backFile}`);
    } catch {
      /* back camera is optional if that view is not published */
    }
    if (plan.neckFile && plan.neckCamera) {
      try {
        await downloadPrintifyMockup(
          `https://images.printify.com/mockup/${id}/${whiteM}/${plan.neckCamera}/${plan.slug}.jpg`,
          path.join(destDir, plan.neckFile),
        );
        written.push(`/catalog/${plan.neckFile}`);
      } catch {
        /* neck close-up is optional */
      }
    }
    const whiteFront = path.join(destDir, plan.fileForColor("white"));
    const model = path.join(destDir, plan.modelFile);
    await writeFile(model, await readFile(whiteFront));
    written.push(`/catalog/${plan.modelFile}`);
  }
  return written;
}

async function pushOfficialPhotosToEtsy(key: string, listingId: string) {
  const notes: string[] = [];
  const files = galleryForListing(key)
    .filter((file) => !file.includes("/print-"))
    .slice(0, 9);
  const print = galleryForListing(key).find((file) => file.includes("/print-"));
  const ordered = print ? [...files, print] : files;
  for (const [index, file] of ordered.entries()) {
    const imagePath = path.join(process.cwd(), "public", file.replace(/^\//, ""));
    try {
      await uploadEtsyListingImage(listingId, imagePath, index + 1);
    } catch (error) {
      notes.push(`${file}: ${(error as Error).message}`);
    }
  }
  return notes;
}

/** Create or refresh one catalog product on Printify without deleting the rest. */
export async function upsertPrintifyCatalogItem(key: string) {
  const starter = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === key);
  if (!starter) throw new Error(`Unknown catalog product ${key}`);
  const spec = await resolveStarterSpec(starter);
  const ping = await pingPrintify();
  const shopId = ping.shopId;
  if (!shopId) throw new Error("No Printify shop on this token");
  const existing = await listShopProducts(shopId);
  const already = existingPrintifyProductId(existing, spec.title, spec.aliases);
  let productId = already;
  let created = false;
  if (already) {
    await refreshPrintifyPrintFile(shopId, already, spec);
  } else {
    const images = await uploadPrintifyImagesForSpec(spec);
    const product = await createPrintifyProduct(shopId, spec, images);
    productId = product.id;
    created = true;
  }
  if (!productId) throw new Error(`Printify did not return a product id for ${spec.title}`);
  const apparel = spec.key === "live_hoodie_bloom" || spec.key === "live_tee_bloom";
  if (apparel) {
    await new Promise((resolve) => setTimeout(resolve, 12000));
  }
  const photos = apparel ? await pullPrintifyVariantPhotos(productId, spec.key) : [];
  await publishPrintifyProduct(shopId, productId);
  const shopify = await syncFernoraCatalogToShopify(undefined, [key]);
  let etsyNotes: string[] = [];
  try {
    const current = await getPrintifyProduct(shopId, productId);
    const listingId = String(current.external?.id || "");
    if (listingId) {
      await updateShop((shop) => {
        const row = shop.listings.find((item) => item.id === key || item.title === spec.title);
        if (!row) return;
        row.etsyListingId = listingId;
        row.etsyUrl = current.external?.handle || etsyListingUrl(listingId);
        row.publishState = "live";
        row.state = "active";
      });
      etsyNotes = await pushOfficialPhotosToEtsy(key, listingId);
    }
  } catch (error) {
    etsyNotes.push(`Etsy photos: ${(error as Error).message}`);
  }
  return {
    productId,
    photos,
    created,
    notes: [
      created
        ? `Created ${spec.title} on Printify.`
        : `Refreshed ${spec.title} print file on Printify.`,
      photos.length ? `Pulled ${photos.length} official Printify photos.` : "",
      ...shopify.notes,
      ...etsyNotes,
    ].filter(Boolean),
  };
}

/** Refresh one catalog product on Printify without recreating the rest. Creates it if missing. */
export async function refreshPrintifyCatalogItem(key: string) {
  return upsertPrintifyCatalogItem(key);
}
