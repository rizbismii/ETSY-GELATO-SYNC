import { writeFile } from "node:fs/promises";
import { catalogPrintPath, cleanEmbroideryPrint } from "@/lib/print-studio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const listingId = String(form.get("listingId") || "");
    const clean = String(form.get("clean") || "") === "1";
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose an image to upload");
    const dest = catalogPrintPath(listingId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(dest, bytes);
    const print = clean || listingId === "live_hoodie_bloom" ? await cleanEmbroideryPrint(dest, dest) : dest;
    return Response.json({ ok: true, print: String(print).replace(/.*\/public/, "") || dest.replace(/.*\/public/, "") });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
