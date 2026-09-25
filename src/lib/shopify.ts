import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultClothingVariant } from "@/lib/clothing";
import { isDesignZoomStill, isTemplateStillPath, isTinyDesignStill } from "@/lib/listing-health";
import { getCredentials, normalizeShopDomain, patchCredentials } from "@/lib/credentials";
import { fernoraCatalog, FERNORA_NAME, gelatoShipFamilies, shopLane } from "@/lib/shop";
import { FERNORA_SHOPIFY_SHOP, FERNORA_STOREFRONT_ORIGIN } from "@/lib/shopify-shop";
import { gelatoCodesForLane } from "@/lib/gelato-countries";
import { policyHtml } from "@/lib/shop-policies";
import { absoluteAssetUrl } from "@/lib/origin";
import { getShop, updateShop } from "@/lib/store";
import { getDeletedListingIds } from "@/lib/tombstones";
import type { ShopifyCatalogMap } from "@/lib/types";

const API_VERSION = "2025-10";
export const SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_orders",
  "write_orders",
  "read_draft_orders",
  "write_draft_orders",
  "read_fulfillments",
  "write_fulfillments",
  "read_merchant_managed_fulfillment_orders",
  "write_merchant_managed_fulfillment_orders",
  "read_locations",
  "read_shipping",
  "write_shipping",
  "read_markets",
  "write_markets",
  "read_files",
  "write_files",
  "read_publications",
  "write_publications",
  "read_themes",
  "write_themes",
].join(",");

export function shopifyAuthorizeUrl(shop: string, clientId: string, redirectUri: string, state: string) {
  const host = normalizeShopDomain(shop) || shop;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${host}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyShopifyHmac(search: URLSearchParams, secret: string) {
  const hmac = search.get("hmac");
  if (!hmac) return false;
  const message = [...search.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function probeShopifyStore(shop = FERNORA_SHOPIFY_SHOP) {
  const host = normalizeShopDomain(shop) || shop;
  try {
    const response = await fetch(`https://${host}/`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 402) return "frozen" as const;
    if (response.status === 404) return "missing" as const;
    if (response.status >= 200 && response.status < 400) return "live" as const;
    if (response.status === 430 || response.status === 423) return "frozen" as const;
    return "unknown" as const;
  } catch {
    return "unknown" as const;
  }
}

async function tokenEndpoint(shop: string) {
  return `https://${normalizeShopDomain(shop)}/admin/oauth/access_token`;
}

export async function exchangeShopifyCode(shop: string, code: string) {
  const creds = await getCredentials();
  if (!creds.shopify?.clientId || !creds.shopify.clientSecret) {
    throw new Error("Save the Shopify client ID and secret first");
  }
  const response = await fetch(await tokenEndpoint(shop), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: creds.shopify.clientId,
      client_secret: creds.shopify.clientSecret,
      code,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `Shopify token exchange failed (${response.status})`);
  }
  const status = await probeShopifyStore(shop);
  await patchCredentials({
    shopify: {
      ...creds.shopify,
      shop: normalizeShopDomain(shop),
      accessToken: body.access_token,
      scope: body.scope,
      expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined,
      storefrontStatus: status,
    },
  });
  return body.access_token;
}

export async function refreshShopifyClientCredentials() {
  const creds = await getCredentials();
  if (!creds.shopify?.clientId || !creds.shopify.clientSecret || !creds.shopify.shop) {
    throw new Error("Shopify app is not configured");
  }
  const response = await fetch(await tokenEndpoint(creds.shopify.shop), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.shopify.clientId,
      client_secret: creds.shopify.clientSecret,
    }),
  });
  const text = await response.text();
  const body = (() => {
    try {
      return JSON.parse(text) as {
        access_token?: string;
        scope?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };
    } catch {
      return { error: text.slice(0, 400) };
    }
  })();
  if (!response.ok || !body.access_token) {
    const raw = typeof body.error === "string" ? body.error : "";
    let message = body.error_description || raw || `Shopify client credentials failed (${response.status})`;
    if (/app_not_installed/i.test(message) || /app_not_installed/i.test(JSON.stringify(body))) {
      message =
        "The app is not installed on this shop yet. In Dev Dashboard open the app → Home → Install app → choose this shop → Install. Then click Authorize Shopify.";
    } else if (/shop_not_permitted/i.test(message)) {
      message =
        "Client credentials only work when this shop is in the same Shopify organization as the Dev Dashboard app.";
    }
    throw new Error(message);
  }
  await patchCredentials({
    shopify: {
      ...creds.shopify,
      accessToken: body.access_token,
      scope: body.scope,
      expiresAt: Date.now() + (body.expires_in || 86400) * 1000,
    },
  });
  return body.access_token;
}

export async function getShopifyToken() {
  const creds = await getCredentials();
  if (!creds.shopify?.shop) throw new Error("Shopify shop domain is not set");
  if (creds.shopify.accessToken && (!creds.shopify.expiresAt || creds.shopify.expiresAt > Date.now() + 60_000)) {
    return creds.shopify.accessToken;
  }
  try {
    return await refreshShopifyClientCredentials();
  } catch (error) {
    if (creds.shopify.accessToken) return creds.shopify.accessToken;
    throw error;
  }
}

type GqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

