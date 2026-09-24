import path from "node:path";
import { CATALOG_LISTING_TAGS } from "./listing-health.ts";
import { catalogPrice, printifyListCents } from "./printify-costs.ts";
import {
  CLOTHING_COLOR_LINE,
  TEE_COLOR_LINE,
  TEE_WHITE_DEFAULT,
  ZIP_HOODIE_WHITE_DEFAULT,
  teeColorways,
  zipHoodieColorways,
} from "./clothing.ts";
import {
  SNEAKER_WHITE_SOLE,
  SNEAKER_WHITE_SOLE_DEFAULT,
  SNEAKER_WOMENS_WHITE_SOLE,
  SNEAKER_WOMENS_WHITE_SOLE_DEFAULT,
  type SneakerSizeRow,
} from "./sneaker-sizes.ts";

export { SNEAKER_WHITE_SOLE_DEFAULT, SNEAKER_WHITE_SOLE_IDS } from "./sneaker-sizes.ts";

export type PrintifyVariantInput = {
  id?: number;
  price: number;
  is_enabled: boolean;
  is_default?: boolean;
  color?: string;
  size?: string;
};

export type PrintifyCatalogVariant = {
  id?: number;
  title?: string;
  options?: { color?: string; size?: string };
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
  /** Per-position print files. Positions fall back to printFile. */
  printFiles?: Record<string, string>;
};

export type PrintifyImageIds = string | Record<string, string>;

export function printFileForPosition(spec: PrintifyStarterSpec, position: string) {
  return spec.printFiles?.[position] || spec.printFile;
}

export function uniquePrintFiles(spec: PrintifyStarterSpec) {
  return [...new Set(spec.positions.map((position) => printFileForPosition(spec, position)))];
}

export function imageIdForPosition(images: PrintifyImageIds, position: string, fallback?: string) {
  if (typeof images === "string") return images;
  return images[position] || fallback || Object.values(images)[0] || "";
}

function one(id: number, price: number): PrintifyVariantInput[] {
  return [{ id, price, is_enabled: true, is_default: true }];
}

function zipHoodiePrintifyVariants(price: number): PrintifyVariantInput[] {
  return zipHoodieColorways().map((row) => ({
    ...(row.printifyId ? { id: row.printifyId } : {}),
    color: row.color,
    size: row.size,
    price,
    is_enabled: true,
    ...(row.printifyId === ZIP_HOODIE_WHITE_DEFAULT ? { is_default: true } : {}),
  }));
}

function teePrintifyVariants(price: number): PrintifyVariantInput[] {
  return teeColorways().map((row) => ({
    ...(row.printifyId ? { id: row.printifyId } : {}),
    color: row.color,
    size: row.size,
    price,
    is_enabled: true,
    ...(row.printifyId === TEE_WHITE_DEFAULT ? { is_default: true } : {}),
  }));
}

const SIZE_TOKENS: Record<string, string> = {
  s: "s",
  small: "s",
  m: "m",
  medium: "m",
  l: "l",
  large: "l",
  xl: "xl",
  xlarge: "xl",
  "2xl": "2xl",
  xxl: "2xl",
  "2xlarge": "2xl",
  xxlarge: "2xl",
};

const COLOR_TOKENS: Record<string, string> = {
  white: "white",
  ash: "ash",
  black: "black",
  sportgrey: "sport-grey",
  sportgray: "sport-grey",
  navy: "navy",
  navyblue: "navy",
  lightpink: "light-pink",
  pink: "light-pink",
  cardinalred: "cardinal-red",
  cardinal: "cardinal-red",
  red: "cardinal-red",
  darkheathergrey: "dark-heather",
  darkheathergray: "dark-heather",
  darkheather: "dark-heather",
  heather: "dark-heather",
};

function optionToken(kind: "color" | "size", value: string) {
  const raw = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const table = kind === "size" ? SIZE_TOKENS : COLOR_TOKENS;
  return table[raw] || raw;
}

export function catalogOption(variant: PrintifyCatalogVariant, kind: "color" | "size") {
  const direct = variant.options?.[kind];
  if (direct) {
    const token = optionToken(kind, direct);
    const table = kind === "size" ? SIZE_TOKENS : COLOR_TOKENS;
    if (table[direct.toLowerCase().replace(/[^a-z0-9]+/g, "")]) return token;
  }
  for (const part of (variant.title || "").split("/")) {
    const raw = part.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const table = kind === "size" ? SIZE_TOKENS : COLOR_TOKENS;
    if (table[raw]) return table[raw];
  }
  return direct ? optionToken(kind, direct) : "";
}

