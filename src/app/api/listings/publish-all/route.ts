import { LIVE_PRODUCTS, SHIP_BLURB } from "@/lib/live-catalog";
import { updateEtsyShopAnnouncement } from "@/lib/etsy";
import { publishListing } from "@/lib/ops";
import { getDeletedListingIds } from "@/lib/tombstones";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: "draft" | "live" };
  const mode = body.mode === "live" ? "live" : "draft";
  try {
    await updateEtsyShopAnnouncement(
      `Welcome to FERNORATRENDS. ${SHIP_BLURB} Made to order.`,
    );
  } catch {
    /* announcement is optional; listings still publish */
  }
  const deleted = new Set(getDeletedListingIds());
  const results = [];
  for (const product of LIVE_PRODUCTS) {
    if (deleted.has(product.id)) continue;
    try {
      results.push(await publishListing(product.id, mode));
    } catch (error) {
      results.push({ id: product.id, error: (error as Error).message });
    }
  }
  return Response.json({ ok: results.every((row) => !("error" in row && row.error)), results });
}
