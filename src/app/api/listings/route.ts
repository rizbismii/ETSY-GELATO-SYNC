import { connectionStatus, enrichListing, GELATO_CATALOG } from "@/lib/ops";
import {
  destinationEconomics,
  ETSY_CPC_ADS_ENABLED,
  ETSY_CPC_WAIT_DAYS_LEFT,
  ETSY_CPC_WAIT_NOTE,
  ETSY_CPC_WAIT_NOTED_ON,
  ETSY_OFFSITE_ADS_ENABLED,
  ETSY_OFFSITE_OPTED_OUT_ON,
  listingAdsRate,
  recommendedPrice,
  TARGET_AFTER_ADS_MARGIN,
} from "@/lib/money";
import { listingHealth } from "@/lib/listing-health";
import { templateByUid } from "@/lib/catalog";
import { etsyListingUrl, liveProductById, SHIP_COUNTRIES } from "@/lib/live-catalog";
import { META_ADS_DAILY_BUDGET_DEFAULT, META_ADS_LANDING_URL } from "@/lib/meta-budget";
import { getShop } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [shop, connections] = await Promise.all([getShop(), connectionStatus()]);
  const listings = shop.listings.map((listing) => {
    const row = enrichListing(listing);
    const meta = liveProductById(row.id);
    const template = templateByUid(row.gelatoProductUid);
    const nz = meta?.lanes.find((lane) => lane.region === "NZ");
    const shipping = nz?.shipping ?? template?.shippingCost ?? 0;
    const printCost = nz?.printCost ?? row.gelatoUnitCost;
    const economics = destinationEconomics(row.price, printCost, shipping);
    const adsRate = listingAdsRate();
    const advertised = destinationEconomics(row.price, printCost, shipping, adsRate);
    const gallery = meta?.gallery || [row.imageUrl, row.printFileUrl].filter(Boolean) as string[];
    return {
      ...row,
      description: meta?.description ?? row.description,
      imageUrl: row.imageUrl || meta?.imageUrl,
      publishState: row.publishState || meta?.publishState || "ready",
      collection: row.collection || meta?.collection || "original",
      quote: row.quote || meta?.quote,
      variants: meta?.variants || row.variants || [],
      gallery,
      listingHealth: listingHealth({ tags: row.tags, gallery }),
      gelatoConnectedCount: row.gelatoConnectedCount,
      gelatoVariantCount: row.gelatoVariantCount,
      etsyUrl: etsyListingUrl(row.etsyListingId) || row.etsyUrl,
      shippingCost: shipping,
      net: economics.net,
      margin: economics.margin,
      adsNet: advertised.net,
      adsMargin: advertised.margin,
      adsFee: advertised.ads,
      suggestedPrice: recommendedPrice(
        row.gelatoUnitCost || printCost,
        shipping,
        TARGET_AFTER_ADS_MARGIN,
        adsRate,
      ),
      lanes: (meta?.lanes ?? []).map((lane) => {
        const organic = destinationEconomics(row.price, lane.printCost, lane.shipping);
        return {
          ...lane,
          ...organic,
        };
      }),
    };
  });
  return Response.json({
    listings,
    catalog: GELATO_CATALOG,
    shopName: connections.etsy.shopName || shop.shopName,
    currency: shop.currency || "NZD",
    etsyAuthorized: connections.etsy.authorized,
    gelatoLive: connections.gelato.configured,
    ads: {
      mode: "meta_daily_cap",
      rate: listingAdsRate(),
      leftoverOffsiteRate: ETSY_OFFSITE_ADS_ENABLED ? undefined : 0.15,
      dailyBudget: META_ADS_DAILY_BUDGET_DEFAULT,
      landingUrl: META_ADS_LANDING_URL,
      targetAfterAds: TARGET_AFTER_ADS_MARGIN,
      offsiteEnabled: ETSY_OFFSITE_ADS_ENABLED,
      offsiteOptedOutOn: ETSY_OFFSITE_OPTED_OUT_ON,
      cpcEnabled: ETSY_CPC_ADS_ENABLED,
      cpcWaitDaysLeft: ETSY_CPC_WAIT_DAYS_LEFT,
      cpcWaitNotedOn: ETSY_CPC_WAIT_NOTED_ON,
      cpcWaitNote: ETSY_CPC_WAIT_NOTE,
      countries: SHIP_COUNTRIES,
    },
  });
}
