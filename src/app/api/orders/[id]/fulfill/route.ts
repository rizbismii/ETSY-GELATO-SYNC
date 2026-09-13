import { fulfillOrder } from "@/lib/ops";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await fulfillOrder(id);
    return Response.json({ ok: true, gelatoOrderId: result.gelatoOrderId, live: result.live });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
