import { connectionStatus } from "@/lib/ops";
import { getCredentials, patchCredentials, saveCredentials } from "@/lib/credentials";
import { pingEtsy } from "@/lib/etsy";
import { etsyRedirectUri, isEtsyCallbackHost, publicOrigin, shopifyRedirectUri } from "@/lib/origin";
import { probePublicCallback, vendorHealth } from "@/lib/health";
import { pingShopify, probeShopifyStore } from "@/lib/shopify";
import { FERNORA_SHOPIFY_SHOP } from "@/lib/shopify-shop";
import { tunnelSnapshot } from "@/lib/tunnel";

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
  const shopifyShop = creds.shopify?.shop || FERNORA_SHOPIFY_SHOP;
  const storefrontStatus = await probeShopifyStore(shopifyShop);
  const tunnel = await tunnelSnapshot(origin);
  return Response.json({
    connections,
    callbackUrl,
    websiteUrl: origin,
    shopifyCallbackUrl,
    shopifyAppUrl: origin,
    shopUrl: `${origin.replace(/\/$/, "")}/shop`,
    callbackIsPublic,
    callbackReachable,
    tunnel,
    live: {
      ...vendors,
      callbackReachable,
      readyToSell: Boolean(
        (connections.etsy.authorized || connections.shopify.authorized) &&
          (vendors.printify.ok || vendors.gelato.ok),
      ),
    },
    etsy: {
      apiKeySet: Boolean(creds.etsy?.apiKey),
      sharedSecretSet: Boolean(creds.etsy?.sharedSecret),
      apiKey: creds.etsy?.apiKey || "",
      sharedSecret: creds.etsy?.sharedSecret || "",
      shopName: creds.etsy?.shopName,
      shopId: creds.etsy?.shopId,
    },
    gelato: {
      apiKeySet: Boolean(creds.gelatoApiKey),
      apiKey: creds.gelatoApiKey || "",
    },
    shopify: {
      clientIdSet: Boolean(creds.shopify?.clientId),
      clientSecretSet: Boolean(creds.shopify?.clientSecret),
      clientId: creds.shopify?.clientId || "",
      clientSecret: creds.shopify?.clientSecret || "",
      shop: shopifyShop,
      authorized: Boolean(creds.shopify?.accessToken),
      storefrontStatus,
      scope: creds.shopify?.scope,
      accessTokenSet: Boolean(creds.shopify?.accessToken),
      accessToken: creds.shopify?.accessToken || "",
    },
    meta: {
      accessTokenSet: Boolean(creds.meta?.accessToken),
      adAccountId: creds.meta?.adAccountId || "",
      pixelId: creds.meta?.pixelId || "",
      pageId: creds.meta?.pageId || "",
    },
    printify: {
      apiTokenSet: Boolean(creds.printify?.apiToken),
      apiToken: creds.printify?.apiToken || "",
      shopId: creds.printify?.shopId || "",
      shopTitle: creds.printify?.shopTitle || "",
      gpsrStatus: creds.printify?.gpsrStatus || "",
      salesChannel: creds.printify?.salesChannel || "",
      fullyConnected: Boolean(creds.printify?.fullyConnected),
      shops: creds.printify?.shops || [],
    },
    shopifyInstallUrl: "https://dev.shopify.com/dashboard",
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
    shopifyAccessToken?: string;
  };
  await patchCredentials({
    gelatoApiKey: body.gelatoApiKey,
    etsy: {
      apiKey: body.etsyApiKey?.trim() || "",
      sharedSecret: body.etsySharedSecret?.trim() || "",
    },
    shopify: {
      clientId: body.shopifyClientId?.trim() || "",
      clientSecret: body.shopifyClientSecret?.trim() || "",
      shop: body.shopifyShop?.trim() || FERNORA_SHOPIFY_SHOP,
      ...(body.shopifyAccessToken?.trim()
        ? { accessToken: body.shopifyAccessToken.trim() }
        : {}),
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
  if (next.shopify?.accessToken || (next.shopify?.clientId && next.shopify.clientSecret)) {
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
  const current = await getCredentials();
  await saveCredentials({
    gelatoApiKey: current.gelatoApiKey,
    etsy: current.etsy
      ? { apiKey: current.etsy.apiKey, sharedSecret: current.etsy.sharedSecret }
      : undefined,
    shopify: current.shopify
      ? {
          clientId: current.shopify.clientId,
          clientSecret: current.shopify.clientSecret,
          shop: current.shopify.shop,
        }
      : undefined,
    meta: current.meta,
    printify: current.printify,
  });
  return Response.json({ ok: true, connections: await connectionStatus() });
}
