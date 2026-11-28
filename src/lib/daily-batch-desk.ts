import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PreparedDesign } from "@/lib/daily-batch";

const FILE_NAME = /^[a-z0-9]+(?:[-_][a-z0-9]+)*\.json$/;
const DESIGN_ID = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/** Saved batch files live here. Shop print files under public/catalog stay put. */
export function deskBatchDirectory(root = process.cwd()) {
  return path.join(root, "data", "daily-batch");
}

export function resolveDeskBatchFile(dir: string, id: string) {
  if (!DESIGN_ID.test(id)) throw new Error("Unknown design");
  const root = path.resolve(dir);
  const target = path.resolve(root, `${id}.json`);
  if (path.dirname(target) !== root) throw new Error("Unknown design");
  return target;
}

export async function listDeskBatch(dir: string) {
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return names.filter((name) => FILE_NAME.test(name)).sort();
}

export async function saveDeskBatch(dir: string, rows: PreparedDesign[]) {
  await mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (const row of rows) {
    const target = resolveDeskBatchFile(dir, row.id);
    const body = {
      id: row.id,
      theme: row.theme,
      themeLabel: row.themeLabel,
      blankId: row.blankId,
      blankName: row.blankName,
      title: row.title,
      prompt: row.prompt,
      phrase: row.phrase,
      collar: row.collar?.file ?? null,
      savedAt: new Date().toISOString(),
    };
    await writeFile(target, `${JSON.stringify(body, null, 2)}\n`);
    saved.push(path.basename(target));
  }
  return saved;
}

/** Removes batch JSON in this directory only. Other files in the folder stay. */
export async function clearDeskBatch(dir: string) {
  const names = await listDeskBatch(dir);
  const root = path.resolve(dir);
  const removed: string[] = [];
  for (const name of names) {
    const target = path.resolve(root, name);
    if (path.dirname(target) !== root) continue;
    await unlink(target);
    removed.push(name);
  }
  return removed;
}
