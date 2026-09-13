import { cookies } from "next/headers";
import { exchangeEtsyCode, loadEtsyShop } from "@/lib/etsy";
import { syncLive } from "@/lib/ops";
import { publicOrigin } from "@/lib/origin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    return Response.redirect(`${origin}/connections?etsy=denied`);
  }
  const jar = await cookies();
  const expected = jar.get("etsy_oauth_state")?.value;
  const verifier = jar.get("etsy_oauth_verifier")?.value;
  const redirectUri = jar.get("etsy_oauth_redirect")?.value;
  jar.delete("etsy_oauth_state");
  jar.delete("etsy_oauth_verifier");
  jar.delete("etsy_oauth_redirect");
  if (!verifier || !expected) {
    return Response.redirect(
      `${origin}/connections?etsy=error&reason=${encodeURIComponent("OAuth cookies were missing. Register this callback URL on the Etsy app, then authorize again from this same address.")}`,
    );
  }
  if (!code || !state || state !== expected || !redirectUri) {
    return Response.redirect(`${origin}/connections?etsy=invalid`);
  }
  try {
    await exchangeEtsyCode(code, verifier, redirectUri);
    await loadEtsyShop();
    await syncLive();
    return Response.redirect(`${origin}/connections?etsy=connected`);
  } catch (err) {
    const message = encodeURIComponent((err as Error).message);
    return Response.redirect(`${origin}/connections?etsy=error&reason=${message}`);
  }
}
