import type { ProductTemplate } from "@/lib/types";

export const GELATO_CATALOG: ProductTemplate[] = [
  {
    uid: "flat_a3_200-gsm-80lb-coated-silk_4-0_ver",
    name: "A3 semi-gloss poster",
    category: "poster",
    unitCost: 17.23,
    shippingCost: 10.09,
    keywords: ["poster", "print", "a3", "botanical", "fern"],
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
    uid: "canvas_16x20-inch-400x500-mm_canvas_wood-fsc-slim_4-0_ver",
    name: "Canvas 16×20 in · slim wrap",
    category: "canvas",
    unitCost: 59.54,
    shippingCost: 15.15,
    keywords: ["canvas", "stretched", "16x20"],
  },
  {
    uid: "framed-posters_pt_poster_ps_12x16-in_frame_oak_pt_200-gsm_cl_4-0_ver",
    name: "Oak framed print 12×16 in",
    category: "framed",
    unitCost: 24.8,
    shippingCost: 8.9,
    keywords: ["framed", "frame", "oak", "wall art"],
  },
  {
    uid: "mug_product_msz_11-oz_mmat_ceramic-white_cl_4-0",
    name: "Ceramic mug 11 oz · white",
    category: "mug",
    unitCost: 13.59,
    shippingCost: 10.71,
    keywords: ["mug", "coffee", "ceramic"],
  },
  {
    uid: "apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0",
    name: "Unisex tee · Black, White, Navy · S–L",
    category: "apparel",
    unitCost: 12.4,
    shippingCost: 5.8,
    keywords: ["tee", "t-shirt", "shirt", "apparel"],
  },
  {
    uid: "apparel_product_gca_hoodie_gsc_pullover_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0",
    name: "Unisex pullover hoodie · Black, White, Navy · S–L",
    category: "hoodie",
    unitCost: 28.4,
    shippingCost: 6.8,
    keywords: ["hoodie", "sweatshirt", "pullover", "apparel"],
  },
  {
    uid: "bag_product_bsc_tote-bag_bqa_clc_bsi_std-t_bco_natural_bpr_4-0",
    name: "Canvas tote · natural",
    category: "tote",
    unitCost: 9.2,
    shippingCost: 4.9,
    keywords: ["tote", "bag", "canvas", "market"],
  },
  {
    uid: "calendars_wall_ps_11x17-in_pt_200-gsm_cl_4-4_ver",
    name: "Wall calendar 11×17 in",
    category: "calendar",
    unitCost: 15.2,
    shippingCost: 5.5,
    keywords: ["calendar", "wall", "year", "planner"],
  },
  {
    uid: "home_cushion_ps_18x18-in_pt_poly_cl_4-0",
    name: "Throw pillow 18×18 in",
    category: "pillow",
    unitCost: 16.4,
    shippingCost: 6.1,
    keywords: ["pillow", "cushion", "throw", "home"],
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
