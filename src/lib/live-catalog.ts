import { OFFSITE_ADS_RATE, TARGET_AFTER_ADS_MARGIN, recommendedPrice } from "@/lib/money";
import type { Listing } from "@/lib/types";

export const ETSY_SHOP_URL = "https://www.etsy.com/shop/FERNORATRENDS";

export function etsyListingUrl(listingId?: string | null) {
  if (!listingId) return undefined;
  return `https://www.etsy.com/listing/${listingId}`;
}
export const LIVE_DROP_ID = "fernora-live";
export const LIVE_DROP_NAME = "Fernora mix";
export const SHOP_NAME = "FERNORATRENDS";
export const SHOP_CURRENCY = "NZD";
export const RETURN_POLICY_ID = 1515682339963;
export const READINESS_STATE_ID = 1514454820482;

export const SHIP_COUNTRIES = [
  { region: "NZ", label: "New Zealand" },
  { region: "AU", label: "Australia" },
  { region: "US", label: "United States" },
  { region: "GB", label: "United Kingdom" },
  { region: "EU", label: "European Union" },
] as const;

export const SHIP_BLURB =
  "Ships to New Zealand, Australia, the United States, the United Kingdom, the European Union and more. Printed near the buyer by Gelato. Checkout shipping is the destination rate — Wellington 6012 is the shop address, not the parcel origin.";

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
  collection: "original" | "quote" | "botanical" | "scenic" | "home";
  quote?: string;
};

function priceFor(print: Record<string, number>, ship: Record<string, number>) {
  return Math.max(
    ...Object.keys(print).map((region) =>
      recommendedPrice(
        print[region],
        ship[region] ?? 0,
        TARGET_AFTER_ADS_MARGIN,
        OFFSITE_ADS_RATE,
      ),
    ),
  );
}

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

const posterPrint = { NZ: 17.23, AU: 16.28, US: 13.17, GB: 15.17, EU: 16.14 };
const hoodiePrint = { NZ: 40.88, AU: 37.53, US: 32.13, GB: 39.56, EU: 39.56 };
const totePrint = { NZ: 21.6, AU: 19.83, US: 18.92, GB: 22.98, EU: 23.02 };
const mugPrint = { NZ: 12.32, AU: 13.59, US: 10.43, GB: 8.5, EU: 8.5 };
const canvasPrint = { NZ: 39.14, AU: 59.54, US: 46.95, GB: 44.87, EU: 44.87 };
const a2Print = { NZ: 22.19, AU: 20.15, US: 16.82, GB: 18.17, EU: 18.93 };
const p18Print = { NZ: 23.09, AU: 20.97, US: 18.44, GB: 19.09, EU: 19.73 };
const teePrint = { NZ: 31.25, AU: 32.48, US: 23.8, GB: 25.9, EU: 22.48 };
const mugBlackPrint = { NZ: 15.67, AU: 17.34, US: 10.43, GB: 12.18, EU: 14.06 };
const sweatPrint = { NZ: 35.03, AU: 32.17, US: 26.64, GB: 33.89, EU: 32.94 };
const canvas12Print = { NZ: 27.49, AU: 38.79, US: 34.96, GB: 28.07, EU: 31.1 };
const casePrint = { NZ: 19.19, AU: 17.62, US: 16.32, GB: 22.13, EU: 20.45 };
const p1216Print = { NZ: 16.24, AU: 15.46, US: 10.74, GB: 13.1, EU: 15.34 };
const framePrint = { NZ: 60.85, AU: 54.47, US: 59.78, GB: 48.55, EU: 46.54 };
const frameA3Print = { NZ: 57.36, AU: 66.27, US: 51.29, GB: 45.62, EU: 45.05 };
const woodPrint = { NZ: 50.28, AU: 46.16, US: 66.08, GB: 51.94, EU: 53.6 };
const acrylicPrint = { NZ: 63.91, AU: 58.67, US: 55.98, GB: 66.03, EU: 68.12 };
const metalPrint = { NZ: 45.05, AU: 41.36, US: 39.46, GB: 46.53, EU: 48.02 };

