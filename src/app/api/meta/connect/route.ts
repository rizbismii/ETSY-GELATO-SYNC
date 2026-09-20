import { patchCredentials } from "@/lib/credentials";
import { connectionStatus } from "@/lib/ops";
import {
  normalizeAdAccountId,
  normalizePixelId,
  pingMetaAds,
} from "@/lib/meta-ads";
import { installFernoraMetaPixel } from "@/lib/shopify-horizon";
import { shopifyGraphql } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    accessToken?: string;
    adAccountId?: string;
    pixelId?: string;
    pageId?: string;
  };
  const accessToken = body.accessToken?.trim() || "";
  const adAccountId = normalizeAdAccountId(body.adAccountId);
  const pixelId = normalizePixelId(body.pixelId);
  const pageId = body.pageId?.trim() || "";
  if (!accessToken && !pixelId) {
    return Response.json({ error: "Paste a Meta access token or Pixel ID." }, { status: 400 });
  }
  await patchCredentials({
    meta: { accessToken, adAccountId, pixelId, pageId },
  });
  const notes: string[] = [];
  let live = false;
  let ping: Awaited<ReturnType<typeof pingMetaAds>> | undefined;
  if (accessToken && adAccountId) {
    try {
      ping = await pingMetaAds();
      live = true;
    } catch (error) {
      notes.push((error as Error).message);
    }
  }
  if (pixelId) {
    try {
      const theme = await shopifyGraphql<{ themes: { nodes: Array<{ id: string; role: string }> } }>(
        `{ themes(first: 10) { nodes { id role } } }`,
      );
      const themeId = theme.themes.nodes.find((row) => row.role === "MAIN")?.id;
      if (themeId) notes.push(...(await installFernoraMetaPixel(themeId)));
    } catch (error) {
      notes.push(`Pixel on Shopify: ${(error as Error).message}`);
    }
  }
  return Response.json({
    ok: true,
    live,
    ping,
    notes,
    connections: await connectionStatus(),
  });
}
