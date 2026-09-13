import { createPkce, etsyAuthorizeUrl } from "@/lib/etsy";
import { getCredentials } from "@/lib/credentials";
import { etsyRedirectUri, publicOrigin } from "@/lib/origin";
import { saveOAuthState } from "@/lib/public-origin";

export async function GET(request: Request) {
  const creds = await getCredentials();
  const origin = await publicOrigin(request);
  if (!creds.etsy?.apiKey || !creds.etsy.sharedSecret) {
    return Response.redirect(
      `${origin}/connections?etsy=error&reason=${encodeURIComponent("Save the Etsy keystring and shared secret first.")}`,
    );
  }
  const redirectUri = await etsyRedirectUri(request);
  const pkce = createPkce();
  await saveOAuthState(pkce.state, {
    verifier: pkce.verifier,
    redirectUri,
    createdAt: Date.now(),
  });
  return Response.redirect(
    etsyAuthorizeUrl(creds.etsy.apiKey, pkce.challenge, pkce.state, redirectUri),
  );
}
