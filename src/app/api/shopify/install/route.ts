import { publicOrigin } from "@/lib/origin";
import { normalizeShopDomain } from "@/lib/credentials";

export const dynamic = "force-dynamic";

/** Shopify hits App URL with ?shop= during install. This host must match redirect_uri. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await publicOrigin(request);
  const shop = normalizeShopDomain(url.searchParams.get("shop") || "") || "";
  if (!shop) {
    return new Response("Pressroom Shopify App URL is live.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const next = new URL("/api/shopify/connect", origin);
  next.searchParams.set("shop", shop);
  return Response.redirect(next);
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