export async function shopifyGraphql<T>(query: string, variables?: Record<string, unknown>) {
  const creds = await getCredentials();
  const shop = creds.shopify?.shop;
  if (!shop) throw new Error("Shopify shop domain is not set");
  const token = await getShopifyToken();
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await response.json()) as GqlResponse<T> & { message?: string };
  if (!response.ok) {
    throw new Error(json.message || `Shopify GraphQL ${response.status}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((row) => row.message).join("; "));
  }
  if (!json.data) throw new Error("Shopify returned no data");
  return json.data;
}

export async function pingShopify() {
  const creds = await getCredentials();
  const storefrontStatus = await probeShopifyStore(creds.shopify?.shop || FERNORA_SHOPIFY_SHOP);
  if (creds.shopify && creds.shopify.storefrontStatus !== storefrontStatus) {
    await patchCredentials({ shopify: { ...creds.shopify, storefrontStatus } });
  }
  if (!creds.shopify?.accessToken && !creds.shopify?.clientId) {
    return { ok: false as const, storefrontStatus, error: "Shopify app is not configured" };
  }
  if (!creds.shopify?.accessToken) {
    return {
      ok: false as const,
      storefrontStatus,
      shop: creds.shopify?.shop,
      error:
        storefrontStatus === "frozen"
          ? "Storefront is frozen until a Shopify plan is paid, and the app is not installed yet"
          : "Release App URL + Redirect URL on a Dev Dashboard version (not Credentials), then Authorize",
    };
  }
  try {
    const data = await shopifyGraphql<{ shop: { name: string; primaryDomain?: { url: string } } }>(
      `{ shop { name primaryDomain { url } } }`,
    );
    return {
      ok: true as const,
      storefrontStatus,
      shop: creds.shopify?.shop,
      name: data.shop.name,
      url: data.shop.primaryDomain?.url,
    };
  } catch (error) {
    return {
      ok: false as const,
      storefrontStatus,
      shop: creds.shopify?.shop,
      error: (error as Error).message,
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shopifyProductOptions(product: ReturnType<typeof fernoraCatalog>[number]) {
  if (!product.variants?.length) {
    return {
      productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
      variants: [
        {
          optionValues: [{ optionName: "Title", name: "Default Title" }],
          price: product.price.toFixed(2),
          sku: product.id,
          inventoryPolicy: "CONTINUE",
        },
      ],
    };
  }
  const colors = [...new Map(product.variants.map((row) => [row.color, { name: row.color }])).values()];
  const sizes = [...new Map(product.variants.map((row) => [row.size, { name: row.size }])).values()];
  if (colors.length > 1) {
    return {
      productOptions: [
        { name: "Color", values: colors },
        { name: "Size", values: sizes },
      ],
      variants: product.variants.map((variant) => ({
        optionValues: [
          { optionName: "Color", name: variant.color },
          { optionName: "Size", name: variant.size },
        ],
        price: product.price.toFixed(2),
        sku: variant.sku,
        inventoryPolicy: "CONTINUE",
      })),
    };
  }
  return {
    productOptions: [{ name: "Size", values: sizes }],
    variants: product.variants.map((variant) => ({
      optionValues: [{ optionName: "Size", name: variant.size }],
      price: product.price.toFixed(2),
      sku: variant.sku,
      inventoryPolicy: "CONTINUE",
    })),
  };
}

function defaultProductSku(product: ReturnType<typeof fernoraCatalog>[number]) {
  return defaultClothingVariant(product.variants)?.sku || product.id;
}

function productSkuQuery(product: ReturnType<typeof fernoraCatalog>[number]) {
  const defaultSku = defaultProductSku(product);
  if (!product.variants?.length) return `sku:${product.id}`;
  const firstSku = product.variants[0].sku;
  const parts = [`sku:${product.id}`, `sku:${firstSku}`];
  if (defaultSku !== product.id && defaultSku !== firstSku) parts.push(`sku:${defaultSku}`);
  return parts.join(" OR ");
}

async function stageLocalCatalogImage(assetPath: string) {
  const rel = assetPath.replace(/^\//, "").split("?")[0];
  const filename = path.basename(rel);
  const bytes = await readFile(path.join(process.cwd(), "public", rel));
  const mimeType = /\.jpe?g$/i.test(filename) ? "image/jpeg" : "image/png";
  const staged = await shopifyGraphql<{
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl?: string | null;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `mutation ($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename,
          mimeType,
          resource: "FILE",
          httpMethod: "POST",
          fileSize: String(bytes.byteLength),
        },
      ],
    },
  );
  if (staged.stagedUploadsCreate.userErrors.length) {
    throw new Error(staged.stagedUploadsCreate.userErrors.map((row) => row.message).join("; "));
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target?.url) throw new Error("Shopify did not return a staged upload");
  const form = new FormData();
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  form.append("file", new Blob([bytes], { type: mimeType }), filename);
  const uploaded = await fetch(target.url, { method: "POST", body: form });
  if (!uploaded.ok) throw new Error(`Catalog image upload failed (${uploaded.status})`);
  if (!target.resourceUrl) throw new Error("Shopify staged upload had no resource URL");
  return target.resourceUrl;
}

async function catalogProductImageSource(assetPath: string, request?: Request) {
  try {
    return await stageLocalCatalogImage(assetPath);
  } catch {
    return absoluteAssetUrl(assetPath, request);
  }
}

