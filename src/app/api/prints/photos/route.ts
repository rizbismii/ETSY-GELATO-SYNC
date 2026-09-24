import { syncCustomerDesignPhotos } from "@/lib/printify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { listingId?: string };
    const only = body.listingId?.trim() ? [body.listingId.trim()] : undefined;
    const result = await syncCustomerDesignPhotos(only);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