const shipSmallPoster = { NZ: 10.09, AU: 12.76, US: 8.08, GB: 10.47, EU: 11.57 };
const shipLargePoster = { NZ: 11.81, AU: 15.31, US: 9.74, GB: 11.38, EU: 13.9 };
const shipTee = { NZ: 10.05, AU: 14.95, US: 8.24, GB: 6.38, EU: 7.88 };
const shipTote = { NZ: 11.57, AU: 10.51, US: 6.04, GB: 7.64, EU: 9.26 };
const shipMug = { NZ: 15.27, AU: 14.79, US: 10.71, GB: 8.22, EU: 11.57 };
const shipHoodie = { NZ: 13.98, AU: 17.3, US: 12.19, GB: 9.11, EU: 12.03 };
const shipCanvas = { NZ: 15.27, AU: 12.4, US: 15.15, GB: 9.32, EU: 15.05 };
const shipCase = { NZ: 10.41, AU: 9.46, US: 7.25, GB: 6.48, EU: 13.25 };
const shipFrame = { NZ: 15.27, AU: 15.07, US: 22.93, GB: 11.38, EU: 15.05 };
const shipWood = { NZ: 25.24, AU: 22.95, US: 32.37, GB: 6.64, EU: 18.31 };
const shipAcrylic = { NZ: 20.74, AU: 18.84, US: 17.42, GB: 18.37, EU: 25.68 };

function item(
  partial: LiveProduct,
): LiveProduct {
  return {
    ...partial,
    description: `${partial.description} ${SHIP_BLURB}`,
  };
}

