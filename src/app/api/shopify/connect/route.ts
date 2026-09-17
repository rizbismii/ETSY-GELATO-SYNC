import { randomBytes } from "node:crypto";
import { getCredentials } from "@/lib/credentials";
import { isEtsyCallbackHost, publicOrigin, shopifyRedirectUri } from "@/lib/origin";
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
  if (!isEtsyCallbackHost(origin)) {
    return Response.redirect(
      `${origin}/connections?shopify=error&reason=${encodeURIComponent(
        "Shopify OAuth needs the live public desk URL. Open Connections on the trycloudflare hostname, paste App URL and Redirect URL into the Dev Dashboard, then Authorize.",
      )}`,
    );
  }
  const shop = creds.shopify.shop || "fernora.myshopify.com";
  const redirectUri = await shopifyRedirectUri(request);
  try {
    if (new URL(redirectUri).origin !== new URL(origin).origin) {
      return Response.redirect(
        `${origin}/connections?shopify=error&reason=${encodeURIComponent(
          "Shopify App URL and Redirect URL must use this desk’s hostname. Copy both from Connections into the Dev Dashboard, save, then Authorize again.",
        )}`,
      );
    }
  } catch {
    /* origin already public */
  }
  const state = randomBytes(16).toString("hex");
  await saveOAuthState(state, {
    verifier: shop,
    redirectUri,
    createdAt: Date.now(),
    shop,
  });
  return Response.redirect(shopifyAuthorizeUrl(shop, creds.shopify.clientId, redirectUri, state));
}
