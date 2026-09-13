import { getCredentials } from "@/lib/credentials";
import { ingestShopifyPaidOrder } from "@/lib/ops";
import { verifyShopifyWebhook } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  const creds = await getCredentials();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!creds.shopify?.clientSecret || !verifyShopifyWebhook(raw, hmac, creds.shopify.clientSecret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  try {
    const payload = JSON.parse(raw) as Parameters<typeof ingestShopifyPaidOrder>[0];
    const result = await ingestShopifyPaidOrder(payload);
    return Response.json({ ok: true, orderId: "order" in result ? result.order?.id : undefined });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
