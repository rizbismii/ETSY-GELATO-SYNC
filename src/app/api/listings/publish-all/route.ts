import { LIVE_PRODUCTS } from "@/lib/live-catalog";
import { publishListing } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: "draft" | "live" };
  const mode = body.mode === "live" ? "live" : "draft";
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
