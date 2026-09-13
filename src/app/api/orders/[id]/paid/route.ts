import { markOrderPaid } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { fulfill?: boolean };
  try {
    const result = await markOrderPaid(id, body.fulfill !== false);
    return Response.json({
      ok: true,
      gelatoOrderId: result.gelatoOrderId,
      status: result.order?.status,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