function customerGalleryPaths(product: ReturnType<typeof fernoraCatalog>[number]) {
  const skip = new Set(
    [
      product.printFileUrl,
      ...(product.gallery || []).filter((file) => isTemplateStillPath(file) || isTinyDesignStill(file)),
    ].filter(
      Boolean,
    ) as string[],
  );
  const variantImages = (product.variants || []).map((row) => row.imageUrl);
  const design = (product.gallery || []).filter((file) => isDesignZoomStill(file));
  const rest = (product.gallery || []).filter((file) => !design.includes(file));
  const files = [product.imageUrl, ...design, ...variantImages, ...rest].filter(
    (file): file is string => typeof file === "string" && !skip.has(file),
  );
  return [...new Set(files)].filter((file) => {
    const rel = file.replace(/^\//, "").split("?")[0];
    return existsSync(path.join(process.cwd(), "public", rel));
  });
}

function mediaFilename(url?: string | null, alt?: string | null) {
  const fromUrl = url?.split("?")[0]?.split("/").pop()?.toLowerCase() || "";
  const fromAlt = alt?.split("/").pop()?.toLowerCase() || "";
  return fromUrl || fromAlt;
}

async function ensureShopifyProductGallery(
  productId: string,
  product: ReturnType<typeof fernoraCatalog>[number],
  request?: Request,
) {
  const wanted = customerGalleryPaths(product);
  if (!wanted.length) return;
  const listed = await shopifyGraphql<{
    product?: {
      media: {
        nodes: Array<{
          id: string;
          alt?: string | null;
          preview?: { image?: { url?: string | null } | null } | null;
        }>;
      };
    } | null;
  }>(
    `query ($id: ID!) {
      product(id: $id) {
        media(first: 30) {
          nodes {
            id
            alt
            preview { image { url } }
          }
        }
      }
    }`,
    { id: productId },
  );
  const current = listed.product?.media.nodes || [];
  const have = new Set(current.map((row) => mediaFilename(row.preview?.image?.url, row.alt)));
  const wantedNames = wanted.map((file) => file.split("/").pop()?.toLowerCase() || "").filter(Boolean);
  const refreshNames = wanted.filter((file) => isDesignZoomStill(file)).map((file) => file.split("/").pop()?.toLowerCase() || "");
  const stale = current.filter((row) => {
    const name = mediaFilename(row.preview?.image?.url, row.alt);
    if (!name) return false;
    const refresh = refreshNames.some((wantedName) => wantedName && (name.includes(wantedName) || wantedName.includes(name)));
    const leftover = !wantedNames.some((wantedName) => name.includes(wantedName) || wantedName.includes(name));
    return leftover || refresh;
  });
  if (stale.length) {
    await shopifyGraphql(
      `mutation ($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          mediaUserErrors { field message }
        }
      }`,
      { productId, mediaIds: stale.map((row) => row.id) },
    );
  }
  const missing = wanted.filter((file) => {
    const name = file.split("/").pop()?.toLowerCase() || "";
    if (isDesignZoomStill(file)) return Boolean(name);
    return name && ![...have].some((existing) => existing.includes(name) || name.includes(existing));
  });
  if (missing.length) {
    const media = [];
    for (const file of missing) {
      media.push({
        originalSource: await catalogProductImageSource(file, request),
        alt: `${product.title} · ${file.split("/").pop()}`,
        mediaContentType: "IMAGE",
      });
    }
    const created = await shopifyGraphql<{
      productCreateMedia: { mediaUserErrors: Array<{ message: string }> };
    }>(
      `mutation ($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media { ... on MediaImage { id } }
          mediaUserErrors { field message }
        }
      }`,
      { productId, media },
    );
    if (created.productCreateMedia.mediaUserErrors.length) {
      throw new Error(created.productCreateMedia.mediaUserErrors.map((row) => row.message).join("; "));
    }
  }
  const after = await shopifyGraphql<{
    product?: { media: { nodes: Array<{ id: string; preview?: { image?: { url?: string | null } | null } | null }> } } | null;
  }>(
    `query ($id: ID!) {
      product(id: $id) {
        media(first: 30) { nodes { id preview { image { url } } } }
      }
    }`,
    { id: productId },
  );
  const nodes = after.product?.media.nodes || [];
  const moves: Array<{ id: string; newPosition: string }> = [];
  wanted.forEach((file, index) => {
    const name = file.split("/").pop()?.toLowerCase() || "";
    const match = nodes.find((row) => {
      const existing = mediaFilename(row.preview?.image?.url);
      return existing && name && (existing.includes(name) || name.includes(existing));
    });
    if (match && !moves.some((row) => row.id === match.id)) {
      moves.push({ id: match.id, newPosition: String(index) });
    }
  });
  if (moves.length) {
    await shopifyGraphql(
      `mutation ($id: ID!, $moves: [MoveInput!]!) {
        productReorderMedia(id: $id, moves: $moves) { userErrors { field message } }
      }`,
      { id: productId, moves },
    );
  }
}

function mediaStem(name: string) {
  const base = (name.split("?")[0].split("/").pop() || "").toLowerCase();
  return base.replace(/\.[a-z0-9]+$/, "").replace(/_[0-9a-f]{8}-[0-9a-f-]{20,}$/i, "");
}

/** Horizon swaps the photo only when the selected variant has its own media. */
async function attachShopifyVariantColorMedia(
  productId: string,
  product: ReturnType<typeof fernoraCatalog>[number],
) {
  const stemByColor = new Map<string, string>();
  for (const row of product.variants || []) {
    if (!row.color || !row.imageUrl || stemByColor.has(row.color)) continue;
    stemByColor.set(row.color, mediaStem(row.imageUrl));
  }
  if (stemByColor.size < 2) return;
  type ListedProduct = {
    product?: {
      variants: { nodes: Array<{ id: string; selectedOptions: Array<{ name: string; value: string }> }> };
      media: {
        nodes: Array<{
          id: string;
          alt?: string | null;
          status?: string | null;
          preview?: { image?: { url?: string | null } | null } | null;
        }>;
      };
    } | null;
  };
  const mediaQuery = `query ($id: ID!) {
    product(id: $id) {
      variants(first: 50) { nodes { id selectedOptions { name value } } }
      media(first: 30) { nodes { id alt status preview { image { url } } } }
    }
  }`;
  let listed = await shopifyGraphql<ListedProduct>(mediaQuery, { id: productId });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const pending = (listed.product?.media.nodes || []).some(
      (row) => row.status && row.status !== "READY" && row.status !== "FAILED",
    );
    if (!pending) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    listed = await shopifyGraphql<ListedProduct>(mediaQuery, { id: productId });
  }
  const media = listed.product?.media.nodes || [];
  const variantMedia: Array<{ variantId: string; mediaIds: string[] }> = [];
  for (const variant of listed.product?.variants.nodes || []) {
    const color = variant.selectedOptions.find((option) => option.name === "Color")?.value;
    const stem = color ? stemByColor.get(color) : undefined;
    if (!stem) continue;
    const match = media.find((row) => {
      const fromUrl = mediaStem(row.preview?.image?.url || "");
      const alt = (row.alt || "").toLowerCase();
      return fromUrl === stem || alt.endsWith(`${stem}.jpg`) || alt.endsWith(`${stem}.png`);
    });
    if (!match) continue;
    variantMedia.push({ variantId: variant.id, mediaIds: [match.id] });
  }
  if (!variantMedia.length) return;
  const attached = await shopifyGraphql<{
    productVariantAppendMedia: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
      productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
        userErrors { field message }
      }
    }`,
    { productId, variantMedia },
  );
  if (attached.productVariantAppendMedia.userErrors.length) {
    throw new Error(attached.productVariantAppendMedia.userErrors.map((row) => row.message).join("; "));
  }
}

async function shopifyVariantsWithColorPhotos(
  product: ReturnType<typeof fernoraCatalog>[number],
  clothing: ReturnType<typeof shopifyProductOptions>,
  request?: Request,
) {
  const colors = [...new Set((product.variants || []).map((row) => row.color))];
  if (colors.length < 2) return clothing;
  const sourceByColor = new Map<string, string>();
  for (const row of product.variants || []) {
    if (!row.imageUrl || sourceByColor.has(row.color)) continue;
    sourceByColor.set(row.color, await catalogProductImageSource(row.imageUrl, request));
  }
  return {
    ...clothing,
    variants: clothing.variants.map((variant) => {
      const color = variant.optionValues.find((option) => option.optionName === "Color")?.name;
      const originalSource = color ? sourceByColor.get(color) : undefined;
      if (!originalSource) return variant;
      return {
        ...variant,
        file: {
          originalSource,
          contentType: "IMAGE",
          alt: `${product.title} · ${color}`,
        },
      };
    }),
  };
}

export async function syncFernoraCatalogToShopify(request?: Request, onlyIds?: string[]) {
  const notes: string[] = [];
  const catalog: ShopifyCatalogMap = {};
  const wanted = new Set((onlyIds || []).map((id) => id.trim()).filter(Boolean));
  const products = fernoraCatalog().filter(
    (product) => !getDeletedListingIds().includes(product.id) && (!wanted.size || wanted.has(product.id)),
  );
  if (!products.length) {
    notes.push(
      "Catalog is cleared. Not publishing Gelato products to Shopify. Recreate on Printify first; Gelato stays for EU/UK only.",
    );
    return { catalog, notes };
  }
  for (const product of products) {
    const skuQuery = productSkuQuery(product);
    const existing = await shopifyGraphql<{
      products: {
        nodes: Array<{
          id: string;
          media: { nodes: Array<{ id: string }> };
          variants: { nodes: Array<{ id: string; sku?: string | null }> };
        }>;
      };
    }>(
      `query ($q: String!) {
        products(first: 1, query: $q) {
          nodes {
            id
            media(first: 1) { nodes { id } }
            variants(first: 50) { nodes { id sku } }
          }
        }
      }`,
      { q: skuQuery },
    );
    const found = existing.products.nodes[0];
    const clothing = await shopifyVariantsWithColorPhotos(product, shopifyProductOptions(product), request);
    const input: Record<string, unknown> = {
      title: product.title,
      descriptionHtml: shopifyProductHtml(product),
      vendor: FERNORA_NAME,
      productType: product.category,
      status: "ACTIVE",
      tags: ["Fernora", product.collection, ...product.tags],
      ...clothing,
      metafields: [
        { namespace: "fernora", key: "product_id", type: "single_line_text_field", value: product.id },
        {
          namespace: "fernora",
          key: "gelato_uid",
          type: "single_line_text_field",
          value: product.gelatoProductUid || "",
        },
        ...(product.printFileUrl
          ? [
              {
                namespace: "fernora",
                key: "print_file",
                type: "single_line_text_field",
                value: await absoluteAssetUrl(product.printFileUrl, request),
              },
            ]
          : []),
      ],
    };
    if (found?.id) input.id = found.id;
    if (product.id === "live_sneaker_star") input.handle = "black-camo-mens-mesh-sneakers";
    if (product.id === "live_hoodie_bloom") input.handle = "grow-with-purpose-embroidered-zip-hoodie";
    if (product.id === "live_tee_bloom") input.handle = "grow-with-purpose-embroidered-tee";
    const files: Array<{ originalSource: string; alt?: string; contentType: string }> = [];
    const seenSources = new Set<string>();
    for (const variant of clothing.variants) {
      const file =
        "file" in variant
          ? (variant.file as { originalSource?: string; alt?: string; contentType?: string } | undefined)
          : undefined;
      if (!file?.originalSource || seenSources.has(file.originalSource)) continue;
      seenSources.add(file.originalSource);
      files.push({
        originalSource: file.originalSource,
        alt: file.alt,
        contentType: file.contentType || "IMAGE",
      });
    }
    if (files.length) {
      input.files = files;
    } else if (!found?.media.nodes.length && product.imageUrl) {
      input.files = [
        {
          originalSource: await catalogProductImageSource(product.imageUrl, request),
          alt: product.title,
          contentType: "IMAGE",
        },
      ];
    }
    const created = await shopifyGraphql<{
      productSet: {
        product?: {
          id: string;
          handle: string;
          variants: { nodes: Array<{ id: string; sku?: string | null }> };
        };
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    }>(
      `mutation productSet($input: ProductSetInput!) {
        productSet(synchronous: true, input: $input) {
          product { id handle variants(first: 50) { nodes { id sku } } }
          userErrors { field message }
        }
      }`,
      { input },
    );
    const errors = created.productSet.userErrors;
    if (errors.length) {
      notes.push(`${product.title}: ${errors.map((row) => row.message).join("; ")}`);
      continue;
    }
    const node = created.productSet.product;
    if (!node) {
      notes.push(`${product.title}: Shopify returned no product`);
      continue;
    }
    const defaultSku = defaultProductSku(product);
    const defaultVariant =
      node.variants.nodes.find((row) => row.sku === defaultSku) || node.variants.nodes[0];
    const variants: Record<string, string> = {};
    for (const row of node.variants.nodes) {
      if (row.sku && row.id) variants[row.sku] = row.id;
    }
    catalog[product.id] = {
      productId: node.id,
      variantId: defaultVariant?.id || found?.variants.nodes[0]?.id || "",
      handle: node.handle,
      variants,
    };
    try {
      await publishableToOnlineStore(node.id);
    } catch (error) {
      notes.push(`${product.title}: published to Admin but not Online Store (${(error as Error).message})`);
    }
    try {
      await ensureShopifyProductGallery(node.id, product, request);
      await attachShopifyVariantColorMedia(node.id, product);
    } catch (error) {
      notes.push(`${product.title}: mockups (${(error as Error).message})`);
    }
  }
  await updateShop((state) => {
    state.shopifyCatalog = { ...(state.shopifyCatalog || {}), ...catalog };
    state.shopifySyncedAt = new Date().toISOString();
  });
  notes.unshift(`Published ${Object.keys(catalog).length} of ${products.length} Fernora products to Shopify.`);
  return { catalog, notes };
}

export async function onlineStorePublicationId() {
  const data = await shopifyGraphql<{ publications: { nodes: Array<{ id: string; name: string }> } }>(
    `{ publications(first: 20) { nodes { id name } } }`,
  );
  const found =
    data.publications.nodes.find((row) => row.name === "Online Store") || data.publications.nodes[0];
  if (!found) throw new Error("Shopify has no Online Store publication");
  return found.id;
}

export async function publishableToOnlineStore(id: string, publicationId?: string) {
  const pub = publicationId || (await onlineStorePublicationId());
  const data = await shopifyGraphql<{
    publishablePublish: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }`,
    { id, input: [{ publicationId: pub }] },
  );
  if (data.publishablePublish.userErrors.length) {
    throw new Error(data.publishablePublish.userErrors.map((row) => row.message).join("; "));
  }
}

