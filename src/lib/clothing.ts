import { SNEAKER_DEFAULT_SIZE_UID, SNEAKER_WHITE_SOLE } from "./sneaker-sizes.ts";
import type { ClothingVariant, Listing } from "@/lib/types";

export const CLOTHING_COLORS = [
  { name: "Black", uid: "black" },
  { name: "White", uid: "white" },
  { name: "Navy", uid: "navy" },
] as const;

export const CLOTHING_SIZES = [
  { name: "S", uid: "s" },
  { name: "M", uid: "m" },
  { name: "L", uid: "l" },
] as const;

export type ApparelKind = "hoodie" | "t-shirt" | "sweatshirt";

const KIND_BY_CATEGORY: Record<string, ApparelKind> = {
  hoodie: "hoodie",
  tee: "t-shirt",
  sweatshirt: "sweatshirt",
};

const STYLE_BY_KIND: Record<ApparelKind, string> = {
  hoodie: "pullover",
  "t-shirt": "crewneck",
  sweatshirt: "crewneck",
};

export function isClothingCategory(category: string) {
  return category === "hoodie" || category === "tee" || category === "sweatshirt";
}

/** Apparel DTG files are RGBA PNGs: ink only, no cream/black paper square. */
export type ApparelPrintTreatment = "sage-emblem" | "knockout-light" | "knockout-dark";

export function apparelPrintTreatment(category: string): ApparelPrintTreatment | undefined {
  if (category === "hoodie") return "sage-emblem";
  if (category === "tee") return "knockout-light";
  if (category === "sweatshirt") return "knockout-dark";
  return undefined;
}

export function apparelKindFor(category: string): ApparelKind | undefined {
  return KIND_BY_CATEGORY[category];
}

export function apparelProductUid(kind: ApparelKind, colorUid: string, sizeUid: string, gpr = "4-0") {
  return `apparel_product_gca_${kind}_gsc_${STYLE_BY_KIND[kind]}_gcu_unisex_gqa_classic_gsi_${sizeUid}_gco_${colorUid}_gpr_${gpr}`;
}

export function clothingVariants(productId: string, category: string): ClothingVariant[] {
  const kind = apparelKindFor(category);
  if (!kind) return [];
  const rows: ClothingVariant[] = [];
  for (const color of CLOTHING_COLORS) {
    for (const size of CLOTHING_SIZES) {
      rows.push({
        id: `${productId}-${color.uid}-${size.uid}`,
        color: color.name,
        colorUid: color.uid,
        size: size.name,
        sizeUid: size.uid,
        sku: `${productId}-${color.uid}-${size.uid}`,
        gelatoProductUid: apparelProductUid(kind, color.uid, size.uid),
      });
    }
  }
  return rows;
}

/** White-sole US sizes for Printify mesh sneakers (blueprint 1072). */
export function sneakerVariants(productId: string, gelatoProductUid: string): ClothingVariant[] {
  return SNEAKER_WHITE_SOLE.map((row) => ({
    id: `${productId}-us-${row.sizeUid}`,
    color: "White sole",
    colorUid: "white",
    size: row.size,
    sizeUid: row.sizeUid,
    sku: `${productId}-us-${row.sizeUid}`,
    gelatoProductUid: `${gelatoProductUid}:${row.printifyId}`,
  }));
}

export function defaultClothingVariant(variants: ClothingVariant[] | undefined) {
  if (!variants?.length) return undefined;
  return (
    variants.find((row) => row.colorUid === "black" && row.sizeUid === "m") ||
    variants.find((row) => row.sizeUid === "m") ||
    variants.find((row) => row.sizeUid === SNEAKER_DEFAULT_SIZE_UID) ||
    variants[0]
  );
}

/** One enabled clothing SKU per catalog product (Black · M). */
export function singleClothingVariant(productId: string, category: string): ClothingVariant[] {
  const one = defaultClothingVariant(clothingVariants(productId, category));
  return one ? [one] : [];
}

export function findClothingVariant(variants: ClothingVariant[] | undefined, variantId?: string | null) {
  if (!variants?.length) return undefined;
  if (variantId) {
    const exact = variants.find((row) => row.id === variantId || row.sku === variantId);
    if (exact) return exact;
  }
  return defaultClothingVariant(variants);
}

const COLOR_ALIASES: Record<string, string> = {
  black: "black",
  white: "white",
  navy: "navy",
  blue: "navy",
};

const SIZE_ALIASES: Record<string, string> = {
  s: "s",
  small: "s",
  m: "m",
  medium: "m",
  l: "l",
  large: "l",
};

