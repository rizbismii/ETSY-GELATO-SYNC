import { getPublicOrigin, setPublicOrigin } from "@/lib/public-origin";

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

/** Etsy rejects IPs and localhost; the callback must be https on a public hostname. */
export function isEtsyCallbackHost(origin: string) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (!host.includes(".")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function publicOrigin(request?: Request) {
  if (process.env.ETSY_PUBLIC_ORIGIN) {
    return process.env.ETSY_PUBLIC_ORIGIN.replace(/\/$/, "");
  }

  if (request) {
    const fromRequest = requestOrigin(request);
    if (isEtsyCallbackHost(fromRequest)) {
      const stored = await getPublicOrigin();
      if (stored !== fromRequest) await setPublicOrigin(fromRequest);
      return fromRequest;
    }
  }

  const stored = await getPublicOrigin();
  if (stored) return stored;

  if (process.env.ETSY_REDIRECT_URI) {
    return new URL(process.env.ETSY_REDIRECT_URI).origin;
  }
  if (request) return requestOrigin(request);
  return process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:43127";
}

export async function etsyRedirectUri(request?: Request) {
  if (process.env.ETSY_REDIRECT_URI) return process.env.ETSY_REDIRECT_URI;
  return `${await publicOrigin(request)}/api/etsy/callback`;
}

export async function shopifyRedirectUri(request?: Request) {
  if (process.env.SHOPIFY_REDIRECT_URI) return process.env.SHOPIFY_REDIRECT_URI;
  return `${await publicOrigin(request)}/api/shopify/callback`;
}

export async function absoluteAssetUrl(assetPath: string, request?: Request) {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) return assetPath;
  const origin = await publicOrigin(request);
  return `${origin}${assetPath.startsWith("/") ? assetPath : `/${assetPath}`}`;
}
