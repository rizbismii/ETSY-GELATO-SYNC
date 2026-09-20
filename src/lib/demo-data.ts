import { liveListings, SHOP_CURRENCY, SHOP_NAME } from "@/lib/live-catalog";
import { getDeletedListingIds } from "@/lib/tombstones";
import type { ShopState } from "@/lib/types";

export function seedShop(): ShopState {
  const deletedListingIds = getDeletedListingIds();
  const deleted = new Set(deletedListingIds);
  return {
    shopName: SHOP_NAME,
    currency: SHOP_CURRENCY,
    listings: liveListings().filter((row) => !deleted.has(row.id)),
    orders: [],
    lastSyncAt: new Date().toISOString(),
    deletedListingIds,
  };
}
