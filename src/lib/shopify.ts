import crypto from "node:crypto";
import { getCredentials, normalizeShopDomain, patchCredentials } from "@/lib/credentials";
import { fernoraCatalog, FERNORA_NAME, shopLane } from "@/lib/shop";
import { FERNORA_SHOPIFY_SHOP, FERNORA_STOREFRONT_ORIGIN } from "@/lib/shopify-shop";
import {
  gelatoCodesForLane,
  gelatoCountryName,
  GELATO_SHIP_BLURB,
} from "@/lib/gelato-countries";
import { policyHtml } from "@/lib/shop-policies";
import { absoluteAssetUrl } from "@/lib/origin";
import { getShop, updateShop } from "@/lib/store";
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
        "The app is not installed on this shop yet. In Dev Dashboard open the app → Home → Install app → choose this shop → Install. Then click Get Admin token. Do not use Authorize Shopify for this.";
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

export async function syncFernoraCatalogToShopify(request?: Request) {
  const notes: string[] = [];
  const catalog: ShopifyCatalogMap = {};
  const products = fernoraCatalog();
  for (const product of products) {
    const imageUrl = await absoluteAssetUrl(product.imageUrl, request);
    const skuQuery = product.variants?.length
      ? `sku:${product.id} OR sku:${product.variants[0].sku}`
      : `sku:${product.id}`;
    const existing = await shopifyGraphql<{
      products: { nodes: Array<{ id: string; variants: { nodes: Array<{ id: string; sku?: string | null }> } }> };
    }>(
      `query ($q: String!) {
        products(first: 1, query: $q) {
          nodes { id variants(first: 50) { nodes { id sku } } }
        }
      }`,
      { q: skuQuery },
    );
    const found = existing.products.nodes[0];
    const clothing = product.variants?.length
      ? {
          productOptions: [
            {
              name: "Color",
              values: [...new Map(product.variants.map((row) => [row.color, { name: row.color }])).values()],
            },
            {
              name: "Size",
              values: [...new Map(product.variants.map((row) => [row.size, { name: row.size }])).values()],
            },
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
        }
      : {
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
    const input: Record<string, unknown> = {
      title: product.title,
      descriptionHtml: shopifyProductHtml(product),
      vendor: FERNORA_NAME,
      productType: product.category,
      status: "ACTIVE",
      tags: ["Fernora", product.collection, ...product.tags],
      ...clothing,
      files: [{ originalSource: imageUrl, alt: product.title, contentType: "IMAGE" }],
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
    const defaultSku = product.variants?.find((row) => row.colorUid === "black" && row.sizeUid === "m")?.sku || product.id;
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
  }
  await updateShop((state) => {
    state.shopifyCatalog = { ...(state.shopifyCatalog || {}), ...catalog };
    state.shopifySyncedAt = new Date().toISOString();
  });
  notes.unshift(`Published ${Object.keys(catalog).length} of ${products.length} Fernora products to Shopify.`);
  return { catalog, notes };
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
    `<p>${escapeHtml(GELATO_SHIP_BLURB)}</p>`,
    `<table><thead><tr><th>Ships to</th><th>Ship</th><th>Transit</th></tr></thead><tbody>${lanes}</tbody></table>`,
    `<p>Made to order. Returns: unused items that arrive damaged, defective, or incorrect within 14 days — <a href="${FERNORA_STOREFRONT_ORIGIN}/shop/policies/returns">returns policy</a>.</p>`,
    `<p>Pay on the Shopify invoice (cards, Shop Pay, Apple Pay where available). Customer profiles: <a href="${FERNORA_STOREFRONT_ORIGIN}/shop/account">fernora.nz/shop/account</a>.</p>`,
  ].join("");
}

export async function restrictShopifyToAunz() {
  return configureShopifyGelatoShipping();
}

export async function configureShopifyGelatoShipping() {
  const notes: string[] = [];
  const data = await shopifyGraphql<{
    deliveryProfiles: {
      nodes: Array<{
        id: string;
        name: string;
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
  }>(`{
    locations(first: 5) { nodes { id name } }
    deliveryProfiles(first: 8) {
      nodes {
        id
        name
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
  const profile = data.deliveryProfiles.nodes[0];
  const location = data.locations.nodes[0];
  if (!profile || !location) {
    notes.push("Shopify has no delivery profile or location to restrict yet.");
    return notes;
  }
  const group = profile.profileLocationGroups[0];
  const existingZones = group?.locationGroupZones.nodes || [];
  const gelatoZones = [
    { name: "New Zealand", codes: gelatoCodesForLane("NZ"), price: 10.09 },
    { name: "Australia", codes: gelatoCodesForLane("AU"), price: 12.76 },
    { name: "United States & Americas", codes: gelatoCodesForLane("US"), price: 8.08 },
    { name: "United Kingdom & Ireland", codes: gelatoCodesForLane("GB"), price: 10.47 },
    { name: "European Union", codes: gelatoCodesForLane("EU"), price: 11.57 },
  ];
  const wanted = new Set(gelatoZones.flatMap((zone) => zone.codes));
  const extraZoneIds = existingZones
    .filter((row) => {
      const codes = row.zone.countries.map((country) => country.code.countryCode);
      const onlyGelato = codes.length > 0 && codes.every((code) => wanted.has(code));
      const named = gelatoZones.some((zone) => zone.name === row.zone.name);
      return !onlyGelato && !named;
    })
    .map((row) => row.zone.id);
  const missingZones = gelatoZones.filter((zone) => {
    return !existingZones.some((row) => {
      const codes = row.zone.countries.map((country) => country.code.countryCode);
      return zone.codes.every((code) => codes.includes(code)) && codes.length === zone.codes.length;
    });
  });
  const profileInput: Record<string, unknown> = {
    name: "Fernora · Gelato destinations",
    zonesToDelete: extraZoneIds,
  };
  if (group && missingZones.length) {
    profileInput.locationGroupsToUpdate = [
      {
        id: group.locationGroup.id,
        zonesToCreate: missingZones.map((zone) => ({
          name: zone.name,
          countries: zone.codes.map((code) => ({ code })),
          methodDefinitionsToCreate: [
            {
              name: `Gelato ${zone.name}`,
              active: true,
              rateDefinition: { price: { amount: zone.price, currencyCode: "NZD" } },
            },
          ],
        })),
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
  return notes;
}

export async function syncShopifyPolicies() {
  const notes: string[] = [];
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
  if (!notes.length) notes.push("Shopify legal policies (returns, privacy, terms, shipping, payments) updated.");
  else notes.unshift("Shopify policies:");
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
        tags: ["Fernora", "Gelato"],
        shippingAddress: input.address,
        billingAddress: input.address,
        lineItems,
        shippingLine: {
          title: `Gelato ${gelatoCountryName(input.country) || input.country}`,
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
  await updateShop((state) => {
    if (state.shopifyCatalog) delete state.shopifyCatalog[listingId];
  });
  return { deleted: true, productId: data.productDelete.deletedProductId || productId };
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
