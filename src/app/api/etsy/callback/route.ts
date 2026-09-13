import { cookies } from "next/headers";
import { exchangeEtsyCode, loadEtsyShop } from "@/lib/etsy";
import { syncLive } from "@/lib/ops";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = `${url.protocol}//${url.host}`;
  if (error) {
    return Response.redirect(`${origin}/connections?etsy=denied`);
  }
  const jar = await cookies();
  const expected = jar.get("etsy_oauth_state")?.value;
  const verifier = jar.get("etsy_oauth_verifier")?.value;
  jar.delete("etsy_oauth_state");
  jar.delete("etsy_oauth_verifier");
  if (!code || !state || !verifier || state !== expected) {
    return Response.redirect(`${origin}/connections?etsy=invalid`);
  }
  try {
    await exchangeEtsyCode(code, verifier);
    await loadEtsyShop();
    await syncLive();
    return Response.redirect(`${origin}/connections?etsy=connected`);
  } catch (err) {
    const message = encodeURIComponent((err as Error).message);
    return Response.redirect(`${origin}/connections?etsy=error&reason=${message}`);
  }
}
