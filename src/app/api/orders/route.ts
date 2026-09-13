import { enrichOrder, profitFor } from "@/lib/ops";
import { getShop } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const shop = await getShop();
  const orders = shop.orders
    .map((order) => {
      const ready = enrichOrder(order, shop.listings);
      return { ...ready, profit: profitFor(ready, shop.listings) };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ orders, shopName: shop.shopName });
}
