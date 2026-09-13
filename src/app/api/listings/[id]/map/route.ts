import { mapListing } from "@/lib/ops";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { gelatoProductUid?: string; printFileUrl?: string };
  if (!body.gelatoProductUid) {
    return Response.json({ error: "Choose a Gelato product." }, { status: 400 });
  }
  try {
    const listing = await mapListing(id, body.gelatoProductUid, body.printFileUrl);
    return Response.json({ listing });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
