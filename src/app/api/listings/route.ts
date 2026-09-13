import { connectionStatus, enrichListing, GELATO_CATALOG } from "@/lib/ops";
import {
  destinationEconomics,
  ETSY_CPC_ADS_ENABLED,
  OFFSITE_ADS_RATE,
  recommendedPrice,
} from "@/lib/money";
import { templateByUid } from "@/lib/catalog";
import { etsyListingUrl, liveProductById, SHIP_COUNTRIES } from "@/lib/live-catalog";
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
    const advertised = destinationEconomics(row.price, printCost, shipping, OFFSITE_ADS_RATE);
    return {
      ...row,
      description: meta?.description ?? row.description,
      imageUrl: row.imageUrl || meta?.imageUrl,
      publishState: row.publishState || meta?.publishState || "ready",
      collection: row.collection || meta?.collection || "original",
      quote: row.quote || meta?.quote,
      etsyUrl: etsyListingUrl(row.etsyListingId) || row.etsyUrl,
      shippingCost: shipping,
      net: economics.net,
      margin: economics.margin,
      adsNet: advertised.net,
      adsMargin: advertised.margin,
      adsFee: advertised.ads,
      suggestedPrice: recommendedPrice(row.gelatoUnitCost || printCost, 0, 0.42, OFFSITE_ADS_RATE),
      lanes: (meta?.lanes ?? []).map((lane) => {
        const organic = destinationEconomics(row.price, lane.printCost, lane.shipping);
        const withAds = destinationEconomics(row.price, lane.printCost, lane.shipping, OFFSITE_ADS_RATE);
        return {
          ...lane,
          ...organic,
          ads: withAds.ads,
          adsNet: withAds.net,
          adsMargin: withAds.margin,
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
      mode: "offsite_percent",
      rate: OFFSITE_ADS_RATE,
      cpcEnabled: ETSY_CPC_ADS_ENABLED,
      countries: SHIP_COUNTRIES,
    },
  });
}
