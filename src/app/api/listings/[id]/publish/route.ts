import { publishListing } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { mode?: "draft" | "live" };
  const mode = body.mode === "live" ? "live" : "draft";
  try {
    const result = await publishListing(id, mode);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
