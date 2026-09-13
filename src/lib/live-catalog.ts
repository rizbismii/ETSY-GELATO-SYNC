import { recommendedPrice } from "@/lib/money";
import type { Listing } from "@/lib/types";

export const LIVE_DROP_ID = "fernora-live";
export const LIVE_DROP_NAME = "Fernora live five";
export const SHOP_NAME = "FERNORATRENDS";
export const SHOP_CURRENCY = "NZD";
export const RETURN_POLICY_ID = 1515682339963;

export type ShipLane = {
  region: string;
  label: string;
  country: string;
  shipping: number;
  printCost: number;
  days: string;
};

export type LiveProduct = Listing & {
  description: string;
  imageUrl: string;
  taxonomyId: number;
  shippingProfileId: number;
  returnPolicyId: number;
  publishState: "ready" | "draft" | "live";
  lanes: ShipLane[];
};

function priceFor(printCosts: number[]) {
  return recommendedPrice(Math.max(...printCosts), 0);
}

const posterPrint = { NZ: 17.23, AU: 16.28, US: 13.17, GB: 15.17, EU: 15.17 };
const hoodiePrint = { NZ: 40.88, AU: 37.53, US: 32.13, GB: 39.56, EU: 39.56 };
const totePrint = { NZ: 21.6, AU: 19.83, US: 18.92, GB: 22.98, EU: 22.98 };
const mugPrint = { NZ: 12.32, AU: 13.59, US: 10.43, GB: 8.5, EU: 8.5 };
const canvasPrint = { NZ: 39.14, AU: 59.54, US: 46.95, GB: 44.87, EU: 44.87 };

function lanes(
  print: Record<string, number>,
  ship: Record<string, number>,
): ShipLane[] {
  return [
    { region: "NZ", label: "New Zealand", country: "NZ", shipping: ship.NZ, printCost: print.NZ, days: "2–8 days" },
    { region: "AU", label: "Australia", country: "AU", shipping: ship.AU, printCost: print.AU, days: "3–10 days" },
    { region: "US", label: "United States", country: "US", shipping: ship.US, printCost: print.US, days: "4–12 days" },
    { region: "GB", label: "United Kingdom", country: "GB", shipping: ship.GB, printCost: print.GB, days: "4–12 days" },
    { region: "EU", label: "European Union", country: "DE", shipping: ship.EU, printCost: print.EU, days: "4–12 days" },
  ];
}

