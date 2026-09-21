import path from "node:path";
import { CATALOG_LISTING_TAGS } from "./listing-health.ts";
import { catalogPrice, printifyListCents } from "./printify-costs.ts";
import {
  SNEAKER_WHITE_SOLE,
  SNEAKER_WHITE_SOLE_DEFAULT,
  SNEAKER_WOMENS_WHITE_SOLE,
  SNEAKER_WOMENS_WHITE_SOLE_DEFAULT,
  type SneakerSizeRow,
} from "./sneaker-sizes.ts";

export { SNEAKER_WHITE_SOLE_DEFAULT, SNEAKER_WHITE_SOLE_IDS } from "./sneaker-sizes.ts";

export type PrintifyVariantInput = {
  id: number;
  price: number;
  is_enabled: boolean;
  is_default?: boolean;
};

export type PrintifyStarterSpec = {
  key: string;
  title: string;
  description: string;
  tags: string[];
  printFile: string;
  mockupFile: string;
  blueprintId: number;
  printProviderId: number;
  variants: PrintifyVariantInput[];
  positions: string[];
  aliases?: string[];
};

function one(id: number, price: number): PrintifyVariantInput[] {
  return [{ id, price, is_enabled: true, is_default: true }];
}

function whiteSoleSneakers(
  price: number,
  sizes: readonly SneakerSizeRow[] = SNEAKER_WHITE_SOLE,
  defaultId: number = SNEAKER_WHITE_SOLE_DEFAULT,
): PrintifyVariantInput[] {
  return sizes.map((row) => ({
    id: row.printifyId,
    price,
    is_enabled: true,
    ...(row.printifyId === defaultId ? { is_default: true } : {}),
  }));
}

/**
 * Fernora catalog: five wall-art mixes (one enabled variant each) plus men’s and women’s
 * Southern Cross star mesh sneakers (white sole, every US size). Not Gelato External migrations.
 */
export const FERNORA_PRINTIFY_STARTERS: PrintifyStarterSpec[] = [
  {
    key: "live_poster",
    title: "Fern Arc Poster · A3 Semi-Gloss",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium matte paper. Unframed. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_poster,
    printFile: "print-poster-fern-arc.png",
    mockupFile: "catalog-poster.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43138, printifyListCents(catalogPrice("live_poster"))),
    positions: ["front"],
    aliases: ["Fern Arc Poster"],
  },
  {
    key: "live_quote_breathe",
    title: "Breathe You Are Here · A3 Quote Poster",
    description:
      "Landscape matte print with a botanical border and the line “Breathe. You are here.” Unframed. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_quote_breathe,
    printFile: "print-breathe-here.png",
    mockupFile: "catalog-breathe-here.png",
    blueprintId: 284,
    printProviderId: 99,
    variants: one(43166, printifyListCents(catalogPrice("live_quote_breathe"))),
    positions: ["front"],
  },
  {
    key: "live_botanical_kowhai",
    title: "Kowhai Bells · 18×24 Botanical Print",
    description: "Large 18×24 in painterly study of New Zealand kōwhai bells on cream. Unframed. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_botanical_kowhai,
    printFile: "print-kowhai-botanical.png",
    mockupFile: "catalog-kowhai-botanical.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43144, printifyListCents(catalogPrice("live_botanical_kowhai"))),
    positions: ["front"],
  },
  {
    key: "live_canvas_harbour",
    title: "Harbour Morning Canvas · 12×12",
    description: "Square slim-wrap canvas of a quiet New Zealand harbour at first light. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_canvas_harbour,
    printFile: "print-harbour-morning.png",
    mockupFile: "catalog-harbour-morning.png",
    blueprintId: 937,
    printProviderId: 99,
    variants: one(102204, printifyListCents(catalogPrice("live_canvas_harbour"))),
    positions: ["front"],
  },
  {
    key: "live_frame_kind",
    title: "Home Is a Kind Light · 12×16 Oak Frame",
    description:
      "Walnut-framed 12×16 print: botanicals and “Home is a kind light.” Ready to hang. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_frame_kind,
    printFile: "print-kind-light.png",
    mockupFile: "catalog-kind-light.png",
    blueprintId: 540,
    printProviderId: 99,
    variants: one(69671, printifyListCents(catalogPrice("live_frame_kind"))),
    positions: ["front"],
  },
  {
    key: "live_sneaker_star",
    title: "Southern Cross Star · Mesh Sneakers",
    description:
      "Men’s mesh sneakers with an original Fernora star-and-fern print. Dye sublimation on breathable mesh, white sole, memory-foam insole. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_sneaker_star,
    printFile: "print-star-sneakers.png",
    mockupFile: "catalog-star-sneakers-angle.jpg",
    blueprintId: 1072,
    printProviderId: 90,
    variants: whiteSoleSneakers(printifyListCents(catalogPrice("live_sneaker_star"))),
    positions: ["left_shoe", "right_shoe"],
    aliases: ["Southern Cross Star Mesh Sneakers"],
  },
  {
    key: "live_sneaker_star_w",
    title: "Southern Cross Star · Women’s Mesh Sneakers",
    description:
      "Women’s mesh sneakers with an original Fernora star-and-fern print. Dye sublimation on breathable mesh, white sole, memory-foam insole. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_sneaker_star_w,
    printFile: "print-star-sneakers.png",
    mockupFile: "catalog-star-sneakers-w-angle.jpg",
    blueprintId: 1219,
    printProviderId: 90,
    variants: whiteSoleSneakers(
      printifyListCents(catalogPrice("live_sneaker_star_w")),
      SNEAKER_WOMENS_WHITE_SOLE,
      SNEAKER_WOMENS_WHITE_SOLE_DEFAULT,
    ),
    positions: ["left_shoe", "right_shoe"],
    aliases: ["Southern Cross Star Womens Mesh Sneakers", "Southern Cross Star Women’s Mesh Sneakers"],
  },
];

