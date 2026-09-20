import { resolveCatalogLine } from "@/lib/clothing";
import { GELATO_SHIP_BLURB } from "@/lib/gelato-countries";
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

export const SHIP_BLURB = GELATO_SHIP_BLURB;

/** One product per Catalog mix so All / Quotes / Botanical / Scenic / Home décor / Original fern stay filled. */
export const LIVE_CATALOG_IDS = [
  "live_poster",
  "live_quote_breathe",
  "live_botanical_kowhai",
  "live_canvas_harbour",
  "live_frame_kind",
] as const;

export type LiveCatalogId = (typeof LIVE_CATALOG_IDS)[number];

export function isLiveCatalogId(id?: string | null): id is LiveCatalogId {
  return Boolean(id && (LIVE_CATALOG_IDS as readonly string[]).includes(id));
}

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
const p18Print = { NZ: 23.09, AU: 20.97, US: 18.44, GB: 19.09, EU: 19.73 };
const canvas12Print = { NZ: 27.49, AU: 38.79, US: 34.96, GB: 28.07, EU: 31.1 };
const framePrint = { NZ: 60.85, AU: 54.47, US: 59.78, GB: 48.55, EU: 46.54 };

const shipSmallPoster = { NZ: 10.09, AU: 12.76, US: 8.08, GB: 10.47, EU: 11.57 };
const shipLargePoster = { NZ: 11.81, AU: 15.31, US: 9.74, GB: 11.38, EU: 13.9 };
const shipCanvas = { NZ: 15.27, AU: 12.4, US: 15.15, GB: 9.32, EU: 15.05 };
const shipFrame = { NZ: 15.27, AU: 15.07, US: 22.93, GB: 11.38, EU: 15.05 };

/** Old Etsy listing IDs from the deleted 20-item Gelato mix. Never treat these as live. */
export const STALE_ETSY_LISTINGS: Record<string, { id: string; url: string }> = {
  live_poster: { id: "4574328954", url: "https://www.etsy.com/listing/4574328954/fern-arc-poster-a3-semi-gloss" },
  live_hoodie: { id: "4574309819", url: "https://www.etsy.com/listing/4574309819/fern-mark-unisex-hoodie" },
  live_tote: { id: "4574329002", url: "https://www.etsy.com/listing/4574329002/fern-spray-canvas-tote-natural" },
  live_mug: { id: "4574329006", url: "https://www.etsy.com/listing/4574329006/fern-band-mug-11-oz-white-ceramic" },
  live_canvas: { id: "4574309835", url: "https://www.etsy.com/listing/4574309835/bush-light-canvas-1620-slim-wrap" },
  live_quote_breathe: { id: "4574325379", url: "https://www.etsy.com/listing/4574325379/breathe-you-are-here-a3-quote-poster" },
  live_quote_light: { id: "4574344244", url: "https://www.etsy.com/listing/4574344244/light-finds-a-way-a2-sunrise-quote" },
  live_botanical_kowhai: { id: "4574344254", url: "https://www.etsy.com/listing/4574344254/kowhai-bells-1824-botanical-print" },
  live_tee_kind: { id: "4574325401", url: "https://www.etsy.com/listing/4574325401/be-kind-anyway-tee" },
  live_tote_grow: { id: "4574325409", url: "https://www.etsy.com/listing/4574325409/grow-anyway-tote-black-canvas" },
  live_mug_morning: { id: "4574344284", url: "https://www.etsy.com/listing/4574344284/good-morning-love-mug-11-oz-black" },
  live_sweat_soft: { id: "4574344292", url: "https://www.etsy.com/listing/4574344292/soft-days-ahead-sweatshirt" },
  live_canvas_harbour: { id: "4574344298", url: "https://www.etsy.com/listing/4574344298/harbour-morning-canvas-1212" },
  live_case_belong: { id: "4574344314", url: "https://www.etsy.com/listing/4574344314/you-belong-here-iphone-15-slim-case" },
  live_poster_pohutukawa: { id: "4574344320", url: "https://www.etsy.com/listing/4574344320/phutukawa-coast-1216-print" },
  live_frame_kind: { id: "4574344328", url: "https://www.etsy.com/listing/4574344328/home-is-a-kind-light-1216-oak-frame" },
  live_frame_coast: { id: "4574344336", url: "https://www.etsy.com/listing/4574344336/wild-coast-a3-black-wood-frame" },
  live_wood_tui: { id: "4574325495", url: "https://www.etsy.com/listing/4574325495/tui-on-kwhai-1216-wood-print" },
  live_acrylic_brave: { id: "4574897456", url: "https://www.etsy.com/listing/4574897456/be-brave-in-the-small-hours-1216-acrylic" },
  live_metal_dusk: { id: "4574344360", url: "https://www.etsy.com/listing/4574344360/dusk-hills-1216-metallic-print" },
};

