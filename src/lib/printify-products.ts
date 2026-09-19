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
  blueprintId: number;
  printProviderId: number;
  variants: PrintifyVariantInput[];
  positions: string[];
};

/** Fernora starters for the Etsy-connected Printify shop. Not Gelato catalog migrations. */
export const FERNORA_PRINTIFY_STARTERS: PrintifyStarterSpec[] = [
  {
    key: "fern-arc-poster",
    title: "Fern Arc Poster",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium matte paper. Unframed. Made to order.",
    tags: ["fern", "poster", "botanical", "nz art", "wall print"],
    printFile: "print-poster-fern-arc.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: [
      { id: 43138, price: 2800, is_enabled: true },
      { id: 43141, price: 3400, is_enabled: true },
      { id: 43144, price: 3999, is_enabled: true, is_default: true },
    ],
    positions: ["front"],
  },
  {
    key: "fern-spray-tote",
    title: "Fern Spray Canvas Tote",
    description: "Classic cotton canvas tote with a large fern spray print. Everyday bag, made to order.",
    tags: ["tote", "canvas bag", "fern", "market bag", "nz"],
    printFile: "print-tote-fern-spray.png",
    blueprintId: 553,
    printProviderId: 34,
    variants: [
      { id: 70646, price: 3200, is_enabled: true, is_default: true },
      { id: 70603, price: 3200, is_enabled: true },
    ],
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
) {
  const needle = title.trim().toLowerCase();
  return products.find((product) => (product.title || "").trim().toLowerCase() === needle)?.id;
}
