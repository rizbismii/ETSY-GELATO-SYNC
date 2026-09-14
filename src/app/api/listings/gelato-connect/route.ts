import { connectGelatoDesigns } from "@/lib/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const result = await connectGelatoDesigns();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
