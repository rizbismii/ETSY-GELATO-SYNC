import { pushTracking } from "@/lib/ops";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await pushTracking(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
