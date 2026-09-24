import { refreshPrintifyCatalogItem } from "@/lib/printify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { listingId?: string };
    const listingId = body.listingId?.trim();
    if (!listingId) throw new Error("Choose a catalog product");
    const result = await refreshPrintifyCatalogItem(listingId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}