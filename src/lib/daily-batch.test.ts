import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { FERNORA_PRINTIFY_STARTERS } from "./printify-products.ts";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DAILY_THEMES,
  DAILY_WORD_OPTIONS,
  DEFAULT_DAILY_LETTERING,
  FERNORA_COLLAR_PRINT,
  dailyBatchLabel,
  dailyBatchSummary,
  designsToSave,
  markClean,
  markGlanced,
  phraseForTheme,
  prepareDailyBatch,
} from "./daily-batch.ts";
import { clearDeskBatch, resolveDeskBatchFile, saveDeskBatch } from "./daily-batch-desk.ts";

const allLines = DAILY_THEMES.flatMap((theme) => DAILY_WORD_OPTIONS[theme].map((row) => row.line));

test("daily batch is 16 designs on blanks the shop already sells", () => {
  const rows = prepareDailyBatch();
  assert.ok(rows.length >= 15 && rows.length <= 20);
  assert.equal(rows.length, 16);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  for (const theme of DAILY_THEMES) {
    assert.equal(rows.filter((row) => row.theme === theme).length, 4);
  }
  const catalog = readFileSync(new URL("./live-catalog.ts", import.meta.url), "utf8");
  const catalogIds = catalog.match(/export const LIVE_CATALOG_IDS = \[([\s\S]*?)\] as const/)?.[1] || "";
  for (const row of rows) {
    assert.match(catalogIds, new RegExp(`"${row.blankId}"`));
    assert.ok(FERNORA_PRINTIFY_STARTERS.some((spec) => spec.key === row.blankId));
    assert.ok(existsSync(`public${row.mockup}`));
  }
});

test("no words is the default and lettering stays off until a listed line is picked", () => {
  const plain = prepareDailyBatch();
  assert.equal(DEFAULT_DAILY_LETTERING.mode, "none");
  assert.equal(dailyBatchSummary(plain).withWords, 0);
  assert.equal(dailyBatchSummary(plain).withoutWords, 16);
  for (const row of plain) {
    assert.equal(row.lettering, false);
    assert.equal(row.phrase, null);
    assert.match(row.prompt, /No words, no letters, no numbers/);
    for (const line of allLines) assert.equal(row.prompt.includes(`"${line}"`), false);
  }

  const ignored = prepareDailyBatch({
    mode: "words",
    phrases: { christmas: "Not a real line", summer: "  " },
  });
  assert.equal(dailyBatchSummary(ignored).withWords, 0);

  const christmas = prepareDailyBatch({
    mode: "words",
    phrases: { christmas: "Pohutukawa Christmas" },
  });
  assert.equal(dailyBatchSummary(christmas).withWords, 4);
  for (const row of christmas) {
    if (row.theme === "christmas") {
      assert.equal(row.lettering, true);
      assert.match(row.prompt, /"Pohutukawa Christmas"/);
      assert.match(row.prompt, /No other lettering/);
      assert.doesNotMatch(row.prompt, /No words, no letters/);
    } else {
      assert.equal(row.lettering, false);
      assert.match(row.prompt, /No words, no letters/);
    }
  }

  assert.equal(phraseForTheme("christmas", { mode: "none" }), null);
  assert.equal(
    phraseForTheme("nature", { mode: "words", phrases: { nature: "Bush light" } }),
    "Bush light",
  );
});

test("every tee includes the Fernora collar logo and other blanks do not", () => {
  assert.ok(existsSync(`public${FERNORA_COLLAR_PRINT.file}`));
  const rows = prepareDailyBatch();
  const tees = rows.filter((row) => row.blankId === "live_tee_bloom");
  assert.equal(tees.length, 4);
  assert.equal(dailyBatchSummary(rows).collars, 4);
  for (const row of tees) {
    assert.equal(row.collar?.file, "/catalog/print-tee-bloom-neck.png");
    assert.equal(row.collar?.label, "Fernora brand logo");
    assert.equal(row.collar?.width, 750);
    assert.match(row.prompt, /collar print carries the brand logo/);
  }
  for (const row of rows.filter((item) => item.blankId !== "live_tee_bloom")) {
    assert.equal(row.collar, null);
    assert.doesNotMatch(row.prompt, /collar/i);
  }
});

test("push keeps only designs that were glanced and marked clean", () => {
  const rows = prepareDailyBatch();
  const first = rows[0];
  const second = rows[1];
  let marks = markGlanced({}, first.id, true);
  marks = markClean(marks, first.id, true);
  marks = markClean(marks, second.id, true);
  assert.equal(marks[second.id], undefined);
  marks = markGlanced(marks, second.id, true);
  marks = markClean(marks, second.id, true);
  marks = markGlanced(marks, second.id, false);
  assert.equal(marks[second.id].clean, false);
  const saved = designsToSave(rows, marks);
  assert.deepEqual(saved.map((row) => row.id), [first.id]);
});

test("clear removes desk batch files and leaves files outside that folder", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fernora-batch-"));
  const desk = path.join(root, "daily-batch");
  await mkdir(desk);
  const rows = prepareDailyBatch().slice(0, 1);
  await saveDeskBatch(desk, rows);
  await writeFile(path.join(desk, "notes.txt"), "keep");
  await writeFile(path.join(root, "credentials.json"), "{}");
  assert.throws(() => resolveDeskBatchFile(desk, "../credentials"));
  const removed = await clearDeskBatch(desk);
  assert.deepEqual(removed, [`${rows[0].id}.json`]);
  assert.equal(existsSync(path.join(desk, "notes.txt")), true);
  assert.equal(existsSync(path.join(root, "credentials.json")), true);
  assert.equal(existsSync(path.join(desk, `${rows[0].id}.json`)), false);
});

test("the batch stays on the prints page and does not delete shop products", () => {
  const lib = readFileSync(new URL("./daily-batch.ts", import.meta.url), "utf8");
  const desk = readFileSync(new URL("./daily-batch-desk.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/prints/daily/route.ts", import.meta.url), "utf8");
  const batch = readFileSync(new URL("../app/prints/daily-batch.tsx", import.meta.url), "utf8");
  const prints = readFileSync(new URL("../app/prints/page.tsx", import.meta.url), "utf8");
  assert.equal(existsSync(new URL("../app/prints/daily/page.tsx", import.meta.url)), false);
  assert.match(prints, /<DailyBatch/);
  assert.doesNotMatch(prints, /href=["']\/prints\/daily["']/);
  for (const source of [lib, desk, route, batch]) {
    assert.doesNotMatch(source, /from ["']@\/lib\/(printify|etsy|shopify|credentials|desk-credentials)/);
    assert.doesNotMatch(source, /\/api\/prints\/push/);
    assert.doesNotMatch(source, /\/api\/listings/);
    assert.doesNotMatch(source, /openai/i);
    assert.doesNotMatch(source, /credentials\.json/);
  }
  assert.match(batch, /\/api\/prints\/daily/);
  assert.match(route, /action === "clear"/);
  assert.match(route, /action === "push"/);
  assert.match(dailyBatchLabel(new Date("2026-11-28T04:00:00Z")), /2026/);
});