export function matchClothingVariant(title: string, variants: ClothingVariant[] | undefined) {
  if (!variants?.length) return undefined;
  const text = title.toLowerCase();
  if (!text.trim()) return defaultClothingVariant(variants);

  let colorUid: string | undefined;
  for (const [alias, uid] of Object.entries(COLOR_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(text)) {
      colorUid = uid;
      break;
    }
  }
  const usSize = text.match(/\bus\s*(\d+(?:\.\d+)?)\b/i);
  const sizeToken = text.match(/(?:^|[\s/_\-,·])(small|medium|large|xxs|xs|s|m|l|xl|2xl|xxl)(?:$|[\s/_\-,·])/i);
  const sizeUid = usSize
    ? usSize[1].replace(".", "-")
    : sizeToken
      ? SIZE_ALIASES[sizeToken[1].toLowerCase()]
      : undefined;

  const matched = variants.find(
    (row) =>
      (!colorUid || row.colorUid === colorUid) &&
      (!sizeUid || row.sizeUid === sizeUid) &&
      (colorUid || sizeUid),
  );
  return matched || defaultClothingVariant(variants);
}

export function variantLabel(variant: ClothingVariant) {
  return `${variant.color} · ${variant.size}`;
}

export function etsyClothingInventory(
  listing: Pick<Listing, "id" | "category" | "price" | "variants">,
) {
  const variants = listing.variants?.length
    ? listing.variants
    : clothingVariants(listing.id, listing.category);
  return variants.map((variant) => ({
    sku: variant.sku,
    propertyValues: [
      { property_id: 513, property_name: "Color", values: [variant.color] },
      { property_id: 514, property_name: "Size", values: [variant.size] },
    ],
    price: listing.price,
  }));
}

export function resolveListingFulfillment(
  listing: Pick<Listing, "gelatoProductUid" | "printFileUrl" | "variants">,
  variation?: string,
  variantId?: string,
) {
  const fromId = findClothingVariant(listing.variants, variantId);
  const fromTitle = variation ? matchClothingVariant(variation, listing.variants) : undefined;
  const variant = variantId && fromId?.id === variantId ? fromId : fromTitle || fromId;
  return {
    gelatoProductUid: variant?.gelatoProductUid || listing.gelatoProductUid,
    printFileUrl: listing.printFileUrl,
    variation: variant ? variantLabel(variant) : variation,
    variant,
  };
}

const CLOTHING_SKU_PATTERN = /^(.*)-(black|white|navy)-(s|m|l)$/i;
const SNEAKER_SKU_PATTERN = /^(.*)-us-(\d+(?:-\d+)?)$/i;

export function parseClothingSku(sku: string) {
  const match = sku.trim().match(CLOTHING_SKU_PATTERN);
  if (!match) return undefined;
  return {
    productId: match[1],
    colorUid: match[2].toLowerCase(),
    sizeUid: match[3].toLowerCase(),
  };
}

export function parseSneakerSku(sku: string) {
  const match = sku.trim().match(SNEAKER_SKU_PATTERN);
  if (!match) return undefined;
  return {
    productId: match[1],
    sizeUid: match[2].toLowerCase(),
  };
}

export type CatalogProduct = Pick<Listing, "id" | "title" | "gelatoProductUid" | "printFileUrl" | "variants">;

export type ResolvedCatalogLine = {
  product: CatalogProduct;
  listingId: string;
  sku: string;
  variant?: ClothingVariant;
  gelatoProductUid?: string;
  printFileUrl?: string;
  variation?: string;
};

function lineFromProduct(product: CatalogProduct, variant?: ClothingVariant, sku?: string): ResolvedCatalogLine {
  return {
    product,
    listingId: product.id,
    sku: variant?.sku || sku || product.id,
    variant,
    gelatoProductUid: variant?.gelatoProductUid || product.gelatoProductUid,
    printFileUrl: product.printFileUrl,
    variation: variant ? variantLabel(variant) : undefined,
  };
}

/** Map a Shopify/Etsy SKU (or clothing variant id) back to a catalog product + Gelato UID. */
export function resolveCatalogLine(
  products: CatalogProduct[],
  sku?: string | null,
  title?: string | null,
): ResolvedCatalogLine | undefined {
  const token = sku?.trim() || "";
  if (token) {
    const exact = products.find((row) => row.id === token);
    if (exact) return lineFromProduct(exact, defaultClothingVariant(exact.variants), token);

    const fromVariant = products.find((row) => row.variants?.some((rowVariant) => rowVariant.sku === token || rowVariant.id === token));
    if (fromVariant) {
      return lineFromProduct(fromVariant, findClothingVariant(fromVariant.variants, token), token);
    }

    const parsed = parseClothingSku(token);
    if (parsed) {
      const product = products.find((row) => row.id === parsed.productId);
      if (product) {
        const variantId = `${parsed.productId}-${parsed.colorUid}-${parsed.sizeUid}`;
        return lineFromProduct(product, findClothingVariant(product.variants, variantId), token);
      }
    }

    const sneaker = parseSneakerSku(token);
    if (sneaker) {
      const product = products.find((row) => row.id === sneaker.productId);
      if (product) {
        const variantId = `${sneaker.productId}-us-${sneaker.sizeUid}`;
        return lineFromProduct(product, findClothingVariant(product.variants, variantId), token);
      }
    }
  }

  const heading = title?.trim() || "";
  if (!heading) return undefined;
  const byTitle = products.find(
    (row) => row.title && heading.toLowerCase().includes(row.title.toLowerCase()),
  );
  if (!byTitle) return undefined;
  return lineFromProduct(byTitle, matchClothingVariant(heading, byTitle.variants));
}
