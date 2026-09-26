import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cleanGeminiPrint } from "@/lib/print-studio";

export const dynamic = "force-dynamic";

const DEST = path.join(process.cwd(), "public", "catalog", "print-gemini-fixed.png");

function numberField(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose the Gemini image");
    const width = numberField(form.get("width"), 3852, 256, 8000);
    const height = numberField(form.get("height"), 4398, 256, 8000);
    const dpi = numberField(form.get("dpi"), 300, 72, 600);
    const source = path.join("/tmp", `gemini-print-${Date.now()}.img`);
    await writeFile(source, Buffer.from(await file.arrayBuffer()));
    await mkdir(path.dirname(DEST), { recursive: true });
    await cleanGeminiPrint(source, DEST, { width, height, dpi });
    return Response.json({
      ok: true,
      href: "/catalog/print-gemini-fixed.png",
      width,
      height,
      dpi,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
