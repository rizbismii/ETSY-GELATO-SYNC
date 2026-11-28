import {
  designsToSave,
  prepareDailyBatch,
  type DailyLettering,
  type DailyTheme,
  type ReviewMark,
} from "@/lib/daily-batch";
import { clearDeskBatch, deskBatchDirectory, listDeskBatch, saveDeskBatch } from "@/lib/daily-batch-desk";

export const dynamic = "force-dynamic";

const THEMES = new Set<DailyTheme>(["christmas", "new-year", "summer", "nature"]);

function letteringFrom(value: unknown): DailyLettering {
  if (!value || typeof value !== "object") return { mode: "none" };
  const row = value as { mode?: unknown; phrases?: unknown };
  if (row.mode !== "words") return { mode: "none" };
  const phrases: Partial<Record<DailyTheme, string>> = {};
  if (row.phrases && typeof row.phrases === "object") {
    for (const [theme, line] of Object.entries(row.phrases as Record<string, unknown>)) {
      if (!THEMES.has(theme as DailyTheme) || typeof line !== "string") continue;
      phrases[theme as DailyTheme] = line;
    }
  }
  return { mode: "words", phrases };
}

function reviewsFrom(value: unknown) {
  const reviews: Record<string, ReviewMark> = {};
  if (!value || typeof value !== "object") return reviews;
  for (const [id, mark] of Object.entries(value as Record<string, unknown>)) {
    if (!mark || typeof mark !== "object") continue;
    const row = mark as { glanced?: unknown; clean?: unknown };
    reviews[id] = { glanced: row.glanced === true, clean: row.clean === true };
  }
  return reviews;
}

export async function GET() {
  const files = await listDeskBatch(deskBatchDirectory());
  return Response.json({ ok: true, files, scope: "desk" });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: unknown; lettering?: unknown; reviews?: unknown };
    const dir = deskBatchDirectory();
    if (body.action === "clear") {
      const removed = await clearDeskBatch(dir);
      return Response.json({ ok: true, removed, scope: "desk" });
    }
    if (body.action === "push") {
      const clean = designsToSave(prepareDailyBatch(letteringFrom(body.lettering)), reviewsFrom(body.reviews));
      if (!clean.length) throw new Error("Glance a design and mark it clean before pushing");
      const saved = await saveDeskBatch(dir, clean);
      const files = await listDeskBatch(dir);
      return Response.json({ ok: true, saved, files, scope: "desk" });
    }
    throw new Error("Choose push or clear");
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
