import { connectionStatus } from "@/lib/ops";
import { createFernoraPrintifyProducts } from "@/lib/printify";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const created = await createFernoraPrintifyProducts();
    return Response.json({
      ok: true,
      live: true,
      published: created.published,
      shopId: created.shopId,
      shopTitle: created.shopTitle,
      products: created.products,
      fullyConnected: created.fullyConnected,
      gpsrStatus: created.gpsr.gpsrStatus,
      notes: created.notes,
      connections: await connectionStatus(),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
