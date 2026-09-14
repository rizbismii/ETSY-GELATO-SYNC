import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "deleted-listings.json");

type TombstoneFile = { ids?: string[] };

export function getDeletedListingIds(): string[] {
  try {
    if (!existsSync(FILE)) return [];
    const data = JSON.parse(readFileSync(FILE, "utf8")) as TombstoneFile;
    return Array.isArray(data.ids) ? data.ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function rememberDeletedListing(id: string) {
  const ids = [...new Set([...getDeletedListingIds(), id])];
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ ids }, null, 2) + "\n");
  return ids;
}

export function isListingDeleted(id: string, extra: string[] = []) {
  return extra.includes(id) || getDeletedListingIds().includes(id);
}
