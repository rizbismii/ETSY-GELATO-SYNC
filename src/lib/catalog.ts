import type { ProductTemplate } from "@/lib/types";

export const GELATO_CATALOG: ProductTemplate[] = [
  {
    uid: "posters_pt_poster_ps_12x16-in_pt_200-gsm-coated_cl_4-0_ver",
    name: "Poster 12×16 in",
    category: "poster",
    unitCost: 8.4,
    shippingCost: 4.2,
    keywords: ["poster", "print", "12x16", "botanical", "line art"],
  },
  {
    uid: "posters_pt_poster_ps_18x24-in_pt_200-gsm-coated_cl_4-0_ver",
    name: "Poster 18×24 in",
    category: "poster",
    unitCost: 12.9,
    shippingCost: 5.1,
    keywords: ["poster", "print", "18x24", "large"],
  },
  {
    uid: "wall_art_canvas_ps_16x20-in_pt_canvas_cl_4-0",
    name: "Canvas 16×20 in",
    category: "canvas",
    unitCost: 22.1,
    shippingCost: 8.5,
    keywords: ["canvas", "stretched", "16x20"],
  },
  {
    uid: "mugs_11oz_white_wrap",
    name: "Ceramic mug 11 oz",
    category: "mug",
    unitCost: 7.8,
    shippingCost: 5.1,
    keywords: ["mug", "coffee", "ceramic"],
  },
  {
    uid: "apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_natural_gpr_4-4",
    name: "Unisex tee · natural · M",
    category: "apparel",
    unitCost: 12.4,
    shippingCost: 5.8,
    keywords: ["tee", "t-shirt", "shirt", "apparel"],
  },
  {
    uid: "cards_pf_a5_pt_350-gsm-coated-silk_cl_4-4_ver",
    name: "Greeting card A5",
    category: "card",
    unitCost: 2.4,
    shippingCost: 2.9,
    keywords: ["card", "greeting", "stationery"],
  },
];

export function suggestTemplate(title: string, tags: string[] = []) {
  const haystack = `${title} ${tags.join(" ")}`.toLowerCase();
  const scored = GELATO_CATALOG.map((product) => {
    const score = product.keywords.reduce(
      (sum, keyword) => (haystack.includes(keyword) ? sum + 1 : sum),
      0,
    );
    return { product, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].product : GELATO_CATALOG[0];
}

export function templateByUid(uid?: string) {
  return GELATO_CATALOG.find((product) => product.uid === uid);
}
