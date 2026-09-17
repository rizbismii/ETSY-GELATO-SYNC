import { getCredentials } from "@/lib/credentials";
import { pingEtsy } from "@/lib/etsy";
import { pingGelato } from "@/lib/gelato";
import { probePublicCallback } from "@/lib/health";
import { isEtsyCallbackHost } from "@/lib/origin";
import {
  readOriginFile,
  recordTunnelPush,
  setPublicOrigin,
  tunnelStatusFor,
  type TunnelPlatform,
  type TunnelRecord,
} from "@/lib/public-origin";
import { pingShopify, registerShopifyWebhooks } from "@/lib/shopify";

async function stamp(
  platform: TunnelPlatform,
  origin: string,
  status: TunnelRecord["status"],
  note: string,
) {
  const record: TunnelRecord = {
    origin,
    status,
    note,
    at: new Date().toISOString(),
  };
  await recordTunnelPush(platform, record);
  return record;
}

export async function tunnelSnapshot(origin: string) {
  const file = await readOriginFile();
  return {
    origin,
    etsy: tunnelStatusFor(file, "etsy", origin),
    shopify: tunnelStatusFor(file, "shopify", origin),
    gelato: tunnelStatusFor(file, "gelato", origin),
  };
}

export async function pushTunnel(platform: TunnelPlatform, origin: string) {
  const cleaned = origin.replace(/\/$/, "");
  if (!isEtsyCallbackHost(cleaned)) {
    return stamp(
      platform,
      cleaned,
      "not_updated",
      "Need a live https://….trycloudflare.com hostname before Pressroom can push.",
    );
  }
  await setPublicOrigin(cleaned);
  const reachable = await probePublicCallback(cleaned);
  if (!reachable) {
    return stamp(
      platform,
      cleaned,
      "not_updated",
      "Tunnel is not reachable. Start npm run etsy-tunnel, then push again.",
    );
  }

  if (platform === "etsy") {
    const creds = await getCredentials();
    if (!creds.etsy?.apiKey) {
      return stamp(platform, cleaned, "not_updated", "Save the Etsy keystring first, then push.");
    }
    try {
      await pingEtsy();
    } catch (error) {
      return stamp(
        platform,
        cleaned,
        "not_updated",
        `Etsy API rejected the saved keys: ${(error as Error).message}`,
      );
    }
    return stamp(
      platform,
      cleaned,
      "updated",
      "Pressroom OAuth now uses this tunnel. Paste Website URL + Callback URL into fernora-etsgelto-app if Authorize with Etsy still fails.",
    );
  }

  if (platform === "shopify") {
    const creds = await getCredentials();
    if (!creds.shopify?.clientId) {
      return stamp(platform, cleaned, "not_updated", "Save the Shopify client ID and secret first.");
    }
    if (!creds.shopify.accessToken) {
      return stamp(
        platform,
        cleaned,
        "not_updated",
        "Copy App URL and Redirect URL from Connections into the Shopify Dev Dashboard (same hostname), save, then Authorize Shopify.",
      );
    }
    try {
      await pingShopify();
      const webhook = await registerShopifyWebhooks(cleaned);
      return stamp(
        platform,
        cleaned,
        "updated",
        webhook.created
          ? `Paid-order webhook now points at ${webhook.address}`
          : `Paid-order webhook already on this tunnel (${webhook.address})`,
      );
    } catch (error) {
      return stamp(platform, cleaned, "not_updated", (error as Error).message);
    }
  }

  const creds = await getCredentials();
  if (!creds.gelatoApiKey) {
    return stamp(platform, cleaned, "not_updated", "Save the Gelato API key first.");
  }
  try {
    await pingGelato();
  } catch (error) {
    return stamp(
      platform,
      cleaned,
      "not_updated",
      `Gelato rejected the saved key: ${(error as Error).message}`,
    );
  }
  return stamp(
    platform,
    cleaned,
    "updated",
    "Gelato print-file URLs will use this tunnel on the next paid order.",
  );
}

export async function pushAllTunnels(origin: string) {
  const etsy = await pushTunnel("etsy", origin);
  const shopify = await pushTunnel("shopify", origin);
  const gelato = await pushTunnel("gelato", origin);
  return { etsy, shopify, gelato };
}
