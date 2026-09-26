import { loadPrintifyProductsForShopify } from "@/lib/printify";
import { syncPrintifyProductsToShopify } from "@/lib/printify-shopify-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const loaded = await loadPrintifyProductsForShopify();
    const synced = await syncPrintifyProductsToShopify(loaded.products);
    const channel = loaded.salesChannel === "etsy" ? "Etsy channel" : `${loaded.salesChannel} channel`;
    return Response.json({
      ok: true,
      shopId: loaded.shopId,
      shopTitle: loaded.shopTitle,
      salesChannel: loaded.salesChannel,
      published: synced.published,
      notes: [
        `Read ${loaded.products.length} products from ${loaded.shopTitle || "Printify"} (${loaded.shopId}, ${channel}). Shopify and fernora.nz are the main store. Etsy stays the secondary channel, with its current listings left in place.`,
        ...synced.notes,
      ],
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
