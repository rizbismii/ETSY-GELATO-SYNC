import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "data");
const ORIGIN_FILE = path.join(DIR, "public-origin.json");
const OAUTH_FILE = path.join(DIR, "oauth-state.json");

type OriginFile = { origin: string };
type OAuthRecord = { verifier: string; redirectUri: string; createdAt: number; shop?: string };
type OAuthFile = Record<string, OAuthRecord>;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

export async function getPublicOrigin() {
  const stored = await readJson<OriginFile>(ORIGIN_FILE, { origin: "" });
  return stored.origin || process.env.ETSY_PUBLIC_ORIGIN || "";
}

export async function setPublicOrigin(origin: string) {
  await writeJson(ORIGIN_FILE, { origin: origin.replace(/\/$/, "") });
}

export async function saveOAuthState(state: string, record: OAuthRecord) {
  const all = await readJson<OAuthFile>(OAUTH_FILE, {});
  const now = Date.now();
  for (const [key, value] of Object.entries(all)) {
    if (now - value.createdAt > 10 * 60 * 1000) delete all[key];
  }
  all[state] = record;
  await writeJson(OAUTH_FILE, all);
}

export async function takeOAuthState(state: string) {
  const all = await readJson<OAuthFile>(OAUTH_FILE, {});
  const record = all[state];
  if (record) {
    delete all[state];
    await writeJson(OAUTH_FILE, all);
  }
  return record ?? null;
}
