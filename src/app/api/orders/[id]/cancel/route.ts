import { cancelOrder } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await cancelOrder(id);
    return Response.json({ ok: true, status: result.order?.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