/** Old Gelato store products from the deleted mix. Never show these as connected. */
export const STALE_GELATO_PRODUCTS: Record<string, { storeProductId: string; connected: number; variants: number }> = {
  live_poster: { storeProductId: "77a51048-4077-434b-8a7a-35668e9d756e", connected: 1, variants: 1 },
  live_hoodie: { storeProductId: "1ae57f04-c508-443a-87ae-f76062fb80ba", connected: 9, variants: 9 },
  live_tote: { storeProductId: "d883b16f-0329-4dac-bd0d-c01ee61cb0e0", connected: 1, variants: 1 },
  live_mug: { storeProductId: "f2447b03-b183-4dbc-9c75-c5442edefc45", connected: 1, variants: 1 },
  live_canvas: { storeProductId: "bfe96394-4162-4f4c-ac6d-039d25db7add", connected: 1, variants: 1 },
  live_quote_breathe: { storeProductId: "414c2c1f-f6ac-429d-a099-0ae9420dfa6b", connected: 1, variants: 1 },
  live_quote_light: { storeProductId: "3856eed8-36d1-4e5d-a0e3-0ac6b6a3e62f", connected: 1, variants: 1 },
  live_botanical_kowhai: { storeProductId: "61eb8b72-ffad-4cee-8a29-fc62d4794e12", connected: 1, variants: 1 },
  live_tee_kind: { storeProductId: "f450d01d-e7a1-46e0-8151-edb59e718215", connected: 9, variants: 9 },
  live_tote_grow: { storeProductId: "8fb7053b-4741-4eff-ba70-f7c099b3af4c", connected: 1, variants: 1 },
  live_mug_morning: { storeProductId: "bf4ca989-c098-47c9-af6a-c3de6b8392a4", connected: 1, variants: 1 },
  live_sweat_soft: { storeProductId: "b325cc11-4525-4466-b935-6138a7eddb21", connected: 9, variants: 9 },
  live_canvas_harbour: { storeProductId: "e449d4b7-5a34-4540-9651-2ece53f09979", connected: 1, variants: 1 },
  live_case_belong: { storeProductId: "ce702394-4267-4263-a46c-d0daf3c7fe43", connected: 1, variants: 1 },
  live_poster_pohutukawa: { storeProductId: "22ece968-82cc-4609-b431-c293ac7366f1", connected: 1, variants: 1 },
  live_frame_kind: { storeProductId: "cae48037-cbbb-424d-8bdd-4f9adff40bd1", connected: 1, variants: 1 },
  live_frame_coast: { storeProductId: "afa0e8ff-68f2-4a31-bca5-27d0437334be", connected: 1, variants: 1 },
  live_wood_tui: { storeProductId: "851e648d-ad5c-4773-951b-2c7444879dc4", connected: 1, variants: 1 },
  live_acrylic_brave: { storeProductId: "1817a2ad-d654-48c5-b454-2f7b957fe083", connected: 1, variants: 1 },
  live_metal_dusk: { storeProductId: "dd276d98-9bab-45ba-ab0a-f8a878d17194", connected: 1, variants: 1 },
};

