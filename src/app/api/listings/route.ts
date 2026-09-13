import { enrichListing, GELATO_CATALOG } from "@/lib/ops";
import { listingNet, recommendedPrice } from "@/lib/money";
import { templateByUid } from "@/lib/catalog";
import { getShop } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const shop = await getShop();
  const listings = shop.listings.map((listing) => {
    const row = enrichListing(listing);
    const template = templateByUid(row.gelatoProductUid);
    const shipping = template?.shippingCost ?? 4.2;
    const net = listingNet(row.price, row.gelatoUnitCost, shipping);
    return {
      ...row,
      shippingCost: shipping,
      net,
      suggestedPrice: recommendedPrice(row.gelatoUnitCost || 8.4, shipping),
    };
  });
  return Response.json({ listings, catalog: GELATO_CATALOG, shopName: shop.shopName });
}