function shopifyProductHtml(product: ReturnType<typeof fernoraCatalog>[number]) {
  const lanes = product.lanes
    .map(
      (lane) =>
        `<tr><td>${escapeHtml(lane.label)}</td><td>NZ$${lane.shipping.toFixed(2)}</td><td>${escapeHtml(lane.days)}</td></tr>`,
    )
    .join("");
  return [
    `<p>${escapeHtml(product.description)}</p>`,
    `<table><thead><tr><th>Ships to</th><th>Ship</th><th>Transit</th></tr></thead><tbody>${lanes}</tbody></table>`,
    `<p>Made to order. Returns: unused items that arrive damaged, defective, or incorrect within 14 days — <a href="${FERNORA_STOREFRONT_ORIGIN}/policies/refund-policy">returns policy</a>.</p>`,
    `<p>Pay at Shopify checkout on fernora.nz (cards, Shop Pay, Apple Pay where available). Customer accounts: <a href="${FERNORA_STOREFRONT_ORIGIN}/account">fernora.nz/account</a>.</p>`,
  ].join("");
}

export async function refreshShopifyProductCopy() {
  const notes: string[] = [];
  let updated = 0;
  for (const product of fernoraCatalog()) {
    const skuQuery = productSkuQuery(product);
    const existing = await shopifyGraphql<{
      products: { nodes: Array<{ id: string }> };
    }>(
      `query ($q: String!) {
        products(first: 1, query: $q) { nodes { id } }
      }`,
      { q: skuQuery },
    );
    const found = existing.products.nodes[0];
    if (!found?.id) continue;
    const result = await shopifyGraphql<{
      productUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation ($product: ProductUpdateInput!) {
        productUpdate(product: $product) { userErrors { field message } }
      }`,
      { product: { id: found.id, descriptionHtml: shopifyProductHtml(product) } },
    );
    if (result.productUpdate.userErrors.length) {
      notes.push(`${product.title}: ${result.productUpdate.userErrors.map((row) => row.message).join("; ")}`);
    } else {
      updated += 1;
    }
  }
  notes.push(
    updated
      ? `Updated descriptions on ${updated} Shopify products so the printer is not named.`
      : "No Shopify product descriptions needed updating.",
  );
  return notes;
}

export async function hideGelatoFromCheckoutShipping() {
  const notes: string[] = [];
  const data = await shopifyGraphql<{
    deliveryProfiles: {
      nodes: Array<{
        id: string;
        profileLocationGroups: Array<{
          locationGroup: { id: string };
          locationGroupZones: {
            nodes: Array<{
              zone: { id: string };
              methodDefinitions: { nodes: Array<{ id: string; name: string }> };
            }>;
          };
        }>;
      }>;
    };
  }>(`{
    deliveryProfiles(first: 25) {
      nodes {
        id
        profileLocationGroups {
          locationGroup { id }
          locationGroupZones(first: 40) {
            nodes {
              zone { id }
              methodDefinitions(first: 20) { nodes { id name } }
            }
          }
        }
      }
    }
  }`);
  let renamed = 0;
  for (const profile of data.deliveryProfiles.nodes) {
    for (const group of profile.profileLocationGroups) {
      const zonesToUpdate = group.locationGroupZones.nodes.flatMap((row) => {
        const methods = row.methodDefinitions.nodes.filter((method) => /gelato/i.test(method.name));
        if (!methods.length) return [];
        return [
          {
            id: row.zone.id,
            methodDefinitionsToUpdate: methods.map((method) => ({ id: method.id, name: "Standard delivery" })),
          },
        ];
      });
      if (!zonesToUpdate.length) continue;
      const updated = await shopifyGraphql<{
        deliveryProfileUpdate: { userErrors: Array<{ message: string }> };
      }>(
        `mutation ($id: ID!, $profile: DeliveryProfileInput!) {
          deliveryProfileUpdate(id: $id, profile: $profile) { userErrors { field message } }
        }`,
        {
          id: profile.id,
          profile: {
            locationGroupsToUpdate: [{ id: group.locationGroup.id, zonesToUpdate }],
          },
        },
      );
      if (updated.deliveryProfileUpdate.userErrors.length) {
        notes.push(
          "Shipping labels: " + updated.deliveryProfileUpdate.userErrors.map((row) => row.message).join("; "),
        );
      } else {
        renamed += zonesToUpdate.reduce((sum, zone) => sum + zone.methodDefinitionsToUpdate.length, 0);
      }
    }
  }
  notes.push(
    renamed
      ? `Renamed ${renamed} checkout shipping methods to Standard delivery.`
      : "Checkout shipping methods already omit the printer name.",
  );
  return notes;
}

export async function restrictShopifyToAunz() {
  return configureShopifyGelatoShipping();
}

function gelatoZoneDefs(rates?: Record<string, number>) {
  return [
    { name: "New Zealand", lane: "NZ" as const, codes: gelatoCodesForLane("NZ"), price: rates?.NZ ?? 10.09 },
    { name: "Australia", lane: "AU" as const, codes: gelatoCodesForLane("AU"), price: rates?.AU ?? 12.76 },
    { name: "United States & Americas", lane: "US" as const, codes: gelatoCodesForLane("US"), price: rates?.US ?? 8.08 },
    { name: "United Kingdom & Ireland", lane: "GB" as const, codes: gelatoCodesForLane("GB"), price: rates?.GB ?? 10.47 },
    { name: "European Union", lane: "EU" as const, codes: gelatoCodesForLane("EU"), price: rates?.EU ?? 11.57 },
  ];
}

function gelatoZonesToCreate(rates?: Record<string, number>) {
  return gelatoZoneDefs(rates).map((zone) => ({
    name: zone.name,
    countries: zone.codes.map((code) => ({ code, includeAllProvinces: true })),
    methodDefinitionsToCreate: [
      {
        name: "Standard delivery",
        active: true,
        rateDefinition: { price: { amount: zone.price.toFixed(2), currencyCode: "NZD" } },
      },
    ],
  }));
}

export async function configureShopifyGelatoShipping() {
  const notes: string[] = [];
  const data = await shopifyGraphql<{
    deliveryProfiles: {
      nodes: Array<{
        id: string;
        name: string;
        default?: boolean | null;
        profileLocationGroups: Array<{
          locationGroup: { id: string };
          locationGroupZones: {
            nodes: Array<{
              zone: {
                id: string;
                name: string;
                countries: Array<{ code: { countryCode: string } }>;
              };
            }>;
          };
        }>;
      }>;
    };
    locations: { nodes: Array<{ id: string; name: string }> };
    products: {
      nodes: Array<{
        id: string;
        metafield?: { value?: string | null } | null;
        variants: { nodes: Array<{ id: string; sku?: string | null }> };
      }>;
    };
  }>(`{
    locations(first: 5) { nodes { id name } }
    products(first: 50, query: "vendor:${FERNORA_NAME}") {
      nodes {
        id
        metafield(namespace: "fernora", key: "product_id") { value }
        variants(first: 50) { nodes { id sku } }
      }
    }
    deliveryProfiles(first: 25) {
      nodes {
        id
        name
        default
        profileLocationGroups {
          locationGroup { id }
          locationGroupZones(first: 40) {
            nodes {
              zone {
                id
                name
                countries { code { countryCode } }
              }
            }
          }
        }
      }
    }
  }`);
  const profile = data.deliveryProfiles.nodes.find((row) => row.default) || data.deliveryProfiles.nodes[0];
  const location = data.locations.nodes[0];
  if (!profile || !location) {
    notes.push("Shopify has no delivery profile or location to restrict yet.");
    return notes;
  }
  const group = profile.profileLocationGroups[0];
  const existingZones = group?.locationGroupZones.nodes || [];
  const gelatoZones = gelatoZoneDefs();
  const extraZoneIds = existingZones
    .filter((row) => !gelatoZones.some((zone) => zone.name === row.zone.name))
    .map((row) => row.zone.id);
  const missingZones = gelatoZones.filter((zone) => !existingZones.some((row) => row.zone.name === zone.name));
  const profileInput: Record<string, unknown> = {
    name: "Fernora · Gelato destinations",
    zonesToDelete: extraZoneIds,
  };
  if (group && missingZones.length) {
    profileInput.locationGroupsToUpdate = [
      {
        id: group.locationGroup.id,
        zonesToCreate: gelatoZonesToCreate().filter((zone) => missingZones.some((row) => row.name === zone.name)),
      },
    ];
  }
  const updated = await shopifyGraphql<{
    deliveryProfileUpdate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($id: ID!, $profile: DeliveryProfileInput!) {
      deliveryProfileUpdate(id: $id, profile: $profile) {
        userErrors { field message }
      }
    }`,
    { id: profile.id, profile: profileInput },
  );
  if (updated.deliveryProfileUpdate.userErrors.length) {
    notes.push(
      "Shipping zones: " + updated.deliveryProfileUpdate.userErrors.map((row) => row.message).join("; "),
    );
  } else {
    notes.push("Shopify shipping zones match Gelato destinations (NZ, AU, US, UK, EU and other print countries).");
  }
  notes.push(...(await configureGelatoProductShippingProfiles(data.products.nodes, data.deliveryProfiles.nodes, location.id)));
  return notes;
}

async function configureGelatoProductShippingProfiles(
  products: Array<{
    id: string;
    metafield?: { value?: string | null } | null;
    variants: { nodes: Array<{ id: string; sku?: string | null }> };
  }>,
  profiles: Array<{ id: string; name: string; default?: boolean | null }>,
  locationId: string,
) {
  const notes: string[] = [];
  const bySku = new Map<string, string>();
  const byFernoraId = new Map<string, string[]>();
  for (const product of products) {
    const variantIds = product.variants.nodes.map((row) => row.id);
    for (const row of product.variants.nodes) {
      if (row.sku) bySku.set(row.sku, row.id);
    }
    if (product.metafield?.value) byFernoraId.set(product.metafield.value, variantIds);
  }
  const existingByName = new Map(profiles.map((row) => [row.name, row.id]));
  for (const family of gelatoShipFamilies()) {
    const variantIds = family.productIds.flatMap((productId) => {
      const fromMeta = byFernoraId.get(productId);
      if (fromMeta?.length) return fromMeta;
      const product = fernoraCatalog().find((row) => row.id === productId);
      if (!product) return [];
      if (product.variants?.length) {
        return product.variants.map((variant) => bySku.get(variant.sku)).filter((id): id is string => Boolean(id));
      }
      const id = bySku.get(product.id);
      return id ? [id] : [];
    });
    if (!variantIds.length) continue;
    const name = `Gelato · ${family.name}`;
    const existingId = existingByName.get(name);
    if (existingId) {
      const updated = await shopifyGraphql<{
        deliveryProfileUpdate: { userErrors: Array<{ message: string }> };
      }>(
        `mutation ($id: ID!, $profile: DeliveryProfileInput!) {
          deliveryProfileUpdate(id: $id, profile: $profile) { userErrors { field message } }
        }`,
        { id: existingId, profile: { variantsToAssociate: variantIds } },
      );
      if (updated.deliveryProfileUpdate.userErrors.length) {
        notes.push(`${name}: ${updated.deliveryProfileUpdate.userErrors.map((row) => row.message).join("; ")}`);
      }
      continue;
    }
    const created = await shopifyGraphql<{
      deliveryProfileCreate: { userErrors: Array<{ message: string }>; profile?: { id: string } };
    }>(
      `mutation ($profile: DeliveryProfileInput!) {
        deliveryProfileCreate(profile: $profile) {
          profile { id name }
          userErrors { field message }
        }
      }`,
      {
        profile: {
          name,
          variantsToAssociate: variantIds,
          locationGroupsToCreate: [
            {
              locationsToAdd: [locationId],
              zonesToCreate: gelatoZonesToCreate(family.rates),
            },
          ],
        },
      },
    );
    if (created.deliveryProfileCreate.userErrors.length) {
      notes.push(`${name}: ${created.deliveryProfileCreate.userErrors.map((row) => row.message).join("; ")}`);
    } else {
      notes.push(`Shipping profile ${name} uses Gelato destination rates.`);
    }
  }
  return notes;
}

export async function syncShopifyPolicies() {
  const notes: string[] = [];
  try {
    const disabled = await shopifyGraphql<{
      privacyFeaturesDisable: {
        featuresDisabled?: string[] | null;
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation {
        privacyFeaturesDisable(featuresToDisable: [PRIVACY_POLICY]) {
          featuresDisabled
          userErrors { field message }
        }
      }`,
    );
    if (disabled.privacyFeaturesDisable.userErrors.length) {
      notes.push(
        `privacy auto-manage: ${disabled.privacyFeaturesDisable.userErrors.map((row) => row.message).join("; ")}`,
      );
    } else {
      notes.push("Shopify automatic privacy policy disabled so Gelato-aligned copy can publish.");
    }
  } catch (error) {
    notes.push(`privacy auto-manage: ${(error as Error).message}`);
  }
  const policies: Array<{ type: string; body: string; label: string }> = [
    { type: "REFUND_POLICY", body: policyHtml("returns"), label: "returns" },
    { type: "PRIVACY_POLICY", body: policyHtml("privacy"), label: "privacy" },
    { type: "TERMS_OF_SERVICE", body: policyHtml("terms"), label: "terms" },
    { type: "SHIPPING_POLICY", body: policyHtml("shipping"), label: "shipping" },
    { type: "LEGAL_NOTICE", body: policyHtml("payments"), label: "payments" },
  ];
  for (const policy of policies) {
    try {
      const updated = await shopifyGraphql<{
        shopPolicyUpdate: { userErrors: Array<{ message: string }> };
      }>(
        `mutation ($shopPolicy: ShopPolicyInput!) {
          shopPolicyUpdate(shopPolicy: $shopPolicy) {
            userErrors { field message }
          }
        }`,
        { shopPolicy: { type: policy.type, body: policy.body } },
      );
      if (updated.shopPolicyUpdate.userErrors.length) {
        notes.push(
          `${policy.label}: ${updated.shopPolicyUpdate.userErrors.map((row) => row.message).join("; ")}`,
        );
      }
    } catch (error) {
      notes.push(`${policy.label}: ${(error as Error).message}`);
    }
  }
  if (!notes.some((row) => row.includes("auto-manage") || row.includes(":"))) {
    notes.push("Shopify legal policies (returns, privacy, terms, shipping, payments) updated.");
  } else {
    notes.unshift("Shopify policies:");
  }
  return notes;
}

function shopifyVariantGid(
  catalog: ShopifyCatalogMap | undefined,
  listingId: string,
  sku?: string,
) {
  const mapped = catalog?.[listingId];
  if (!mapped) return undefined;
  if (sku && mapped.variants?.[sku]) return mapped.variants[sku];
  return mapped.variantId || undefined;
}

export async function createShopifyDraftInvoice(input: {
  email: string;
  note: string;
  country: string;
  lines: Array<{ listingId: string; sku?: string; quantity: number; title: string; price: number }>;
  address: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
    phone?: string;
  };
}) {
  const shop = await getShop();
  const lineItems = input.lines.map((line) => {
    const variantId = shopifyVariantGid(shop.shopifyCatalog, line.listingId, line.sku);
    if (variantId) return { variantId, quantity: line.quantity };
    return {
      title: line.title,
      originalUnitPrice: line.price.toFixed(2),
      quantity: line.quantity,
    };
  });
  const shipping = input.lines.reduce((sum, line) => {
    const product = fernoraCatalog().find((row) => row.id === line.listingId);
    const lane = product ? shopLane(product, input.country) : undefined;
    return sum + (lane?.shipping || 0) * line.quantity;
  }, 0);
  const created = await shopifyGraphql<{
    draftOrderCreate: {
      draftOrder?: { id: string; invoiceUrl?: string | null; name: string };
      userErrors: Array<{ message: string }>;
    };
  }>(
    `mutation ($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id invoiceUrl name }
        userErrors { field message }
      }
    }`,
    {
      input: {
        email: input.email,
        note: input.note,
        tags: ["Fernora"],
        shippingAddress: input.address,
        billingAddress: input.address,
        lineItems,
        shippingLine: {
          title: "Standard delivery",
          price: shipping.toFixed(2),
        },
      },
    },
  );
  if (created.draftOrderCreate.userErrors.length) {
    throw new Error(created.draftOrderCreate.userErrors.map((row) => row.message).join("; "));
  }
  const draft = created.draftOrderCreate.draftOrder;
  if (!draft) throw new Error("Shopify did not create a draft order");
  return draft;
}

type ShopifyProductPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
    nodes: Array<{ id: string; title: string; handle: string }>;
  };
};

export async function listShopifyProducts(query = `vendor:${FERNORA_NAME}`) {
  const products: Array<{ id: string; title: string; handle: string }> = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const data: ShopifyProductPage = await shopifyGraphql<ShopifyProductPage>(
      `query ($q: String!, $cursor: String) {
        products(first: 50, query: $q, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { id title handle }
        }
      }`,
      { q: query, cursor },
    );
    products.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor || null;
    if (!cursor) break;
  }
  return products;
}

async function shopifyProductDelete(productId: string) {
  const data = await shopifyGraphql<{
    productDelete: { deletedProductId?: string | null; userErrors: Array<{ message: string }> };
  }>(
    `mutation ($id: ID!) {
      productDelete(input: { id: $id }) {
        deletedProductId
        userErrors { field message }
      }
    }`,
    { id: productId },
  );
  if (data.productDelete.userErrors.length) {
    throw new Error(data.productDelete.userErrors.map((row) => row.message).join("; "));
  }
  return data.productDelete.deletedProductId || productId;
}

export async function deleteShopifyProduct(listingId: string) {
  const shop = await getShop();
  const mapped = shop.shopifyCatalog?.[listingId];
  let productId = mapped?.productId;
  if (!productId) {
    const existing = await shopifyGraphql<{
      products: { nodes: Array<{ id: string }> };
    }>(
      `query ($q: String!) {
        products(first: 5, query: $q) {
          nodes { id }
        }
      }`,
      { q: `sku:${listingId} OR sku:${listingId}-black-m` },
    );
    productId = existing.products.nodes[0]?.id;
  }
  if (!productId) {
    return { deleted: false, note: "No Shopify product mapped for this listing" };
  }
  const deletedId = await shopifyProductDelete(productId);
  await updateShop((state) => {
    if (state.shopifyCatalog) delete state.shopifyCatalog[listingId];
  });
  return { deleted: true, productId: deletedId };
}

export async function deleteOlderShopifyProducts(keepTitles: string[] = []) {
  const notes: string[] = [];
  const keep = new Set(keepTitles.map((title) => title.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const products = [
    ...(await listShopifyProducts(`vendor:${FERNORA_NAME}`)),
    ...(await listShopifyProducts("sku:live_*")),
  ];
  let deleted = 0;
  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    if (keep.has(product.title.trim().toLowerCase())) continue;
    try {
      await shopifyProductDelete(product.id);
      deleted += 1;
    } catch (error) {
      notes.push(`${product.title}: ${(error as Error).message}`);
    }
  }
  await updateShop((state) => {
    state.shopifyCatalog = {};
  });
  notes.unshift(
    deleted
      ? `Deleted ${deleted} older Shopify product${deleted === 1 ? "" : "s"}.`
      : "No older Shopify products to delete.",
  );
  return { deleted, notes };
}

export async function registerShopifyWebhooks(origin: string) {
  const address = `${origin.replace(/\/$/, "")}/api/shopify/webhooks/orders`;
  const existing = await shopifyGraphql<{
    webhookSubscriptions: { nodes: Array<{ id: string; uri?: string | null; topic: string }> };
  }>(`{
    webhookSubscriptions(first: 20, topics: [ORDERS_PAID]) {
      nodes { id topic uri }
    }
  }`);
  if (existing.webhookSubscriptions.nodes.some((row) => row.uri === address)) {
    return { created: false, address };
  }
  const created = await shopifyGraphql<{
    webhookSubscriptionCreate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        userErrors { field message }
      }
    }`,
    { topic: "ORDERS_PAID", webhookSubscription: { callbackUrl: address, format: "JSON" } },
  );
  if (created.webhookSubscriptionCreate.userErrors.length) {
    throw new Error(created.webhookSubscriptionCreate.userErrors.map((row) => row.message).join("; "));
  }
  return { created: true, address };
}
