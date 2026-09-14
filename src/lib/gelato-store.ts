import { getCredentials } from "@/lib/credentials";
import { absoluteAssetUrl } from "@/lib/origin";
import { clothingVariants, defaultClothingVariant, isClothingCategory, matchClothingVariant } from "@/lib/clothing";
import { ETSY_KNOWN_LISTINGS, liveProductById } from "@/lib/live-catalog";
import type { Listing } from "@/lib/types";

const ECOM_API = "https://ecommerce.gelatoapis.com/v1";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type GelatoStoreProduct = {
  id: string;
  storeId?: string;
  externalId?: string;
  title?: string;
  variants?: GelatoStoreVariant[];
};

export type GelatoStoreVariant = {
  id: string;
  productId?: string;
  title?: string;
  externalId?: string;
  connectionStatus?: string;
  productUid?: string | null;
};

async function ecommerceFetch(url: string, init?: RequestInit) {
  const creds = await getCredentials();
  if (!creds.gelatoApiKey) throw new Error("Gelato API key is not configured");
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": creds.gelatoApiKey,
      "User-Agent": CHROME_UA,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.message || body.error?.message || body.error || `Gelato ecommerce ${response.status}`);
  }
  return body;
}

export async function getGelatoEtsyStore() {
  const body = await ecommerceFetch(`${ECOM_API}/stores`);
  const stores = (body.stores ?? body ?? []) as Array<{ id: string; name?: string; type?: string }>;
  const list = Array.isArray(stores) ? stores : [];
  const etsy = list.find((row) => row.type === "etsy") || list[0];
  if (!etsy?.id) throw new Error("No Gelato ecommerce store is connected");
  return etsy;
}

export async function listGelatoStoreProducts(storeId: string) {
  const products: GelatoStoreProduct[] = [];
  let offset = 0;
  const limit = 50;
  for (let page = 0; page < 10; page += 1) {
    const body = await ecommerceFetch(`${ECOM_API}/stores/${storeId}/products?limit=${limit}&offset=${offset}`);
    const batch = (body.products ?? []) as GelatoStoreProduct[];
    products.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return products;
}

export async function getGelatoStoreProduct(storeId: string, productId: string) {
  return (await ecommerceFetch(`${ECOM_API}/stores/${storeId}/products/${productId}`)) as GelatoStoreProduct;
}

export async function syncGelatoStore(storeId: string) {
  return ecommerceFetch(`${ECOM_API}/stores/${storeId}:sync`, { method: "POST", body: "{}" });
}

export async function connectGelatoVariant(
  storeId: string,
  productId: string,
  variantId: string,
  input: { productUid: string; printFileUrl: string },
) {
  const printUrl = await absoluteAssetUrl(input.printFileUrl);
  return ecommerceFetch(`${ECOM_API}/stores/${storeId}/products/${productId}/variants/${variantId}`, {
    method: "PUT",
    body: JSON.stringify({
      productUid: input.productUid,
      files: [{ type: "default", url: printUrl }],
      connectionStatus: "connected",
    }),
  });
}

export async function createGelatoStoreVariant(
  storeId: string,
  productId: string,
  input: {
    title: string;
    productUid: string;
    price: number;
    currency: string;
    cost?: number;
  },
) {
  return ecommerceFetch(`${ECOM_API}/stores/${storeId}/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      productUid: input.productUid,
      price: input.price,
      cost: input.cost ?? 0,
      currency: input.currency,
    }),
  }) as Promise<GelatoStoreVariant>;
}

export async function deleteGelatoStoreProduct(storeId: string, productId: string) {
  const creds = await getCredentials();
  if (!creds.gelatoApiKey) throw new Error("Gelato API key is not configured");
  const response = await fetch(`${ECOM_API}/stores/${storeId}/products/${productId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "X-API-KEY": creds.gelatoApiKey,
      "User-Agent": CHROME_UA,
    },
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    let message = `Gelato delete ${response.status}`;
    try {
      const body = text ? JSON.parse(text) : {};
      message = body.message || body.error?.message || body.error || message;
    } catch {
      /* use status */
    }
    throw new Error(message);
  }
}

export function findStoreProductForListing(products: GelatoStoreProduct[], listing: Listing) {
  const etsyId = listing.etsyListingId || ETSY_KNOWN_LISTINGS[listing.id]?.id;
  if (etsyId) {
    const byExternal = products.find((row) => String(row.externalId) === String(etsyId));
    if (byExternal) return byExternal;
  }
  const title = listing.title.toLowerCase();
  return products.find((row) => (row.title || "").toLowerCase() === title);
}

function uidForVariant(listing: Listing, variant: GelatoStoreVariant) {
  const catalog = liveProductById(listing.id);
  const variants = listing.variants?.length
    ? listing.variants
    : catalog?.variants?.length
      ? catalog.variants
      : clothingVariants(listing.id, listing.category);
  if (isClothingCategory(listing.category) && variants.length) {
    const matched = matchClothingVariant(variant.title || "", variants);
    return matched?.gelatoProductUid || defaultClothingVariant(variants)?.gelatoProductUid || listing.gelatoProductUid;
  }
  return listing.gelatoProductUid;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectListingToGelatoStore(
  storeId: string,
  listing: Listing,
  storeProduct: GelatoStoreProduct,
) {
  const notes: string[] = [];
  const printFileUrl = listing.printFileUrl || liveProductById(listing.id)?.printFileUrl;
  const productUid = listing.gelatoProductUid;
  if (!printFileUrl || !productUid) {
    throw new Error(`${listing.title} is missing a Gelato product or print file`);
  }

  let product = await getGelatoStoreProduct(storeId, storeProduct.id);
  const wanted = isClothingCategory(listing.category)
    ? listing.variants?.length || clothingVariants(listing.id, listing.category).length
    : 1;

  if (isClothingCategory(listing.category) && (product.variants?.length || 0) < wanted) {
    const existingTitles = new Set((product.variants || []).map((row) => (row.title || "").toLowerCase()));
    const variants = listing.variants?.length ? listing.variants : clothingVariants(listing.id, listing.category);
    for (const variant of variants) {
      const title = `${variant.color} - ${variant.size}`;
      if (existingTitles.has(title.toLowerCase()) || existingTitles.has(`${variant.color} / ${variant.size}`.toLowerCase())) {
        continue;
      }
      if ((product.variants || []).length >= wanted) break;
      try {
        await createGelatoStoreVariant(storeId, product.id, {
          title,
          productUid: variant.gelatoProductUid,
          price: listing.price,
          currency: listing.currency || "NZD",
          cost: listing.gelatoUnitCost,
        });
        existingTitles.add(title.toLowerCase());
      } catch (error) {
        notes.push(`${listing.title} ${title}: ${(error as Error).message}`);
      }
    }
    product = await getGelatoStoreProduct(storeId, storeProduct.id);
  }

  let connected = 0;
  for (const variant of product.variants || []) {
    const uid = uidForVariant(listing, variant) || productUid;
    try {
      await connectGelatoVariant(storeId, product.id, variant.id, {
        productUid: uid,
        printFileUrl,
      });
      connected += 1;
      await sleep(120);
    } catch (error) {
      notes.push(`${listing.title} variant ${variant.title || variant.id}: ${(error as Error).message}`);
    }
  }

  return {
    storeProductId: product.id,
    connected,
    total: product.variants?.length || 0,
    notes,
  };
}