export const LIVE_PRODUCTS: LiveProduct[] = [
  item({
    id: "live_poster",
    etsyListingId: "",
    title: "Fern Arc Poster · A3 Semi-Gloss",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium 200 gsm semi-gloss A3 paper. Unframed. Made to order.",
    state: "active",
    price: priceFor(posterPrint, shipSmallPoster),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["fern", "poster", "botanical", "nz art", "wall print"],
    category: "poster",
    collection: "original",
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
    lanes: lanes(posterPrint, shipSmallPoster),
  }),
  item({
    id: "live_hoodie",
    etsyListingId: "",
    title: "Fern Mark Unisex Hoodie · Black · M",
    description:
      "Heavyweight unisex pullover hoodie in black with a chest fern emblem. Size M shown; message for other sizes. Made to order.",
    state: "active",
    price: priceFor(hoodiePrint, shipHoodie),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["hoodie", "fern", "unisex", "botanical", "nz"],
    category: "hoodie",
    collection: "original",
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
    lanes: lanes(hoodiePrint, shipHoodie),
  }),
  item({
    id: "live_tote",
    etsyListingId: "",
    title: "Fern Spray Canvas Tote · Natural",
    description: "Classic canvas tote in natural with a large fern spray print. Everyday bag, made to order.",
    state: "active",
    price: priceFor(totePrint, shipTote),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["tote", "canvas bag", "fern", "market bag", "nz"],
    category: "tote",
    collection: "original",
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
    lanes: lanes(totePrint, shipTote),
  }),
  item({
    id: "live_mug",
    etsyListingId: "",
    title: "Fern Band Mug · 11 oz White Ceramic",
    description: "11 oz white ceramic mug wrapped with a repeating fern band. Made to order.",
    state: "active",
    price: priceFor(mugPrint, shipMug),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["mug", "ceramic", "fern", "botanical", "coffee"],
    category: "mug",
    collection: "original",
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
    lanes: lanes(mugPrint, shipMug),
  }),
  item({
    id: "live_canvas",
    etsyListingId: "",
    title: "Bush Light Canvas · 16×20 Slim Wrap",
    description:
      "Gallery-wrapped 16×20 in canvas of misty New Zealand bush with a silver fern in the foreground. Slim FSC wood stretcher. Made to order.",
    state: "active",
    price: priceFor(canvasPrint, shipCanvas),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["canvas", "wall art", "fern", "nz landscape", "painting"],
    category: "canvas",
    collection: "original",
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
    lanes: lanes(canvasPrint, shipCanvas),
  }),

  item({
    id: "live_quote_breathe",
    etsyListingId: "",
    title: "Breathe You Are Here · A3 Quote Poster",
    description:
      "Landscape A3 semi-gloss print with a botanical border and the line “Breathe. You are here.” A calm reminder for a hallway, studio or bedside. Unframed.",
    quote: "Breathe. You are here.",
    state: "active",
    price: priceFor(posterPrint, shipSmallPoster),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["breathe", "quote", "kind", "poster", "positive"],
    category: "poster",
    collection: "quote",
    gelatoProductUid: "flat_a3_200-gsm-80lb-coated-silk_4-0_hor",
    gelatoProductName: "A3 semi-gloss poster · landscape",
    printFileUrl: "/catalog/print-breathe-here.png",
    imageUrl: "/catalog/catalog-breathe-here.png",
    gelatoUnitCost: Math.max(...Object.values(posterPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 119,
    shippingProfileId: 315080633003,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(posterPrint, shipSmallPoster),
  }),
  item({
    id: "live_quote_light",
    etsyListingId: "",
    title: "Light Finds a Way · A2 Sunrise Quote",
    description:
      "Tall A2 poster: soft sunrise wash and the line “Light finds a way.” Hopeful wall art without the abstract-grid look. Unframed.",
    quote: "Light finds a way.",
    state: "active",
    price: priceFor(a2Print, shipLargePoster),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["light", "hope", "quote", "sunrise", "poster"],
    category: "poster",
    collection: "quote",
    gelatoProductUid: "flat_a2_200-gsm-80lb-coated-silk_4-0_ver",
    gelatoProductName: "A2 semi-gloss poster",
    printFileUrl: "/catalog/print-light-finds.png",
    imageUrl: "/catalog/catalog-light-finds.png",
    gelatoUnitCost: Math.max(...Object.values(a2Print)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 119,
    shippingProfileId: 315080634723,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(a2Print, shipLargePoster),
  }),
  item({
    id: "live_botanical_kowhai",
    etsyListingId: "",
    title: "Kowhai Bells · 18×24 Botanical Print",
    description:
      "Large 18×24 in painterly study of New Zealand kōwhai bells on cream. Botanical, not abstract. Unframed.",
    state: "active",
    price: priceFor(p18Print, shipLargePoster),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["kowhai", "botanical", "flowers", "poster", "yellow"],
    category: "poster",
    collection: "botanical",
    gelatoProductUid: "flat_18x24-inch-450x600-mm_200-gsm-80lb-coated-silk_4-0_ver",
    gelatoProductName: "18×24 in semi-gloss poster",
    printFileUrl: "/catalog/print-kowhai-botanical.png",
    imageUrl: "/catalog/catalog-kowhai-botanical.png",
    gelatoUnitCost: Math.max(...Object.values(p18Print)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 119,
    shippingProfileId: 315080634723,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(p18Print, shipLargePoster),
  }),
  item({
    id: "live_tee_kind",
    etsyListingId: "",
    title: "Be Kind Anyway Tee · Natural · M",
    description:
      "Unisex natural tee with a small chest line: “Be kind anyway.” Soft positive merch. Size M; message for other sizes.",
    quote: "Be kind anyway.",
    state: "active",
    price: priceFor(teePrint, shipTee),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["kindness", "quote", "tshirt", "positive", "unisex"],
    category: "tee",
    collection: "quote",
    gelatoProductUid:
      "apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_natural_gpr_4-4",
    gelatoProductName: "Unisex tee · natural · M",
    printFileUrl: "/catalog/print-be-kind.png",
    imageUrl: "/catalog/catalog-be-kind.png",
    gelatoUnitCost: Math.max(...Object.values(teePrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 482,
    shippingProfileId: 315080657135,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(teePrint, shipTee),
  }),
  item({
    id: "live_tote_grow",
    etsyListingId: "",
    title: "Grow Anyway Tote · Black Canvas",
    description:
      "Black canvas tote with cream kōwhai linework and the words “Grow anyway.” Everyday bag with a positive tag.",
    quote: "Grow anyway.",
    state: "active",
    price: priceFor(totePrint, shipTote),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["grow", "tote", "kowhai", "positive", "quote"],
    category: "tote",
    collection: "quote",
    gelatoProductUid: "bag_product_bsc_tote-bag_bqa_clc_bsi_std-t_bco_black_bpr_4-0",
    gelatoProductName: "Canvas tote · black",
    printFileUrl: "/catalog/print-grow-anyway.png",
    imageUrl: "/catalog/catalog-grow-anyway.png",
    gelatoUnitCost: Math.max(...Object.values(totePrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 190,
    shippingProfileId: 315489894080,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(totePrint, shipTote),
  }),
  item({
    id: "live_mug_morning",
    etsyListingId: "",
    title: "Good Morning Love Mug · 11 oz Black",
    description:
      "Black 11 oz ceramic mug wrapped with “Good morning, love.” A warm daily ritual mug, made to order.",
    quote: "Good morning, love.",
    state: "active",
    price: priceFor(mugBlackPrint, shipMug),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["morning", "love", "mug", "quote", "coffee"],
    category: "mug",
    collection: "quote",
    gelatoProductUid: "mug_product_msz_11-oz_mmat_ceramic-black_cl_4-0",
    gelatoProductName: "Ceramic mug 11 oz · black",
    printFileUrl: "/catalog/print-good-morning.png",
    imageUrl: "/catalog/catalog-good-morning.png",
    gelatoUnitCost: Math.max(...Object.values(mugBlackPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1062,
    shippingProfileId: 315489886708,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(mugBlackPrint, shipMug),
  }),
  item({
    id: "live_sweat_soft",
    etsyListingId: "",
    title: "Soft Days Ahead Sweatshirt · Black · M",
    description:
      "Black crewneck with cream lettering: “Soft days ahead.” Unisex size M; message for other sizes.",
    quote: "Soft days ahead.",
    state: "active",
    price: priceFor(sweatPrint, shipHoodie),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["calm", "sweatshirt", "quote", "hope", "unisex"],
    category: "sweatshirt",
    collection: "quote",
    gelatoProductUid:
      "apparel_product_gca_sweatshirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0",
    gelatoProductName: "Unisex sweatshirt · black · M",
    printFileUrl: "/catalog/print-soft-days.png",
    imageUrl: "/catalog/catalog-soft-days.png",
    gelatoUnitCost: Math.max(...Object.values(sweatPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 2202,
    shippingProfileId: 315489892134,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(sweatPrint, shipHoodie),
  }),
  item({
    id: "live_canvas_harbour",
    etsyListingId: "",
    title: "Harbour Morning Canvas · 12×12",
    description:
      "Square slim-wrap canvas of a quiet New Zealand harbour at first light. Scenic, not geometric abstract.",
    state: "active",
    price: priceFor(canvas12Print, shipCanvas),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["harbour", "canvas", "landscape", "morning", "home"],
    category: "canvas",
    collection: "scenic",
    gelatoProductUid: "canvas_12x12-inch-300x300-mm_canvas_wood-fsc-slim_4-0_ver",
    gelatoProductName: "Canvas 12×12 in · slim wrap",
    printFileUrl: "/catalog/print-harbour-morning.png",
    imageUrl: "/catalog/catalog-harbour-morning.png",
    gelatoUnitCost: Math.max(...Object.values(canvas12Print)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1027,
    shippingProfileId: 315080642699,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(canvas12Print, shipCanvas),
  }),
  item({
    id: "live_case_belong",
    etsyListingId: "",
    title: "You Belong Here · iPhone 15 Slim Case",
    description:
      "Slim glossy iPhone 15 case with a leaf and the line “You belong here.” Positive everyday carry.",
    quote: "You belong here.",
    state: "active",
    price: priceFor(casePrint, shipCase),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["belong", "phonecase", "quote", "kind", "iphone"],
    category: "case",
    collection: "quote",
    gelatoProductUid: "phonecase_apple_iphone-15_slim_white_glossy",
    gelatoProductName: "iPhone 15 slim case · white",
    printFileUrl: "/catalog/print-belong-here.png",
    imageUrl: "/catalog/catalog-belong-here.png",
    gelatoUnitCost: Math.max(...Object.values(casePrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 873,
    shippingProfileId: 315489920168,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(casePrint, shipCase),
  }),
  item({
    id: "live_poster_pohutukawa",
    etsyListingId: "",
    title: "Pōhutukawa Coast · 12×16 Print",
    description:
      "12×16 in coastal botanical of crimson pōhutukawa against summer sea. Unframed paper print.",
    state: "active",
    price: priceFor(p1216Print, shipSmallPoster),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["pohutukawa", "coast", "botanical", "summer", "poster"],
    category: "poster",
    collection: "botanical",
    gelatoProductUid: "flat_12x16-inch-300x400-mm_200-gsm-80lb-coated-silk_4-0_ver",
    gelatoProductName: "12×16 in semi-gloss poster",
    printFileUrl: "/catalog/print-pohutukawa-coast.png",
    imageUrl: "/catalog/catalog-pohutukawa-coast.png",
    gelatoUnitCost: Math.max(...Object.values(p1216Print)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 119,
    shippingProfileId: 315080633003,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(p1216Print, shipSmallPoster),
  }),

  item({
    id: "live_frame_kind",
    etsyListingId: "",
    title: "Home Is a Kind Light · 12×16 Oak Frame",
    description:
      "Natural-wood framed 12×16 print: botanicals and “Home is a kind light.” Ready to hang home décor.",
    quote: "Home is a kind light.",
    state: "active",
    price: priceFor(framePrint, shipFrame),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["home", "framed", "kind", "quote", "homedecor"],
    category: "framed",
    collection: "home",
    gelatoProductUid:
      "frame_and_poster_product_frs_300x400-mm_frc_natural-wood_frm_wood_frp_w12xt22-mm_gt_plexiglass__pf_300x400-mm_pt_200-gsm-coated-silk_cl_4-0_ct_none_prt_none_ver",
    gelatoProductName: "12×16 in oak framed print",
    printFileUrl: "/catalog/print-kind-light.png",
    imageUrl: "/catalog/catalog-kind-light.png",
    gelatoUnitCost: Math.max(...Object.values(framePrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1027,
    shippingProfileId: 315489864704,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(framePrint, shipFrame),
  }),
  item({
    id: "live_frame_coast",
    etsyListingId: "",
    title: "Wild Coast · A3 Black Wood Frame",
    description:
      "A3 black-wood framed painting of flax, cliffs and pale surf. Landscape home décor, made to order.",
    state: "active",
    price: priceFor(frameA3Print, shipFrame),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["coast", "framed", "landscape", "homedecor", "home"],
    category: "framed",
    collection: "home",
    gelatoProductUid:
      "frame_and_poster_product_frs_a3_frc_black_frm_wood_frp_w12xt22-mm_gt_plexiglass__pf_a3_pt_200-gsm-coated-silk_cl_4-0_ct_none_prt_none_ver",
    gelatoProductName: "A3 black wood framed print",
    printFileUrl: "/catalog/print-wild-coast.png",
    imageUrl: "/catalog/catalog-wild-coast.png",
    gelatoUnitCost: Math.max(...Object.values(frameA3Print)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1027,
    shippingProfileId: 315489864704,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(frameA3Print, shipFrame),
  }),
  item({
    id: "live_wood_tui",
    etsyListingId: "",
    title: "Tui on Kōwhai · 12×16 Wood Print",
    description:
      "10 mm plywood print of a tūī among kōwhai. Nature illustration for a shelf or wall. No glass, ready to hang.",
    state: "active",
    price: priceFor(woodPrint, shipWood),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["tui", "kowhai", "woodprint", "bird", "home"],
    category: "wood",
    collection: "home",
    gelatoProductUid: "wood_12x16-inch-300x400-mm_lined-plywood_10-mm_hor-grain_4-0_ver",
    gelatoProductName: "12×16 in wood print · 10 mm",
    printFileUrl: "/catalog/print-tui-kowhai.png",
    imageUrl: "/catalog/catalog-tui-kowhai.png",
    gelatoUnitCost: Math.max(...Object.values(woodPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1027,
    shippingProfileId: 315489904722,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(woodPrint, shipWood),
  }),
  item({
    id: "live_acrylic_brave",
    etsyListingId: "",
    title: "Be Brave in the Small Hours · 12×16 Acrylic",
    description:
      "Back-printed acrylic panel with a night-sea glow and “Be brave in the small hours.” Modern home décor.",
    quote: "Be brave in the small hours.",
    state: "active",
    price: priceFor(acrylicPrint, shipAcrylic),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["brave", "acrylic", "quote", "homedecor", "home"],
    category: "acrylic",
    collection: "home",
    gelatoProductUid: "acrylic_12x16-inch-300x400-mm_4-mm_4-0_ver",
    gelatoProductName: "12×16 in acrylic print",
    printFileUrl: "/catalog/print-be-brave.png",
    imageUrl: "/catalog/catalog-be-brave.png",
    gelatoUnitCost: Math.max(...Object.values(acrylicPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1027,
    shippingProfileId: 315489880680,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(acrylicPrint, shipAcrylic),
  }),
  item({
    id: "live_metal_dusk",
    etsyListingId: "",
    title: "Dusk Hills · 12×16 Metallic Print",
    description:
      "Brushed metallic print of dusky New Zealand hills and a gold horizon. Scenic home décor, not an abstract grid.",
    state: "active",
    price: priceFor(metalPrint, shipAcrylic),
    currency: "NZD",
    quantity: 999,
    views: 0,
    favorites: 0,
    tags: ["dusk", "metallic", "hills", "homedecor", "home"],
    category: "metallic",
    collection: "home",
    gelatoProductUid: "metallic_12x16-inch-300x400-mm_3-mm_4-0_ver",
    gelatoProductName: "12×16 in metallic print",
    printFileUrl: "/catalog/print-dusk-hills.png",
    imageUrl: "/catalog/catalog-dusk-hills.png",
    gelatoUnitCost: Math.max(...Object.values(metalPrint)),
    drop: LIVE_DROP_ID,
    issues: [],
    taxonomyId: 1027,
    shippingProfileId: 315489880680,
    returnPolicyId: RETURN_POLICY_ID,
    publishState: "ready",
    lanes: lanes(metalPrint, shipAcrylic),
  }),
];

export function liveListings(): Listing[] {
  return LIVE_PRODUCTS.map((product) => ({ ...product }));
}

export function liveProductById(id: string) {
  return LIVE_PRODUCTS.find((row) => row.id === id);
}

export const ETSY_KNOWN_LISTINGS: Record<string, { id: string; url: string }> = {
  live_poster: { id: "4574328954", url: "https://www.etsy.com/listing/4574328954/fern-arc-poster-a3-semi-gloss" },
  live_hoodie: { id: "4574309819", url: "https://www.etsy.com/listing/4574309819/fern-mark-unisex-hoodie-black-m" },
  live_tote: { id: "4574329002", url: "https://www.etsy.com/listing/4574329002/fern-spray-canvas-tote-natural" },
  live_mug: { id: "4574329006", url: "https://www.etsy.com/listing/4574329006/fern-band-mug-11-oz-white-ceramic" },
  live_canvas: { id: "4574309835", url: "https://www.etsy.com/listing/4574309835/bush-light-canvas-1620-slim-wrap" },
  live_quote_breathe: { id: "4574325379", url: "https://www.etsy.com/listing/4574325379/breathe-you-are-here-a3-quote-poster" },
  live_quote_light: { id: "4574344244", url: "https://www.etsy.com/listing/4574344244/light-finds-a-way-a2-sunrise-quote" },
  live_botanical_kowhai: { id: "4574344254", url: "https://www.etsy.com/listing/4574344254/kowhai-bells-1824-botanical-print" },
  live_tee_kind: { id: "4574325401", url: "https://www.etsy.com/listing/4574325401/be-kind-anyway-tee-natural-m" },
  live_tote_grow: { id: "4574325409", url: "https://www.etsy.com/listing/4574325409/grow-anyway-tote-black-canvas" },
  live_mug_morning: { id: "4574344284", url: "https://www.etsy.com/listing/4574344284/good-morning-love-mug-11-oz-black" },
  live_sweat_soft: { id: "4574344292", url: "https://www.etsy.com/listing/4574344292/soft-days-ahead-sweatshirt-black-m" },
  live_canvas_harbour: { id: "4574344298", url: "https://www.etsy.com/listing/4574344298/harbour-morning-canvas-1212" },
  live_case_belong: { id: "4574344314", url: "https://www.etsy.com/listing/4574344314/you-belong-here-iphone-15-slim-case" },
  live_poster_pohutukawa: { id: "4574344320", url: "https://www.etsy.com/listing/4574344320/phutukawa-coast-1216-print" },
  live_frame_kind: { id: "4574344328", url: "https://www.etsy.com/listing/4574344328/home-is-a-kind-light-1216-oak-frame" },
  live_frame_coast: { id: "4574344336", url: "https://www.etsy.com/listing/4574344336/wild-coast-a3-black-wood-frame" },
  live_wood_tui: { id: "4574325495", url: "https://www.etsy.com/listing/4574325495/tui-on-kwhai-1216-wood-print" },
  live_acrylic_brave: { id: "4574325509", url: "https://www.etsy.com/listing/4574325509/be-brave-in-the-small-hours-1216-acrylic" },
  live_metal_dusk: { id: "4574344360", url: "https://www.etsy.com/listing/4574344360/dusk-hills-1216-metallic-print" },
};
