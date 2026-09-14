import { LIVE_PRODUCTS, liveListings, SHOP_CURRENCY, SHOP_NAME } from "@/lib/live-catalog";
import { getDeletedListingIds } from "@/lib/tombstones";
import type { Listing, ShopState } from "@/lib/types";

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
  const deleted = new Set([...(shop.deletedListingIds || []), ...getDeletedListingIds()]);
  if (shopLooksLikeSample(shop)) {
    shop.shopName = "FERNORATRENDS";
    shop.currency = "NZD";
    shop.listings = liveListings().filter((row) => !deleted.has(row.id));
    shop.orders = [];
    shop.lastSyncAt = new Date().toISOString();
    shop.deletedListingIds = [...deleted];
    return true;
  }
  const used = new Set<string>();
  const next: Listing[] = [];
  for (const product of LIVE_PRODUCTS) {
    if (deleted.has(product.id)) continue;
    const match = shop.listings.find(
      (row) =>
        !used.has(row.id) &&
        (row.id === product.id ||
          row.title === product.title ||
          (row.etsyListingId && row.etsyListingId === product.etsyListingId)),
    );
    if (match) {
      used.add(match.id);
      next.push({
        ...product,
        ...match,
        id: product.id,
        title: product.title,
        price: product.price,
        currency: product.currency,
        gelatoProductUid: product.gelatoProductUid,
        gelatoProductName: product.gelatoProductName,
        printFileUrl: product.printFileUrl || match.printFileUrl,
        gelatoUnitCost: product.gelatoUnitCost,
        category: product.category,
        drop: product.drop,
        collection: product.collection,
        quote: product.quote,
        description: product.description,
        variants: product.variants,
        taxonomyId: match.taxonomyId || product.taxonomyId,
        shippingProfileId: match.shippingProfileId || product.shippingProfileId,
        returnPolicyId: match.returnPolicyId || product.returnPolicyId,
        publishState:
          match.state === "active" ? "live" : match.publishState || product.publishState,
      });
    } else {
      next.push({ ...product });
    }
  }
  for (const row of shop.listings) {
    if (used.has(row.id) || row.id.startsWith("live_")) continue;
    if (deleted.has(row.id) || (row.etsyListingId && deleted.has(row.etsyListingId))) continue;
    if (LIVE_PRODUCTS.some((product) => product.title === row.title)) continue;
    next.push(row);
  }
  const nextDeleted = [...deleted];
  const changed =
    JSON.stringify(shop.listings) !== JSON.stringify(next) ||
    JSON.stringify(shop.deletedListingIds || []) !== JSON.stringify(nextDeleted);
  shop.shopName = shop.shopName || SHOP_NAME;
  shop.currency = shop.currency || SHOP_CURRENCY;
  shop.listings = next;
  shop.deletedListingIds = nextDeleted;
  return changed;
}

export function applyHarvestDrop(shop: ShopState) {
  return applyLiveCatalog(shop);
}
