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
  aliases?: string[];
};

function one(id: number, price: number): PrintifyVariantInput[] {
  return [{ id, price, is_enabled: true, is_default: true }];
}

/**
 * One unpublished Printify product per Fernora catalog item, one enabled variant each.
 * Not Gelato External migrations. Closest Printify size when A-series or 12×16 wood/acrylic
 * is not on the blueprint.
 */
export const FERNORA_PRINTIFY_STARTERS: PrintifyStarterSpec[] = [
  {
    key: "live_poster",
    title: "Fern Arc Poster · A3 Semi-Gloss",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium matte paper. Unframed. Made to order.",
    tags: ["fern", "poster", "botanical", "nz art", "wall print", "Original fern"],
    printFile: "print-poster-fern-arc.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43138, 5699),
    positions: ["front"],
    aliases: ["Fern Arc Poster"],
  },
  {
    key: "live_hoodie",
    title: "Fern Mark Unisex Hoodie",
    description: "Heavyweight unisex pullover hoodie with a chest fern emblem. Black / M. Made to order.",
    tags: ["hoodie", "fern", "unisex", "botanical", "nz", "Original fern"],
    printFile: "print-hoodie-fern-mark.png",
    blueprintId: 77,
    printProviderId: 99,
    variants: one(32919, 12599),
    positions: ["front"],
  },
  {
    key: "live_tote",
    title: "Fern Spray Canvas Tote · Natural",
    description: "Classic cotton canvas tote with a large fern spray print. Cream, one size. Made to order.",
    tags: ["tote", "canvas bag", "fern", "market bag", "nz", "Original fern"],
    printFile: "print-tote-fern-spray.png",
    blueprintId: 553,
    printProviderId: 34,
    variants: one(70646, 7199),
    positions: ["front"],
    aliases: ["Fern Spray Canvas Tote"],
  },
  {
    key: "live_mug",
    title: "Fern Band Mug · 11 oz White Ceramic",
    description: "11 oz white ceramic mug wrapped with a repeating fern band. Made to order.",
    tags: ["mug", "ceramic", "fern", "botanical", "coffee", "Original fern"],
    printFile: "print-mug-fern-band.png",
    blueprintId: 68,
    printProviderId: 1,
    variants: one(33719, 4999),
    positions: ["front"],
  },
  {
    key: "live_canvas",
    title: "Bush Light Canvas · 16×20 Slim Wrap",
    description:
      "Gallery-wrapped 16×20 in canvas of misty New Zealand bush with a silver fern in the foreground. Made to order.",
    tags: ["canvas", "wall art", "fern", "nz landscape", "painting", "Original fern"],
    printFile: "print-canvas-bush-light.png",
    blueprintId: 937,
    printProviderId: 99,
    variants: one(82231, 17699),
    positions: ["front"],
  },
  {
    key: "live_quote_breathe",
    title: "Breathe You Are Here · A3 Quote Poster",
    description:
      "Landscape matte print with a botanical border and the line “Breathe. You are here.” Unframed. Made to order.",
    tags: ["breathe", "quote", "kind", "poster", "positive", "Quotes"],
    printFile: "print-breathe-here.png",
    blueprintId: 284,
    printProviderId: 99,
    variants: one(43166, 5699),
    positions: ["front"],
  },
  {
    key: "live_quote_light",
    title: "Light Finds a Way · A2 Sunrise Quote",
    description: "Tall poster: soft sunrise wash and the line “Light finds a way.” Unframed. Made to order.",
    tags: ["light", "hope", "quote", "sunrise", "poster", "Quotes"],
    printFile: "print-light-finds.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43144, 7199),
    positions: ["front"],
  },
  {
    key: "live_botanical_kowhai",
    title: "Kowhai Bells · 18×24 Botanical Print",
    description: "Large 18×24 in painterly study of New Zealand kōwhai bells on cream. Unframed. Made to order.",
    tags: ["kowhai", "botanical", "flowers", "poster", "yellow", "Botanical"],
    printFile: "print-kowhai-botanical.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(43144, 7399),
    positions: ["front"],
  },
  {
    key: "live_tee_kind",
    title: "Be Kind Anyway Tee",
    description: "Unisex tee with a small chest line: “Be kind anyway.” Black / M. Made to order.",
    tags: ["kindness", "quote", "tshirt", "positive", "unisex", "Quotes"],
    printFile: "print-be-kind.png",
    blueprintId: 12,
    printProviderId: 99,
    variants: one(18101, 10299),
    positions: ["front"],
  },
  {
    key: "live_tote_grow",
    title: "Grow Anyway Tote · Black Canvas",
    description: "Black canvas tote with cream kōwhai linework and the words “Grow anyway.” Made to order.",
    tags: ["grow", "tote", "kowhai", "positive", "quote", "Quotes"],
    printFile: "print-grow-anyway.png",
    blueprintId: 553,
    printProviderId: 34,
    variants: one(70603, 7199),
    positions: ["front"],
  },
  {
    key: "live_mug_morning",
    title: "Good Morning Love Mug · 11 oz Black",
    description: "Black 11 oz ceramic mug wrapped with “Good morning, love.” Made to order.",
    tags: ["morning", "love", "mug", "quote", "coffee", "Quotes"],
    printFile: "print-good-morning.png",
    blueprintId: 479,
    printProviderId: 99,
    variants: one(65217, 5999),
    positions: ["front"],
  },
  {
    key: "live_sweat_soft",
    title: "Soft Days Ahead Sweatshirt",
    description: "Crewneck with cream lettering: “Soft days ahead.” Black / M. Made to order.",
    tags: ["calm", "sweatshirt", "quote", "hope", "unisex", "Quotes"],
    printFile: "print-soft-days.png",
    blueprintId: 49,
    printProviderId: 99,
    variants: one(25428, 10999),
    positions: ["front"],
  },
  {
    key: "live_canvas_harbour",
    title: "Harbour Morning Canvas · 12×12",
    description: "Square slim-wrap canvas of a quiet New Zealand harbour at first light. Made to order.",
    tags: ["harbour", "canvas", "landscape", "morning", "home", "Scenic"],
    printFile: "print-harbour-morning.png",
    blueprintId: 937,
    printProviderId: 99,
    variants: one(102204, 11899),
    positions: ["front"],
  },
  {
    key: "live_case_belong",
    title: "You Belong Here · iPhone 15 Slim Case",
    description: "Slim iPhone 15 case with a leaf and the line “You belong here.” Made to order.",
    tags: ["belong", "phonecase", "quote", "kind", "iphone", "Quotes"],
    printFile: "print-belong-here.png",
    blueprintId: 268,
    printProviderId: 1,
    variants: one(102543, 6799),
    positions: ["front"],
  },
  {
    key: "live_poster_pohutukawa",
    title: "Pōhutukawa Coast · 12×16 Print",
    description: "12×16 in coastal botanical of crimson pōhutukawa against summer sea. Unframed. Made to order.",
    tags: ["pohutukawa", "coast", "botanical", "summer", "poster", "Botanical"],
    printFile: "print-pohutukawa-coast.png",
    blueprintId: 282,
    printProviderId: 99,
    variants: one(101110, 5399),
    positions: ["front"],
  },
  {
    key: "live_frame_kind",
    title: "Home Is a Kind Light · 12×16 Oak Frame",
    description:
      "Walnut-framed 12×16 print: botanicals and “Home is a kind light.” Ready to hang. Made to order.",
    tags: ["home", "framed", "kind", "quote", "homedecor", "Home décor"],
    printFile: "print-kind-light.png",
    blueprintId: 540,
    printProviderId: 99,
    variants: one(69671, 18499),
    positions: ["front"],
  },
  {
    key: "live_frame_coast",
    title: "Wild Coast · A3 Black Wood Frame",
    description: "Black-wood framed painting of flax, cliffs and pale surf. Made to order.",
    tags: ["coast", "framed", "landscape", "homedecor", "home", "Home décor"],
    printFile: "print-wild-coast.png",
    blueprintId: 492,
    printProviderId: 36,
    variants: one(65402, 19799),
    positions: ["front"],
  },
  {
    key: "live_wood_tui",
    title: "Tui on Kōwhai · 12×16 Wood Print",
    description: "Plywood print of a tūī among kōwhai. Nature illustration, no glass. Made to order.",
    tags: ["tui", "kowhai", "woodprint", "bird", "home", "Home décor"],
    printFile: "print-tui-kowhai.png",
    blueprintId: 1530,
    printProviderId: 70,
    variants: one(109697, 20999),
    positions: ["front"],
  },
  {
    key: "live_acrylic_brave",
    title: "Be Brave in the Small Hours · 12×16 Acrylic",
    description:
      "Back-printed acrylic panel with a night-sea glow and “Be brave in the small hours.” Made to order.",
    tags: ["brave", "acrylic", "quote", "homedecor", "home", "Home décor"],
    printFile: "print-be-brave.png",
    blueprintId: 928,
    printProviderId: 104,
    variants: one(78319, 21099),
    positions: ["front"],
  },
  {
    key: "live_metal_dusk",
    title: "Dusk Hills · 12×16 Metallic Print",
    description: "Brushed metallic print of dusky New Zealand hills and a gold horizon. Made to order.",
    tags: ["dusk", "metallic", "hills", "homedecor", "home", "Home décor"],
    printFile: "print-dusk-hills.png",
    blueprintId: 1206,
    printProviderId: 228,
    variants: one(92004, 15399),
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
