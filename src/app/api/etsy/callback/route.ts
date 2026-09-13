import { exchangeEtsyCode, loadEtsyShop } from "@/lib/etsy";
import { syncLive } from "@/lib/ops";
import { publicOrigin, requestOrigin } from "@/lib/origin";
import { takeOAuthState } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

function ready() {
  return Response.json({ ok: true, service: "pressroom-etsy-callback" });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = (await publicOrigin(request)) || requestOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (!code && !state && !error) {
    return ready();
  }
  if (error) {
    return Response.redirect(`${origin}/connections?etsy=denied`);
  }
  const stored = state ? await takeOAuthState(state) : null;
  if (!stored) {
    return Response.redirect(
      `${origin}/connections?etsy=error&reason=${encodeURIComponent("OAuth state expired. Click Authorize with Etsy again.")}`,
    );
  }
  if (!code) {
    return Response.redirect(`${origin}/connections?etsy=invalid`);
  }
  try {
    await exchangeEtsyCode(code, stored.verifier, stored.redirectUri);
    await loadEtsyShop();
    await syncLive();
    return Response.redirect(`${origin}/connections?etsy=connected`);
  } catch (err) {
    const message = encodeURIComponent((err as Error).message);
    return Response.redirect(`${origin}/connections?etsy=error&reason=${message}`);
  }
}