export function printifyCatalogFile(fileName: string) {
  return path.join(process.cwd(), "public", "catalog", fileName);
}

export function printifyImageFileName(fileName: string, bytes: Uint8Array) {
  const jpeg = bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!jpeg) return fileName;
  return fileName.replace(/\.png$/i, ".jpg");
}

export function buildPrintifyProductPayload(spec: PrintifyStarterSpec, imageId: string) {
  const variantIds = spec.variants.map((variant) => variant.id);
  return {
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    blueprint_id: spec.blueprintId,
    print_provider_id: spec.printProviderId,
    visible: true,
    variants: spec.variants.map((variant) => ({
      id: variant.id,
      price: variant.price,
      is_enabled: variant.is_enabled,
      ...(variant.is_default ? { is_default: true } : {}),
    })),
    print_areas: [
      {
        variant_ids: variantIds,
        placeholders: spec.positions.map((position) => ({
          position,
          images: [
            {
              id: imageId,
              x: 0.5,
              y: 0.5,
              scale: 1,
              angle: 0,
            },
          ],
        })),
      },
    ],
  };
}

export function existingPrintifyProductId(
  products: Array<{ id?: string; title?: string }>,
  title: string,
  aliases: string[] = [],
) {
  const needles = new Set([title, ...aliases].map((row) => row.trim().toLowerCase()).filter(Boolean));
  return products.find((product) => needles.has((product.title || "").trim().toLowerCase()))?.id;
}

export function printifyEnabledVariantIds(product?: { variants?: Array<{ id?: number; is_enabled?: boolean }> }) {
  return (product?.variants || []).filter((variant) => variant.is_enabled).map((variant) => variant.id).filter(Boolean);
}

export function printAreasForExistingVariants(spec: PrintifyStarterSpec, imageId: string, variantIds: number[]) {
  const areas = buildPrintifyProductPayload(spec, imageId).print_areas;
  if (!variantIds.length) return areas;
  return areas.map((area) => ({ ...area, variant_ids: variantIds }));
}
