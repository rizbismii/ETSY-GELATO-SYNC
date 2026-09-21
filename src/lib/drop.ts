import {
  LIVE_PRODUCTS,
  RETIRED_CATALOG_IDS,
  isStaleEtsyListingId,
  isStaleGelatoProductId,
  liveListings,
  SHOP_CURRENCY,
  SHOP_NAME,
} from "@/lib/live-catalog";
import { getDeletedListingIds, writeDeletedListingIds } from "@/lib/tombstones";
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

function catalogDeletedIds(shop: ShopState) {
  return new Set([
    ...(shop.deletedListingIds || []),
    ...getDeletedListingIds(),
    ...RETIRED_CATALOG_IDS,
  ]);
}

function stripStaleMarketplaceIds(listing: Listing): Listing {
  const etsyListingId = isStaleEtsyListingId(listing.etsyListingId) ? "" : listing.etsyListingId;
  const gelatoStoreProductId = isStaleGelatoProductId(listing.gelatoStoreProductId)
    ? undefined
    : listing.gelatoStoreProductId;
  const live = Boolean(etsyListingId) && listing.state === "active";
  return {
    ...listing,
    etsyListingId,
    etsyUrl: etsyListingId ? listing.etsyUrl : undefined,
    gelatoStoreProductId,
    gelatoConnectedCount: gelatoStoreProductId ? listing.gelatoConnectedCount : undefined,
    gelatoVariantCount: gelatoStoreProductId ? listing.gelatoVariantCount : undefined,
    publishState: live ? "live" : listing.publishState === "live" ? "ready" : listing.publishState,
    state: live ? "active" : "inactive",
  };
}

export function applyLiveCatalog(shop: ShopState) {
  const deleted = catalogDeletedIds(shop);
  if (shopLooksLikeSample(shop)) {
    shop.shopName = "FERNORATRENDS";
    shop.currency = "NZD";
    shop.listings = liveListings().filter((row) => !deleted.has(row.id)).map(stripStaleMarketplaceIds);
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
      const etsyListingId = isStaleEtsyListingId(match.etsyListingId || product.etsyListingId)
        ? ""
        : match.etsyListingId || product.etsyListingId;
      const gelatoStoreProductId = isStaleGelatoProductId(
        match.gelatoStoreProductId || product.gelatoStoreProductId,
      )
        ? undefined
        : match.gelatoStoreProductId || product.gelatoStoreProductId;
      const live = Boolean(etsyListingId) && match.state === "active";
      next.push({
        ...product,
        ...match,
        id: product.id,
        title: product.title,
        price: product.price,
        currency: product.currency,
        tags: product.tags,
        imageUrl: product.imageUrl,
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
        gallery: product.gallery,
        etsyListingId,
        etsyUrl: etsyListingId ? match.etsyUrl || product.etsyUrl : undefined,
        gelatoStoreProductId,
        gelatoConnectedCount: gelatoStoreProductId
          ? match.gelatoConnectedCount ?? product.gelatoConnectedCount
          : undefined,
        gelatoVariantCount: gelatoStoreProductId
          ? match.gelatoVariantCount ?? product.gelatoVariantCount
          : undefined,
        taxonomyId: match.taxonomyId || product.taxonomyId,
        shippingProfileId: match.shippingProfileId || product.shippingProfileId,
        returnPolicyId: match.returnPolicyId || product.returnPolicyId,
        publishState: live ? "live" : "ready",
        state: live ? "active" : "inactive",
      });
    } else {
      next.push(stripStaleMarketplaceIds({ ...product }));
    }
  }
  for (const row of shop.listings) {
    if (used.has(row.id) || row.id.startsWith("live_")) continue;
    if (deleted.has(row.id) || (row.etsyListingId && deleted.has(row.etsyListingId))) continue;
    if (LIVE_PRODUCTS.some((product) => product.title === row.title)) continue;
    if (isStaleEtsyListingId(row.etsyListingId) || isStaleGelatoProductId(row.gelatoStoreProductId)) continue;
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

/** Keep the five live products; leave retired catalog IDs tombstoned. */
export function restoreLiveCatalogInShop(shop: ShopState) {
  const keep = new Set(LIVE_PRODUCTS.map((row) => row.id));
  const nextDeleted = [
    ...new Set([
      ...(shop.deletedListingIds || []).filter((id) => !keep.has(id)),
      ...getDeletedListingIds().filter((id) => !keep.has(id)),
      ...RETIRED_CATALOG_IDS,
    ]),
  ];
  shop.deletedListingIds = nextDeleted;
  writeDeletedListingIds(nextDeleted);
  return applyLiveCatalog(shop);
}
