import { resetShop } from "@/lib/store";

export async function POST() {
  const shop = await resetShop();
  return Response.json({ ok: true, shopName: shop.shopName });
}
