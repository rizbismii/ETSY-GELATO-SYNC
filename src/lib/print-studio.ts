import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCredentials, patchCredentials } from "@/lib/credentials";
import { catalogArtPair, embroideryPrintSize, isEmbroideryListing } from "@/lib/print-file";

export function catalogPrintPath(listingId: string) {
  const pair = catalogArtPair(listingId);
  if (!pair) throw new Error("Choose a catalog product first");
  return path.join(process.cwd(), "public", pair.print.replace(/^\//, ""));
}

export async function writeCatalogPrint(listingId: string, bytes: Uint8Array, ext = "png") {
  const dest = catalogPrintPath(listingId);
  const target = ext === "png" ? dest : dest.replace(/\.png$/i, `.${ext}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return target.replace(path.join(process.cwd(), "public"), "");
}

function runPython(script: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [script, ...args], { cwd: process.cwd() });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `python exited ${code}`));
    });
  });
}

export async function cleanGeminiPrint(
  source: string,
  dest: string,
  size: { width: number; height: number; dpi: number },
) {
  await runPython(path.join(process.cwd(), "scripts", "clean-checker-print.py"), [
    source,
    dest,
    "--width",
    String(size.width),
    "--height",
    String(size.height),
    "--dpi",
    String(size.dpi),
  ]);
  return dest.replace(path.join(process.cwd(), "public"), "");
}

export async function cleanEmbroideryPrint(
  source: string,
  dest: string,
  size?: { width: number; height: number },
) {
  const args = [source, dest];
  if (size) {
    args.push("--width", String(size.width), "--height", String(size.height));
  }
  await runPython(path.join(process.cwd(), "scripts", "clean-embroidery-print.py"), args);
  return dest.replace(path.join(process.cwd(), "public"), "");
}

export { embroideryPrintSize, isEmbroideryListing };

async function openaiKey(override?: string) {
  const saved = override?.trim() || (await getCredentials()).openaiApiKey?.trim();
  if (override?.trim()) {
    await patchCredentials({ openaiApiKey: override.trim() });
  }
  if (!saved) throw new Error("Save an OpenAI image key on this page to generate print templates");
  return saved;
}

export async function generatePrintTemplate(input: {
  prompt: string;
  listingId?: string;
  reference?: Uint8Array;
  openaiApiKey?: string;
}) {
  const key = await openaiKey(input.openaiApiKey);
  const prompt = [
    "Print-ready catalog artwork on a clean transparent or cream ground.",
    "No garment, no mockup, no watermark, no distorted stretch.",
    "Keep lettering sharp if the prompt includes words.",
    input.prompt.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  if (!prompt.replace("Print-ready", "").trim()) throw new Error("Write a prompt for the print template");

  if (input.reference?.length) {
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("image", new Blob([Buffer.from(input.reference)], { type: "image/png" }), "reference.png");
    const edited = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const json = (await edited.json()) as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
    if (!edited.ok) throw new Error(json.error?.message || `Image edit ${edited.status}`);
    return decodeImage(json.data?.[0]);
  }

  const created = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
  });
  const json = (await created.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };
  if (!created.ok) throw new Error(json.error?.message || `Image generate ${created.status}`);
  return decodeImage(json.data?.[0]);
}

async function decodeImage(row?: { b64_json?: string; url?: string }) {
  if (row?.b64_json) return Buffer.from(row.b64_json, "base64");
  if (row?.url) {
    const response = await fetch(row.url);
    if (!response.ok) throw new Error("Generated image download failed");
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("Image API returned no file");
}
