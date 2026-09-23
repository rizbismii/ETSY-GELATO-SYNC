import { patchCredentials } from "@/lib/credentials";
import { connectionStatus } from "@/lib/ops";
import {
  discoverMetaAssets,
  normalizeAdAccountId,
  normalizePixelId,
  pickMetaIds,
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
    instagramUserId?: string;
  };
  const accessToken = body.accessToken?.trim() || "";
  let adAccountId = normalizeAdAccountId(body.adAccountId);
  let pixelId = normalizePixelId(body.pixelId);
  let pageId = body.pageId?.trim() || "";
  let instagramUserId = body.instagramUserId?.trim() || "";
  if (!accessToken && !pixelId) {
    return Response.json({ error: "Paste a Meta access token or Pixel ID." }, { status: 400 });
  }
  const notes: string[] = [];
  if (accessToken) {
    try {
      const picked = pickMetaIds(await discoverMetaAssets(accessToken), {
        adAccountId,
        pageId,
        pixelId,
        instagramUserId,
      });
      adAccountId = picked.adAccountId;
      pageId = picked.pageId;
      pixelId = picked.pixelId;
      instagramUserId = picked.instagramUserId;
      notes.push("Read ad account, Page, Pixel, and Instagram from Graph.");
    } catch (error) {
      notes.push((error as Error).message);
    }
  }
  await patchCredentials({
    meta: { accessToken, adAccountId, pixelId, pageId, instagramUserId },
  });
  let live = false;
  let ping: Awaited<ReturnType<typeof pingMetaAds>> | undefined;
  if (accessToken && adAccountId) {
    try {
      ping = await pingMetaAds();
      live = true;
      if (ping.instagramUserId && ping.instagramUserId !== instagramUserId) {
        instagramUserId = ping.instagramUserId;
        await patchCredentials({
          meta: { accessToken, adAccountId, pixelId, pageId, instagramUserId },
        });
      }
      if (!ping.instagramConnected) {
        notes.push(
          "Instagram is not on the Fernora Page yet. Connect it in Business Suite, then Save again so the campaign can run there.",
        );
      }
    } catch (error) {
      const message = (error as Error).message;
      if (!notes.includes(message)) notes.push(message);
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
