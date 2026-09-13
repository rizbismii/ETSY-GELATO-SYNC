import { repairShop, fulfillReady, autoMapUnmapped, raiseThinPrices, pushAllTracking } from "@/lib/ops";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  try {
    if (body.action === "map") {
      const mapped = await autoMapUnmapped();
      return Response.json({ ok: true, mappedListings: mapped.length });
    }
    if (body.action === "fulfill") {
      const fulfilled = await fulfillReady();
      return Response.json({ ok: true, fulfilled: fulfilled.length });
    }
    if (body.action === "tracking") {
      const tracking = await pushAllTracking();
      return Response.json({ ok: true, trackingPushed: tracking.length });
    }
    if (body.action === "price") {
      const priced = await raiseThinPrices();
      return Response.json({ ok: true, repriced: priced.length });
    }
    const result = await repairShop();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
