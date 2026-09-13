import { publicOrigin } from "@/lib/origin";
import { pingShopify, registerShopifyWebhooks, restrictShopifyToAunz, syncFernoraCatalogToShopify } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const origin = await publicOrigin(request);
    const catalog = await syncFernoraCatalogToShopify(request);
    const shipping = await restrictShopifyToAunz();
    let webhook: { created: boolean; address: string } | undefined;
    try {
      webhook = await registerShopifyWebhooks(origin);
    } catch (error) {
      catalog.notes.push(`Webhook: ${(error as Error).message}`);
    }
    const ping = await pingShopify();
    return Response.json({
      ok: true,
      ping,
      notes: [...catalog.notes, ...shipping],
      products: Object.keys(catalog.catalog).length,
      webhook,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
