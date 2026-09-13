import { LIVE_PRODUCTS, SHIP_BLURB } from "@/lib/live-catalog";
import { updateEtsyShopAnnouncement } from "@/lib/etsy";
import { publishListing } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: "draft" | "live" };
  const mode = body.mode === "live" ? "live" : "draft";
  try {
    await updateEtsyShopAnnouncement(
      `Welcome to FERNORATRENDS. ${SHIP_BLURB} Made to order. Offsite Ads: we only pay Etsy a percentage when an ad actually makes a sale — no click budget eating margin.`,
    );
  } catch {
    /* announcement is optional; listings still publish */
  }
  const results = [];
  for (const product of LIVE_PRODUCTS) {
    try {
      results.push(await publishListing(product.id, mode));
    } catch (error) {
      results.push({ id: product.id, error: (error as Error).message });
    }
  }
  return Response.json({ ok: results.every((row) => !("error" in row && row.error)), results });
}
