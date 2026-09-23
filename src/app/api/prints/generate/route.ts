import { writeFile } from "node:fs/promises";
import { catalogPrintPath, cleanEmbroideryPrint, generatePrintTemplate } from "@/lib/print-studio";
import { patchCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const listingId = String(form.get("listingId") || "");
    const prompt = String(form.get("prompt") || "");
    const openaiApiKey = String(form.get("openaiApiKey") || "");
    const file = form.get("file");
    const reference = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : undefined;
    const bytes = await generatePrintTemplate({ prompt, listingId, reference, openaiApiKey });
    const dest = catalogPrintPath(listingId);
    await writeFile(dest, bytes);
    if (listingId === "live_hoodie_bloom") await cleanEmbroideryPrint(dest, dest);
    return Response.json({ ok: true, print: dest.replace(/.*\/public/, "") });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { openaiApiKey?: string };
    if (!body.openaiApiKey?.trim()) throw new Error("Paste an OpenAI image key");
    await patchCredentials({ openaiApiKey: body.openaiApiKey.trim() });
    return Response.json({ ok: true, openaiKeySet: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