export const RETIRED_CATALOG_IDS = Object.keys(STALE_ETSY_LISTINGS).filter((id) => !isLiveCatalogId(id));

const STALE_ETSY_IDS = new Set(Object.values(STALE_ETSY_LISTINGS).map((row) => row.id));
const STALE_GELATO_IDS = new Set(Object.values(STALE_GELATO_PRODUCTS).map((row) => row.storeProductId));

/** Kept empty so Catalog never hydrates deleted Etsy listings as live. */
export const ETSY_KNOWN_LISTINGS: Record<string, { id: string; url: string }> = {};

/** Kept empty so Catalog never hydrates deleted Gelato store products as connected. */
export const GELATO_KNOWN_PRODUCTS: Record<string, { storeProductId: string; connected: number; variants: number }> = {};

export function isStaleEtsyListingId(id?: string | null) {
  return Boolean(id && STALE_ETSY_IDS.has(id));
}

export function isStaleGelatoProductId(id?: string | null) {
  return Boolean(id && STALE_GELATO_IDS.has(id));
}

function item(partial: LiveProduct): LiveProduct {
  const etsyId = isStaleEtsyListingId(partial.etsyListingId) ? "" : partial.etsyListingId;
  const gelatoId = isStaleGelatoProductId(partial.gelatoStoreProductId)
    ? undefined
    : partial.gelatoStoreProductId;
  return {
    ...partial,
    description: `${partial.description} ${SHIP_BLURB}`,
    etsyListingId: etsyId,
    etsyUrl: etsyListingUrl(etsyId) || partial.etsyUrl,
    gelatoStoreProductId: gelatoId,
    publishState: etsyId ? partial.publishState : "ready",
    state: etsyId ? partial.state : "inactive",
  };
}

export const LIVE_PRODUCTS: LiveProduct[] = [
  item({
    id: "live_poster",
    etsyListingId: "",
    title: "Fern Arc Poster · A3 Semi-Gloss",
    description:
      "A tall botanical study of a New Zealand fern, printed to order on premium 200 gsm semi-gloss A3 paper. Unframed. Made to order.",
    state: "inactive",
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
    id: "live_quote_breathe",
    etsyListingId: "",
    title: "Breathe You Are Here · A3 Quote Poster",
    description:
      "Landscape A3 semi-gloss print with a botanical border and the line “Breathe. You are here.” A calm reminder for a hallway, studio or bedside. Unframed.",
    quote: "Breathe. You are here.",
    state: "inactive",
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
    id: "live_botanical_kowhai",
    etsyListingId: "",
    title: "Kowhai Bells · 18×24 Botanical Print",
    description:
      "Large 18×24 in painterly study of New Zealand kōwhai bells on cream. Botanical, not abstract. Unframed.",
    state: "inactive",
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
    id: "live_canvas_harbour",
    etsyListingId: "",
    title: "Harbour Morning Canvas · 12×12",
    description:
      "Square slim-wrap canvas of a quiet New Zealand harbour at first light. Scenic, not geometric abstract.",
    state: "inactive",
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
    id: "live_frame_kind",
    etsyListingId: "",
    title: "Home Is a Kind Light · 12×16 Oak Frame",
    description:
      "Natural-wood framed 12×16 print: botanicals and “Home is a kind light.” Ready to hang home décor.",
    quote: "Home is a kind light.",
    state: "inactive",
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
];

export function liveListings(): Listing[] {
  return LIVE_PRODUCTS.map((product) => ({ ...product }));
}

export function liveProductById(id: string) {
  return LIVE_PRODUCTS.find((row) => row.id === id);
}

export function liveCatalogTitles() {
  return LIVE_PRODUCTS.map((product) => product.title);
}

export function resolveLiveSku(sku?: string | null, title?: string | null) {
  return resolveCatalogLine(LIVE_PRODUCTS, sku, title);
}
