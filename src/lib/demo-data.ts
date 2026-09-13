import { liveListings, SHOP_CURRENCY, SHOP_NAME } from "@/lib/live-catalog";
import type { ShopState } from "@/lib/types";

export function seedShop(): ShopState {
  return {
    shopName: SHOP_NAME,
    currency: SHOP_CURRENCY,
    listings: liveListings(),
    orders: [],
    lastSyncAt: new Date().toISOString(),
  };
}
