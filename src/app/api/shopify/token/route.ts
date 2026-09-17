import { pingShopify, refreshShopifyClientCredentials } from "@/lib/shopify";
import { connectionStatus } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await refreshShopifyClientCredentials();
    const shopify = await pingShopify();
    return Response.json({
      ok: shopify.ok,
      shopify,
      connections: await connectionStatus(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: (error as Error).message,
        connections: await connectionStatus(),
      },
      { status: 400 },
    );
  }
}
