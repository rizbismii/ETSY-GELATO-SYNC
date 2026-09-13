import { connectionStatus } from "@/lib/ops";
import { getCredentials, patchCredentials, saveCredentials } from "@/lib/credentials";
import { pingEtsy } from "@/lib/etsy";
import { etsyRedirectUri, isEtsyCallbackHost, publicOrigin, shopifyRedirectUri } from "@/lib/origin";
import { probePublicCallback, vendorHealth } from "@/lib/health";
import { pingShopify, probeShopifyStore } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [connections, creds, vendors] = await Promise.all([
    connectionStatus(),
    getCredentials(),
    vendorHealth(),
  ]);
  const origin = await publicOrigin(request);
  const callbackUrl = await etsyRedirectUri(request);
  const shopifyCallbackUrl = await shopifyRedirectUri(request);
  const callbackReachable = await probePublicCallback(origin);
  const callbackIsPublic = isEtsyCallbackHost(origin) && callbackReachable;
  const shopifyShop = creds.shopify?.shop || "fernora.myshopify.com";
  const storefrontStatus = await probeShopifyStore(shopifyShop);
  return Response.json({
    connections,
    callbackUrl,
    websiteUrl: origin,
    shopifyCallbackUrl,
    shopUrl: `${origin.replace(/\/$/, "")}/shop`,
    callbackIsPublic,
    callbackReachable,
    live: {
      ...vendors,
      callbackReachable,
      readyToSell: Boolean(
        (connections.etsy.authorized || connections.shopify.authorized) && vendors.gelato.ok,
      ),
    },
    etsy: {
      apiKeySet: Boolean(creds.etsy?.apiKey),
      sharedSecretSet: Boolean(creds.etsy?.sharedSecret),
      shopName: creds.etsy?.shopName,
      shopId: creds.etsy?.shopId,
    },
    gelato: {
      apiKeySet: Boolean(creds.gelatoApiKey),
    },
    shopify: {
      clientIdSet: Boolean(creds.shopify?.clientId),
      clientSecretSet: Boolean(creds.shopify?.clientSecret),
      shop: shopifyShop,
      authorized: Boolean(creds.shopify?.accessToken),
      storefrontStatus,
      scope: creds.shopify?.scope,
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    etsyApiKey?: string;
    etsySharedSecret?: string;
    gelatoApiKey?: string;
    shopifyClientId?: string;
    shopifyClientSecret?: string;
    shopifyShop?: string;
  };
  const current = await getCredentials();
  await patchCredentials({
    gelatoApiKey: body.gelatoApiKey?.trim() || current.gelatoApiKey,
    etsy: {
      apiKey: body.etsyApiKey?.trim() || current.etsy?.apiKey || "",
      sharedSecret: body.etsySharedSecret?.trim() || current.etsy?.sharedSecret || "",
      accessToken: current.etsy?.accessToken,
      refreshToken: current.etsy?.refreshToken,
      expiresAt: current.etsy?.expiresAt,
      userId: current.etsy?.userId,
      shopId: current.etsy?.shopId,
      shopName: current.etsy?.shopName,
    },
    shopify: {
      clientId: body.shopifyClientId?.trim() || current.shopify?.clientId || "",
      clientSecret: body.shopifyClientSecret?.trim() || current.shopify?.clientSecret || "",
      shop: body.shopifyShop?.trim() || current.shopify?.shop || "fernora.myshopify.com",
      accessToken: current.shopify?.accessToken,
      scope: current.shopify?.scope,
      expiresAt: current.shopify?.expiresAt,
      storefrontStatus: current.shopify?.storefrontStatus,
    },
  });
  let etsyLive = false;
  let etsyWarning: string | undefined;
  let applicationId: number | undefined;
  let shopifyPing: Awaited<ReturnType<typeof pingShopify>> | undefined;
  const next = await getCredentials();
  if (next.etsy?.apiKey && next.etsy.sharedSecret) {
    try {
      const ping = await pingEtsy();
      etsyLive = true;
      applicationId = ping.application_id;
    } catch (error) {
      etsyWarning = (error as Error).message;
    }
  }
  if (next.shopify?.clientId && next.shopify.clientSecret) {
    shopifyPing = await pingShopify();
  }
  return Response.json({
    ok: true,
    etsyLive,
    applicationId,
    warning: etsyWarning,
    shopify: shopifyPing,
    connections: await connectionStatus(),
  });
}

export async function DELETE() {
  await saveCredentials({});
  return Response.json({ ok: true, connections: await connectionStatus() });
}
