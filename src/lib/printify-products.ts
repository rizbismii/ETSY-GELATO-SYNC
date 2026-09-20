import path from "node:path";

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

/**
 * Five Fernora catalog products, one per mix, one enabled variant each.
 * Not Gelato External migrations. Closest Printify size when A-series is not on the blueprint.
 */
export const FERNORA_PRINTIFY_STARTERS: PrintifyStarterSpec[] = [
  {
    key: "live_poster",
    title: "Fern Arc Poster · A3 Semi-Gloss",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium matte paper. Unframed. Made to order.",
    tags: ["fern", "poster", "botanical", "nz art", "wall print", "Original fern"],
    printFile: "print-poster-fern-arc.png",
    mockupFile: "catalog-poster.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43138, 5699),
    positions: ["front"],
    aliases: ["Fern Arc Poster"],
  },
  {
    key: "live_quote_breathe",
    title: "Breathe You Are Here · A3 Quote Poster",
    description:
      "Landscape matte print with a botanical border and the line “Breathe. You are here.” Unframed. Made to order.",
    tags: ["breathe", "quote", "kind", "poster", "positive", "Quotes"],
    printFile: "print-breathe-here.png",
    mockupFile: "catalog-breathe-here.png",
    blueprintId: 284,
    printProviderId: 99,
    variants: one(43166, 5699),
    positions: ["front"],
  },
  {
    key: "live_botanical_kowhai",
    title: "Kowhai Bells · 18×24 Botanical Print",
    description: "Large 18×24 in painterly study of New Zealand kōwhai bells on cream. Unframed. Made to order.",
    tags: ["kowhai", "botanical", "flowers", "poster", "yellow", "Botanical"],
    printFile: "print-kowhai-botanical.png",
    mockupFile: "catalog-kowhai-botanical.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43144, 7399),
    positions: ["front"],
  },
  {
    key: "live_canvas_harbour",
    title: "Harbour Morning Canvas · 12×12",
    description: "Square slim-wrap canvas of a quiet New Zealand harbour at first light. Made to order.",
    tags: ["harbour", "canvas", "landscape", "morning", "home", "Scenic"],
    printFile: "print-harbour-morning.png",
    mockupFile: "catalog-harbour-morning.png",
    blueprintId: 937,
    printProviderId: 99,
    variants: one(102204, 11899),
    positions: ["front"],
  },
  {
    key: "live_frame_kind",
    title: "Home Is a Kind Light · 12×16 Oak Frame",
    description:
      "Walnut-framed 12×16 print: botanicals and “Home is a kind light.” Ready to hang. Made to order.",
    tags: ["home", "framed", "kind", "quote", "homedecor", "Home décor"],
    printFile: "print-kind-light.png",
    mockupFile: "catalog-kind-light.png",
    blueprintId: 540,
    printProviderId: 99,
    variants: one(69671, 18499),
    positions: ["front"],
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
