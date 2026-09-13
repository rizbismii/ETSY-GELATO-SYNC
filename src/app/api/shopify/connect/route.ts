import { randomBytes } from "node:crypto";
import { getCredentials } from "@/lib/credentials";
import { publicOrigin, shopifyRedirectUri } from "@/lib/origin";
import { saveOAuthState } from "@/lib/public-origin";
import { shopifyAuthorizeUrl } from "@/lib/shopify";

export async function GET(request: Request) {
  const creds = await getCredentials();
  const origin = await publicOrigin(request);
  if (!creds.shopify?.clientId || !creds.shopify.clientSecret) {
    return Response.redirect(
      `${origin}/connections?shopify=error&reason=${encodeURIComponent("Save the Shopify client ID and secret first.")}`,
    );
  }
  const shop = creds.shopify.shop || "fernora.myshopify.com";
  const redirectUri = await shopifyRedirectUri(request);
  const state = randomBytes(16).toString("hex");
  await saveOAuthState(state, {
    verifier: shop,
    redirectUri,
    createdAt: Date.now(),
    shop,
  });
  return Response.redirect(shopifyAuthorizeUrl(shop, creds.shopify.clientId, redirectUri, state));
}
