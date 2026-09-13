import { cookies } from "next/headers";
import { createPkce, etsyAuthorizeUrl } from "@/lib/etsy";
import { getCredentials } from "@/lib/credentials";

export async function GET() {
  const creds = await getCredentials();
  if (!creds.etsy?.apiKey) {
    return Response.json(
      { error: "Save your Etsy keystring and shared secret first." },
      { status: 400 },
    );
  }
  const pkce = createPkce();
  const jar = await cookies();
  jar.set("etsy_oauth_state", pkce.state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  jar.set("etsy_oauth_verifier", pkce.verifier, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return Response.redirect(etsyAuthorizeUrl(creds.etsy.apiKey, pkce.challenge, pkce.state));
}