/** Fill garment colour/size rows from a Printify blueprint. Known ids stay if the catalog has no match. */
export function matchPrintifyColorSizes(wanted: PrintifyVariantInput[], catalog: PrintifyCatalogVariant[]) {
  const missing: string[] = [];
  const variants = wanted.map((row) => {
    if (!row.color || !row.size) return row;
    const color = optionToken("color", row.color);
    const size = optionToken("size", row.size);
    const found = catalog.find(
      (item) => item.id && catalogOption(item, "color") === color && catalogOption(item, "size") === size,
    );
    if (found?.id) return { ...row, id: found.id };
    if (typeof row.id === "number") return row;
    missing.push(`${row.color} / ${row.size}`);
    return row;
  });
  if (missing.length) {
    throw new Error(`Printify catalog is missing ${missing.join(", ")}`);
  }
  return variants;
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
 * Fernora catalog: five wall-art mixes, black-camo men’s and Southern Cross women’s
 * mesh sneakers, the embroidered Gildan 18600 zip hoodie, and the embroidered
 * Gildan 5000 heavy cotton tee. Not Gelato External migrations.
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
    title: "Black Camo · Men’s Mesh Sneakers",
    description:
      "Men’s mesh sneakers with an original Fernora black-camo print. Dye sublimation on breathable mesh, white sole, memory-foam insole. Made to order.",
    tags: CATALOG_LISTING_TAGS.live_sneaker_star,
    printFile: "print-camo-sneakers.png",
    mockupFile: "catalog-camo-sneakers-angle.jpg",
    blueprintId: 1072,
    printProviderId: 90,
    variants: whiteSoleSneakers(printifyListCents(catalogPrice("live_sneaker_star"))),
    positions: ["left_shoe", "right_shoe"],
    aliases: ["Southern Cross Star · Mesh Sneakers", "Southern Cross Star Mesh Sneakers"],
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
  {
    key: "live_hoodie_bloom",
    title: "Grow With Purpose · Embroidered Zip Hoodie",
    description:
      `Unisex Gildan 18600 full-zip hoodie with an original Fernora embroidered fern and the line “Grow with purpose, Bloom with grace” beneath the leaf. Left-chest embroidery. ${CLOTHING_COLOR_LINE}. Made to order.`,
    tags: CATALOG_LISTING_TAGS.live_hoodie_bloom,
    printFile: "print-hoodie-bloom.png",
    mockupFile: "catalog-hoodie-bloom.jpg",
    blueprintId: 66,
    printProviderId: 217,
    variants: zipHoodiePrintifyVariants(printifyListCents(catalogPrice("live_hoodie_bloom"))),
    positions: ["front_left_chest"],
  },
  {
    key: "live_tee_bloom",
    title: "Grow With Purpose · Embroidered Heavy Cotton Tee",
    description:
      `Unisex Gildan 5000 heavy cotton tee with a large-center Fernora embroidered fern and the line “Grow with purpose, Bloom with grace.” Inner neck label carries the Fernora wordmark. ${TEE_COLOR_LINE}. Made to order.`,
    tags: CATALOG_LISTING_TAGS.live_tee_bloom,
    printFile: "print-tee-bloom.png",
    mockupFile: "catalog-tee-bloom.jpg",
    printFiles: {
      large_center_embroidery: "print-tee-bloom.png",
      neck: "print-tee-bloom-neck.png",
    },
    blueprintId: 6,
    printProviderId: 410,
    variants: teePrintifyVariants(printifyListCents(catalogPrice("live_tee_bloom"))),
    positions: ["large_center_embroidery", "neck"],
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

export function printifyVariantsWithIds(spec: PrintifyStarterSpec) {
  return spec.variants.filter(
    (variant): variant is PrintifyVariantInput & { id: number } => variant.is_enabled && typeof variant.id === "number",
  );
}

export function buildPrintifyProductPayload(spec: PrintifyStarterSpec, images: PrintifyImageIds) {
  const ready = printifyVariantsWithIds(spec);
  const variantIds = ready.map((variant) => variant.id);
  const fallback = typeof images === "string" ? images : imageIdForPosition(images, spec.positions[0] || "");
  return {
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    blueprint_id: spec.blueprintId,
    print_provider_id: spec.printProviderId,
    visible: true,
    variants: ready.map((variant) => ({
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
              id: imageIdForPosition(images, position, fallback),
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

export function printAreasForExistingVariants(
  spec: PrintifyStarterSpec,
  images: PrintifyImageIds,
  variantIds: number[],
) {
  const areas = buildPrintifyProductPayload(spec, images).print_areas;
  if (!variantIds.length) return areas;
  return areas.map((area) => ({ ...area, variant_ids: variantIds }));
}

/** Printify error 8251 if print_areas omit any blueprint variant, even disabled ones. */
export function mergePrintAreaVariantIds(...groups: Array<Array<number | undefined | null>>) {
  return [...new Set(groups.flat().filter((id): id is number => typeof id === "number" && id > 0))];
}
