import { cookies } from "next/headers";
import { createPkce, etsyAuthorizeUrl } from "@/lib/etsy";
import { getCredentials } from "@/lib/credentials";
import { etsyRedirectUri, oauthCookieOptions, publicOrigin } from "@/lib/origin";

export async function GET(request: Request) {
  const creds = await getCredentials();
  const origin = publicOrigin(request);
  if (!creds.etsy?.apiKey || !creds.etsy.sharedSecret) {
    return Response.redirect(`${origin}/connections?etsy=error&reason=${encodeURIComponent("Save the Etsy keystring and shared secret first.")}`);
  }
  const redirectUri = etsyRedirectUri(request);
  const pkce = createPkce();
  const jar = await cookies();
  const cookie = oauthCookieOptions(request);
  jar.set("etsy_oauth_state", pkce.state, cookie);
  jar.set("etsy_oauth_verifier", pkce.verifier, cookie);
  jar.set("etsy_oauth_redirect", redirectUri, cookie);
  return Response.redirect(etsyAuthorizeUrl(creds.etsy.apiKey, pkce.challenge, pkce.state, redirectUri));
}
