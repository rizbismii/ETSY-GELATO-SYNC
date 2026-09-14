import { pushLivePricesToEtsy } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await pushLivePricesToEtsy();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
