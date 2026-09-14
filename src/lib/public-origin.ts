import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "data");
const ORIGIN_FILE = path.join(DIR, "public-origin.json");
const OAUTH_FILE = path.join(DIR, "oauth-state.json");

export type TunnelPlatform = "etsy" | "shopify" | "gelato";
export type TunnelPushStatus = "updated" | "not_updated";
export type TunnelRecord = {
  origin: string;
  status: TunnelPushStatus;
  note: string;
  at: string;
};
export type OriginFile = {
  origin: string;
  tunnel?: Partial<Record<TunnelPlatform, TunnelRecord>>;
};
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

export async function readOriginFile(): Promise<OriginFile> {
  return readJson<OriginFile>(ORIGIN_FILE, { origin: "" });
}

export async function getPublicOrigin() {
  const stored = await readOriginFile();
  return stored.origin || process.env.ETSY_PUBLIC_ORIGIN || "";
}

export async function setPublicOrigin(origin: string) {
  const next = origin.replace(/\/$/, "");
  const current = await readOriginFile();
  const tunnel = current.origin === next ? current.tunnel : {};
  await writeJson(ORIGIN_FILE, { origin: next, tunnel });
  return next;
}

export async function recordTunnelPush(platform: TunnelPlatform, record: TunnelRecord) {
  const current = await readOriginFile();
  await writeJson(ORIGIN_FILE, {
    origin: current.origin,
    tunnel: { ...current.tunnel, [platform]: record },
  });
}

export function tunnelStatusFor(file: OriginFile, platform: TunnelPlatform, origin: string): TunnelRecord {
  const record = file.tunnel?.[platform];
  if (!origin) {
    return {
      origin: "",
      status: "not_updated",
      note: "No public tunnel hostname yet. Run npm run etsy-tunnel.",
      at: record?.at || "",
    };
  }
  if (!record || record.origin !== origin) {
    return {
      origin,
      status: "not_updated",
      note: "Tunnel hostname changed. Push from Pressroom to update this platform.",
      at: record?.at || "",
    };
  }
  return record;
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
