import { publicOrigin } from "@/lib/origin";
import {
  pingShopify,
  registerShopifyWebhooks,
  configureShopifyGelatoShipping,
  syncFernoraCatalogToShopify,
  syncShopifyPolicies,
} from "@/lib/shopify";
import { fillShopifyCollections, prepareShopifyCustomerStore } from "@/lib/shopify-storefront";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const origin = await publicOrigin(request);
    const catalogOnly = new URL(request.url).searchParams.get("catalog") === "1";
    const catalog = await syncFernoraCatalogToShopify(request);
    if (catalogOnly) {
      const collections = await fillShopifyCollections().catch((error: Error) => [
        `Collections: ${error.message}`,
      ]);
      const ping = await pingShopify();
      return Response.json({
        ok: true,
        ping,
        notes: [...catalog.notes, ...collections],
        products: Object.keys(catalog.catalog).length,
      });
    }
    const shipping = await configureShopifyGelatoShipping();
    const storefront = await prepareShopifyCustomerStore(origin).catch((error: Error) => [
      `Storefront: ${error.message}`,
    ]);
    const policies = await syncShopifyPolicies().catch((error: Error) => [`Policies: ${error.message}`]);
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
      notes: [...catalog.notes, ...shipping, ...storefront, ...policies],
      products: Object.keys(catalog.catalog).length,
      webhook,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
