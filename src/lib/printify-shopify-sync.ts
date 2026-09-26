import type { PrintifyShopProduct } from "@/lib/printify";
import { FERNORA_NAME } from "@/lib/shop";
import {
  printifyDraftToProductSetInput,
  printifyProductToShopifyDraft,
  type PrintifyShopifyDraft,
} from "@/lib/printify-shopify";
import { publishableToOnlineStore, shopifyGraphql } from "@/lib/shopify";
import { updateShop } from "@/lib/store";
import type { ShopifyCatalogMap } from "@/lib/types";

async function firstShopifyProductId(query: string) {
  const data = await shopifyGraphql<{ products: { nodes: Array<{ id: string }> } }>(
    `query ($q: String!) { products(first: 1, query: $q) { nodes { id } } }`,
    { q: query },
  );
  return data.products.nodes[0]?.id || "";
}

async function findShopifyProductId(draft: PrintifyShopifyDraft) {
  const byPrintify = await firstShopifyProductId(`metafields.fernora.printify_product_id:${draft.printifyProductId}`);
  if (byPrintify) return byPrintify;
  const sku = draft.variants[0]?.sku;
  if (sku) {
    const quoted = /[\s:]/.test(sku) ? `"${sku.replaceAll('"', "")}"` : sku;
    const bySku = await firstShopifyProductId(`sku:${quoted}`);
    if (bySku) return bySku;
  }
  const safe = draft.title.replace(/["\\]/g, "").trim();
  if (!safe) return "";
  const titled = await shopifyGraphql<{ products: { nodes: Array<{ id: string; title: string }> } }>(
    `query ($q: String!) { products(first: 10, query: $q) { nodes { id title } } }`,
    { q: `vendor:${FERNORA_NAME} title:"${safe}"` },
  );
  return (
    titled.products.nodes.find((row) => row.title.trim().toLowerCase() === draft.title.trim().toLowerCase())?.id || ""
  );
}

/** Write Printify product fields to Shopify and the Online Store. Leaves Etsy listings in place. */
export async function syncPrintifyProductsToShopify(products: PrintifyShopProduct[]) {
  const notes: string[] = [];
  const catalog: ShopifyCatalogMap = {};
  if (!products.length) {
    return { notes: ["Printify shop has no products to send to Shopify."], published: 0, catalog };
  }
  let published = 0;
  for (const product of products) {
    const draft = printifyProductToShopifyDraft(product);
    if (!draft.variants.length) {
      notes.push(`${draft.title}: no in-stock variants to put on Shopify. ${draft.stockLine}`);
      continue;
    }
    try {
      const existingId = await findShopifyProductId(draft);
      const input = printifyDraftToProductSetInput(draft, existingId || undefined);
      const created = await shopifyGraphql<{
        productSet: {
          product?: {
            id: string;
            handle: string;
            variants: { nodes: Array<{ id: string; sku?: string | null }> };
          };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation productSet($input: ProductSetInput!) {
          productSet(synchronous: true, input: $input) {
            product { id handle variants(first: 100) { nodes { id sku } } }
            userErrors { field message }
          }
        }`,
        { input },
      );
      const errors = created.productSet.userErrors;
      if (errors.length) {
        notes.push(`${draft.title}: ${errors.map((row) => row.message).join("; ")}`);
        continue;
      }
      const node = created.productSet.product;
      if (!node) {
        notes.push(`${draft.title}: Shopify returned no product`);
        continue;
      }
      try {
        await publishableToOnlineStore(node.id);
      } catch (error) {
        notes.push(`${draft.title}: saved in Shopify admin. Online Store publish: ${(error as Error).message}`);
      }
      const variants: Record<string, string> = {};
      for (const row of node.variants.nodes) {
        if (row.sku && row.id) variants[row.sku] = row.id;
      }
      const defaultSku = draft.variants[0]?.sku;
      catalog[`printify:${draft.printifyProductId}`] = {
        productId: node.id,
        variantId: node.variants.nodes.find((row) => row.sku === defaultSku)?.id || node.variants.nodes[0]?.id || "",
        handle: node.handle,
        variants,
      };
      published += 1;
      const mockups = draft.files.length;
      notes.push(
        `${draft.title}: on Shopify and the Online Store. ${draft.stockLine} ${mockups} mockup${mockups === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      notes.push(`${draft.title}: ${(error as Error).message}`);
    }
  }
  if (published) {
    await updateShop((state) => {
      state.shopifyCatalog = { ...(state.shopifyCatalog || {}), ...catalog };
      state.shopifySyncedAt = new Date().toISOString();
    });
  }
  notes.unshift(`Published ${published} of ${products.length} Printify products to Shopify and the Online Store.`);
  return { notes, published, catalog };
}
