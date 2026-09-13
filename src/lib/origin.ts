export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

export function etsyRedirectUri(request?: Request) {
  if (process.env.ETSY_REDIRECT_URI) return process.env.ETSY_REDIRECT_URI;
  if (request) return `${publicOrigin(request)}/api/etsy/callback`;
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:43127"}/api/etsy/callback`;
}

export function oauthCookieOptions(request: Request) {
  const secure = publicOrigin(request).startsWith("https://");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    secure,
  };
}
