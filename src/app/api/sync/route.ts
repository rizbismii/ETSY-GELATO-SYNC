import { syncLive } from "@/lib/ops";

export async function POST() {
  const notes = await syncLive();
  return Response.json({ ok: true, notes });
}
