import { patchCredentials } from "@/lib/credentials";
import { connectionStatus } from "@/lib/ops";
import { applyPrintifyGpsr, pingPrintify, usablePrintifyToken } from "@/lib/printify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { apiToken?: string; shopId?: string };
  const apiToken = usablePrintifyToken(body.apiToken);
  if (!apiToken) {
    return Response.json(
      { error: "Paste a Printify personal access token from printify.com/app/account/api." },
      { status: 400 },
    );
  }
  const requestedShop = body.shopId?.replace(/\D/g, "") || "";
  try {
    const ping = await pingPrintify(apiToken);
    const shopId = requestedShop || (ping.shopId ? String(ping.shopId) : "");
    const shopTitle =
      ping.shops.find((shop) => String(shop.id) === shopId)?.title || ping.shopTitle || "";
    await patchCredentials({
      printify: { apiToken, shopId, shopTitle },
    });
    const gpsr = await applyPrintifyGpsr({
      token: apiToken,
      shopId: shopId ? Number(shopId) : undefined,
    });
    if (gpsr.shopId && String(gpsr.shopId) !== shopId) {
      await patchCredentials({
        printify: { apiToken, shopId: String(gpsr.shopId), shopTitle: gpsr.shopTitle || shopTitle },
      });
    }
    return Response.json({
      ok: true,
      live: true,
      ping,
      gpsr,
      notes: gpsr.notes,
      connections: await connectionStatus(),
    });
  } catch (error) {
    await patchCredentials({ printify: { apiToken, shopId: requestedShop } });
    return Response.json({
      ok: true,
      live: false,
      warning: (error as Error).message,
      connections: await connectionStatus(),
    });
  }
}