export const LIVE_PRODUCTS: LiveProduct[] = [
  {
    id: "live_poster",
    etsyListingId: "",
    title: "Fern Arc Poster · A3 Semi-Gloss",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium 200 gsm semi-gloss A3 paper. Designed for FERNORATRENDS and printed at a Gelato press near the buyer so it does not ship from New Zealand as a parcel from Wellington. Unframed. Made to order, typically dispatched in a few business days.",
    state: "active",
    price: priceFor(Object.values(posterPrint)),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["fern", "poster", "botanical", "nz art", "wall print"],
    category: "poster",
    gelatoProductUid: "flat_a3_200-gsm-80lb-coated-silk_4-0_ver",
    gelatoProductName: "A3 semi-gloss poster",
    printFileUrl: "/catalog/print-poster-fern-arc.png",
    imageUrl: "/catalog/catalog-poster.png",
    gelatoUnitCost: Math.max(...Object.values(posterPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 119,
    shippingProfileId: 315080633003,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(posterPrint, { NZ: 10.09, AU: 12.76, US: 8.08, GB: 10.47, EU: 11.57 }),
  },
  {
    id: "live_hoodie",
    etsyListingId: "",
    title: "Fern Mark Unisex Hoodie · Black · M",
    description:
      "Heavyweight unisex pullover hoodie in black with a chest fern emblem designed for FERNORATRENDS. Gelato prints the garment in-region (US, UK, EU, AU and more) so a Wellington origin on the Etsy profile is only the shop address — the hoodie itself is printed close to the buyer. Size M shown; message for other sizes. Made to order.",
    state: "active",
    price: priceFor(Object.values(hoodiePrint)),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["hoodie", "fern", "unisex", "botanical", "nz"],
    category: "hoodie",
    gelatoProductUid:
      "apparel_product_gca_hoodie_gsc_pullover_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0",
    gelatoProductName: "Unisex pullover hoodie · black · M",
    printFileUrl: "/catalog/print-hoodie-fern-mark.png",
    imageUrl: "/catalog/catalog-hoodie.png",
    gelatoUnitCost: Math.max(...Object.values(hoodiePrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1849,
    shippingProfileId: 315489892134,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(hoodiePrint, { NZ: 13.98, AU: 17.3, US: 12.19, GB: 9.11, EU: 12.03 }),
  },
  {
    id: "live_tote",
    etsyListingId: "",
    title: "Fern Spray Canvas Tote · Natural",
    description:
      "Classic canvas tote in natural with a large fern spray print. Everyday bag, printed to order by Gelato. Shipping rates on Etsy already follow Gelato’s destination prices so a US or UK order prints locally instead of crossing the Pacific from NZ. Made to order.",
    state: "active",
    price: priceFor(Object.values(totePrint)),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["tote", "canvas bag", "fern", "market bag", "nz"],
    category: "tote",
    gelatoProductUid: "bag_product_bsc_tote-bag_bqa_clc_bsi_std-t_bco_natural_bpr_4-0",
    gelatoProductName: "Canvas tote · natural",
    printFileUrl: "/catalog/print-tote-fern-spray.png",
    imageUrl: "/catalog/catalog-tote.png",
    gelatoUnitCost: Math.max(...Object.values(totePrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 190,
    shippingProfileId: 315489894080,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(totePrint, { NZ: 11.57, AU: 10.51, US: 6.04, GB: 7.64, EU: 9.26 }),
  },
  {
    id: "live_mug",
    etsyListingId: "",
    title: "Fern Band Mug · 11 oz White Ceramic",
    description:
      "11 oz white ceramic mug wrapped with a repeating fern band. Dishwasher-aware ceramic print, made to order. Gelato fulfils from a regional mug plant; the Etsy shipping profile already prices NZ, AU, US, UK and EU separately so remote rest-of-world quotes stay honest. Not a stocked warehouse mug.",
    state: "active",
    price: priceFor(Object.values(mugPrint)),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["mug", "ceramic", "fern", "botanical", "coffee"],
    category: "mug",
    gelatoProductUid: "mug_product_msz_11-oz_mmat_ceramic-white_cl_4-0",
    gelatoProductName: "Ceramic mug 11 oz · white",
    printFileUrl: "/catalog/print-mug-fern-band.png",
    imageUrl: "/catalog/catalog-mug.png",
    gelatoUnitCost: Math.max(...Object.values(mugPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1062,
    shippingProfileId: 315489885360,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(mugPrint, { NZ: 15.27, AU: 14.79, US: 10.71, GB: 8.22, EU: 11.57 }),
  },
  {
    id: "live_canvas",
    etsyListingId: "",
    title: "Bush Light Canvas · 16×20 Slim Wrap",
    description:
      "Gallery-wrapped 16×20 in canvas of misty New Zealand bush with a silver fern in the foreground. Slim FSC wood stretcher, printed to order. Canvas print cost is highest in Australia, so the Etsy price is set to keep about 42% net even on an AU order after marketplace fees. Made to order, ships from a Gelato canvas facility near the buyer.",
    state: "active",
    price: priceFor(Object.values(canvasPrint)),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["canvas", "wall art", "fern", "nz landscape", "painting"],
    category: "canvas",
    gelatoProductUid: "canvas_16x20-inch-400x500-mm_canvas_wood-fsc-slim_4-0_ver",
    gelatoProductName: "Canvas 16×20 in · slim wrap",
    printFileUrl: "/catalog/print-canvas-bush-light.png",
    imageUrl: "/catalog/catalog-canvas.png",
    gelatoUnitCost: Math.max(...Object.values(canvasPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 119,
    shippingProfileId: 315080642699,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(canvasPrint, { NZ: 15.27, AU: 12.4, US: 15.15, GB: 9.32, EU: 15.05 }),
  },
];

export function liveListings(): Listing[] {
  return LIVE_PRODUCTS.map((product) => ({ ...product }));
}

export function liveProductById(id: string) {
  return LIVE_PRODUCTS.find((row) => row.id === id);
}
