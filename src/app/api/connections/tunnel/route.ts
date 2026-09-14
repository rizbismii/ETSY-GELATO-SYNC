import { publicOrigin } from "@/lib/origin";
import { pushAllTunnels, pushTunnel, tunnelSnapshot } from "@/lib/tunnel";
import type { TunnelPlatform } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

const PLATFORMS: TunnelPlatform[] = ["etsy", "shopify", "gelato"];

export async function POST(request: Request) {
  const origin = await publicOrigin(request);
  const body = (await request.json().catch(() => ({}))) as { platform?: string };
  const platform = body.platform;
  try {
    if (platform === "all" || !platform) {
      const result = await pushAllTunnels(origin);
      return Response.json({ ok: true, origin, tunnel: result });
    }
    if (!PLATFORMS.includes(platform as TunnelPlatform)) {
      return Response.json({ error: "Unknown platform" }, { status: 400 });
    }
    const row = await pushTunnel(platform as TunnelPlatform, origin);
    return Response.json({
      ok: true,
      origin,
      tunnel: { ...(await tunnelSnapshot(origin)), [platform]: row },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
