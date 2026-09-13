import { LIVE_PRODUCTS, liveListings } from "@/lib/live-catalog";
import type { ShopState } from "@/lib/types";

const SAMPLE_MARKERS = [
  "lst_sage",
  "lst_hoodie",
  "lst_tote",
  "Hearth & Line",
  "1849203311",
  "1849211101",
];

export function shopLooksLikeSample(shop: ShopState) {
  const blob = `${shop.shopName} ${shop.listings.map((row) => row.id + row.etsyListingId).join(" ")}`;
  return SAMPLE_MARKERS.some((marker) => blob.includes(marker));
}

export function applyLiveCatalog(shop: ShopState) {
  if (shopLooksLikeSample(shop)) {
    shop.shopName = "FERNORATRENDS";
    shop.currency = "NZD";
    shop.listings = liveListings();
    shop.orders = [];
    shop.lastSyncAt = new Date().toISOString();
    return true;
  }
  let changed = false;
  for (const product of LIVE_PRODUCTS) {
    if (!shop.listings.some((row) => row.id === product.id)) {
      shop.listings.push({ ...product });
      changed = true;
    }
  }
  return changed;
}

export function applyHarvestDrop(shop: ShopState) {
  return applyLiveCatalog(shop);
}
