import { exchangeShopifyCode, pingShopify, registerShopifyWebhooks, restrictShopifyToAunz, syncFernoraCatalogToShopify, verifyShopifyHmac } from "@/lib/shopify";
import { publicOrigin, requestOrigin } from "@/lib/origin";
import { takeOAuthState } from "@/lib/public-origin";
import { pushTunnel } from "@/lib/tunnel";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

function ready() {
  return Response.json({ ok: true, service: "pressroom-shopify-callback" });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = (await publicOrigin(request)) || requestOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const shop = url.searchParams.get("shop");
  const error = url.searchParams.get("error");
  if (!code && !state && !error) return ready();
  const creds = await getCredentials();
  if (creds.shopify?.clientSecret && !verifyShopifyHmac(url.searchParams, creds.shopify.clientSecret)) {
    return Response.redirect(
      `${origin}/connections?shopify=error&reason=${encodeURIComponent("Shopify HMAC did not match. Check the app client secret.")}`,
    );
  }
  if (error) {
    const detail = url.searchParams.get("error_description") || error;
    if (/matching hosts|redirect_uri|application url/i.test(detail)) {
      return Response.redirect(
        `${origin}/connections?shopify=error&reason=${encodeURIComponent(
          "Matching hosts: Application URL is still https://your-app.com. Credentials Redirect URLs do not count. Dev Dashboard → Versions → Create version → set App URL and Allowed redirection URL → Release, then Authorize.",
        )}`,
      );
    }
    return Response.redirect(`${origin}/connections?shopify=denied`);
  }
  const stored = state ? await takeOAuthState(state) : null;
  if (!stored) {
    return Response.redirect(
      `${origin}/connections?shopify=error&reason=${encodeURIComponent("OAuth state expired. Click Authorize Shopify again.")}`,
    );
  }
  if (!code) {
    return Response.redirect(`${origin}/connections?shopify=invalid`);
  }
  try {
    await exchangeShopifyCode(shop || stored.shop || stored.verifier, code);
    try {
      await syncFernoraCatalogToShopify(request);
      await restrictShopifyToAunz();
      await registerShopifyWebhooks(origin);
    } catch {
      /* store may still be frozen; authorization itself succeeded */
    }
    await pingShopify();
    await pushTunnel("shopify", origin).catch(() => undefined);
    return Response.redirect(`${origin}/connections?shopify=connected`);
  } catch (err) {
    const message = encodeURIComponent((err as Error).message);
    return Response.redirect(`${origin}/connections?shopify=error&reason=${message}`);
  }
}
