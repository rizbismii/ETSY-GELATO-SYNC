import { connectionStatus } from "@/lib/ops";
import { getCredentials, patchCredentials, saveCredentials } from "@/lib/credentials";
import { pingEtsy } from "@/lib/etsy";
import { etsyRedirectUri, isEtsyCallbackHost, publicOrigin } from "@/lib/origin";
import { probePublicCallback, vendorHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [connections, creds, vendors] = await Promise.all([
    connectionStatus(),
    getCredentials(),
    vendorHealth(),
  ]);
  const origin = await publicOrigin(request);
  const callbackUrl = await etsyRedirectUri(request);
  const callbackReachable = await probePublicCallback(origin);
  const callbackIsPublic = isEtsyCallbackHost(origin) && callbackReachable;
  return Response.json({
    connections,
    callbackUrl,
    websiteUrl: origin,
    callbackIsPublic,
    callbackReachable,
    live: {
      ...vendors,
      callbackReachable,
      readyToSell: Boolean(connections.etsy.authorized && vendors.gelato.ok),
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
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    etsyApiKey?: string;
    etsySharedSecret?: string;
    gelatoApiKey?: string;
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
  });
  let etsyLive = false;
  let etsyWarning: string | undefined;
  let applicationId: number | undefined;
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
  return Response.json({
    ok: true,
    etsyLive,
    applicationId,
    warning: etsyWarning,
    connections: await connectionStatus(),
  });
}

export async function DELETE() {
  await saveCredentials({});
  return Response.json({ ok: true, connections: await connectionStatus() });
}
