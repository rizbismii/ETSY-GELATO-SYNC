import { connectionStatus, enrichListing, GELATO_CATALOG } from "@/lib/ops";
import { destinationEconomics, recommendedPrice } from "@/lib/money";
import { templateByUid } from "@/lib/catalog";
import { liveProductById } from "@/lib/live-catalog";
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
    return {
      ...row,
      description: meta?.description ?? row.description,
      imageUrl: row.imageUrl || meta?.imageUrl,
      publishState: row.publishState || meta?.publishState || "ready",
      etsyUrl: row.etsyUrl,
      shippingCost: shipping,
      net: economics.net,
      margin: economics.margin,
      suggestedPrice: recommendedPrice(row.gelatoUnitCost || printCost, 0),
      lanes: (meta?.lanes ?? []).map((lane) => ({
        ...lane,
        ...destinationEconomics(row.price, lane.printCost, lane.shipping),
      })),
    };
  });
  return Response.json({
    listings,
    catalog: GELATO_CATALOG,
    shopName: connections.etsy.shopName || shop.shopName,
    currency: shop.currency || "NZD",
    etsyAuthorized: connections.etsy.authorized,
    gelatoLive: connections.gelato.configured,
  });
}
