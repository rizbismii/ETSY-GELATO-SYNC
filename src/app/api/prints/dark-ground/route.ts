import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { convertDarkGroundPrint, DARK_GROUND_INKS, type DarkGroundInk } from "@/lib/print-studio";

export const dynamic = "force-dynamic";

const DEST = path.join(process.cwd(), "public", "catalog", "print-dark-ground.png");

function inkField(value: FormDataEntryValue | null): DarkGroundInk {
  const ink = String(value || "white");
  if ((DARK_GROUND_INKS as readonly string[]).includes(ink)) return ink as DarkGroundInk;
  throw new Error("Choose white, cream, gold, or silver");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose the logo image");
    const ink = inkField(form.get("ink"));
    const source = path.join("/tmp", `dark-ground-${Date.now()}.img`);
    await writeFile(source, Buffer.from(await file.arrayBuffer()));
    await mkdir(path.dirname(DEST), { recursive: true });
    await convertDarkGroundPrint(source, DEST, ink);
    return Response.json({
      ok: true,
      href: "/catalog/print-dark-ground.png",
      ink,
    });
  } catch (error) {
    const message = (error as Error).message || "Could not convert that image";
    console.error(message);
    return Response.json({ error: publicPrintError(message) }, { status: 400 });
  }
}

function publicPrintError(message: string) {
  if (/formdata|request body|unexpected end/i.test(message)) {
    return "That image did not upload. Use a JPEG or PNG under 60MB and try again.";
  }
  if (/cannot identify|UnidentifiedImageError/i.test(message)) {
    return "That file is not a readable JPEG, PNG, or WebP.";
  }
  const line = message.split("\n").map((row) => row.trim()).filter(Boolean).at(-1) || message;
  if (line.length > 180 || /Traceback/.test(message)) {
    return "Could not convert that image. Export it again as a JPEG or PNG and try once more.";
  }
  return line;
}
