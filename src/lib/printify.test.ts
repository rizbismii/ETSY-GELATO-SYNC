import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyConnectionHeadline,
  printifyGpsrHeadline,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  printifyIsFullyConnected,
  printifyShopLine,
  safetyInformationNeedsGpsr,
} from "./printify-gpsr.ts";
import {
  buildPrintifyProductPayload,
  existingPrintifyProductId,
  FERNORA_PRINTIFY_STARTERS,
  printifyEnabledVariantIds,
  printifyImageFileName,
} from "./printify-products.ts";

test("Printify GPSR blocks flatten into safety_information", () => {
  const text = formatPrintifySafetyInformation([
    { title: "GPSR information", text: "Affiliate, eu@example.com, 1 Rue, Paris, 75001, FR" },
    { title: "Care instructions", text: "Machine wash warm" },
  ]);
  assert.match(text, /GPSR information:/);
  assert.match(text, /Care instructions: Machine wash warm/);
  assert.doesNotMatch(text, /Gelato/);
});

test("empty GPSR text needs a stamp; existing GPSR does not", () => {
  assert.equal(safetyInformationNeedsGpsr(""), true);
  assert.equal(safetyInformationNeedsGpsr("GPSR information: already set"), false);
  assert.equal(safetyInformationNeedsGpsr("Just a description"), true);
});

test("Fernora-titled Printify shop is preferred", () => {
  const shop = pickPrintifyShop([
    { id: 1, title: "My new store" },
    { id: 2, title: "Fernora" },
  ]);
  assert.equal(shop?.id, 2);
});

test("GPSR 404 is treated as Non-EU, not a per-product failure", () => {
  assert.equal(printifyGpsrIsUnavailable("Not found"), true);
  assert.equal(printifyGpsrIsUnavailable("Printify API 404"), false);
  assert.equal(
    printifyGpsrModeFromProbe({
      shopId: 28911657,
      productCount: 5,
      updated: 0,
      gpsrUnavailable: true,
    }),
    "non-eu",
  );
  const notes = printifyGpsrNotes("non-eu", 5, 0);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /Printify is the main print supplier except/);
  assert.match(notes[0], /United Kingdom and the European Union/);
  assert.match(notes[0], /will not accept Wellington 6012/);
  assert.doesNotMatch(notes[0], /default affiliate/);
  assert.doesNotMatch(notes[0], /cannot replace Gelato as the live print platform/);
  assert.equal(printifyGpsrHeadline("non-eu"), "Non-EU hold · Printify is main except EU/UK");
});

test("Fernora Trends Etsy shop is preferred over the disconnected store", () => {
  const shop = pickPrintifyShop([
    { id: 28911657, title: "Fernora Trends", sales_channel: "disconnected" },
    { id: 28911689, title: "Fernora Trends", sales_channel: "etsy" },
  ]);
  assert.equal(shop?.id, 28911689);
});

test("Printify is fully connected only with products on a sales channel", () => {
  const placeholder = [
    { id: 28911657, title: "Fernora", salesChannel: "disconnected", productCount: 5 },
    { id: 28911689, title: "My Etsy Store", salesChannel: "etsy", productCount: 0 },
  ];
  assert.equal(printifyIsFullyConnected(placeholder), false);
  assert.match(
    printifyConnectionHeadline({
      shops: placeholder,
      fullyConnected: false,
      gpsrStatus: "non-eu",
      etsyShopName: "FERNORATRENDS",
    }),
    /Printify does not show FERNORATRENDS/,
  );
  assert.equal(
    printifyShopLine(placeholder[1], "FERNORATRENDS"),
    "My Etsy Store · 28911689 · Etsy channel · 0 products · not FERNORATRENDS",
  );

  const connected = [
    { id: 28911657, title: "Fernora Trends", salesChannel: "disconnected", productCount: 5 },
    { id: 28911689, title: "Fernora Trends", salesChannel: "etsy", productCount: 0 },
  ];
  assert.match(
    printifyConnectionHeadline({
      shops: connected,
      fullyConnected: false,
      gpsrStatus: "non-eu",
      etsyShopName: "FERNORATRENDS",
    }),
    /Etsy connected as Fernora Trends/,
  );
  assert.match(printifyShopLine(connected[1], "FERNORATRENDS"), /Etsy connected/);
  assert.doesNotMatch(printifyShopLine(connected[1], "FERNORATRENDS"), /not FERNORATRENDS/);
  assert.equal(printifyIsFullyConnected([{ id: 1, title: "Etsy", salesChannel: "etsy", productCount: 2 }]), true);
});

test("EU GPSR probe without stamps is available; stamps mark applied", () => {
  assert.equal(
    printifyGpsrModeFromProbe({ shopId: 1, productCount: 3, updated: 2, gpsrUnavailable: false }),
    "stamped",
  );
  assert.equal(
    printifyGpsrModeFromProbe({
      shopId: 1,
      productCount: 3,
      updated: 0,
      gpsrUnavailable: false,
      alreadyStamped: 3,
    }),
    "stamped",
  );
  assert.equal(
    printifyGpsrModeFromProbe({ shopId: 1, productCount: 3, updated: 0, gpsrUnavailable: false }),
    "available",
  );
  assert.equal(printifyGpsrModeFromProbe({ productCount: 0, updated: 0, gpsrUnavailable: false }), "no-shop");
  assert.equal(
    printifyGpsrModeFromProbe({ shopId: 1, productCount: 0, updated: 0, gpsrUnavailable: false }),
    "empty",
  );
});

test("Fernora Printify catalog is five products, one enabled variant each", () => {
  assert.equal(FERNORA_PRINTIFY_STARTERS.length, 5);
  const keys = FERNORA_PRINTIFY_STARTERS.map((row) => row.key);
  assert.equal(new Set(keys).size, 5);
  assert.deepEqual(keys, [
    "live_poster",
    "live_quote_breathe",
    "live_botanical_kowhai",
    "live_canvas_harbour",
    "live_frame_kind",
  ]);
  const catalog = readFileSync(new URL("./live-catalog.ts", import.meta.url), "utf8");
  const liveIds = [...catalog.matchAll(/^\s+id: "(live_[^"]+)"/gm)].map((row) => row[1]);
  assert.deepEqual([...keys].sort(), [...new Set(liveIds)].sort());
  for (const spec of FERNORA_PRINTIFY_STARTERS) {
    assert.equal(spec.variants.length, 1);
    assert.equal(spec.variants[0].is_enabled, true);
    assert.equal(spec.variants[0].is_default, true);
    assert.ok(spec.printFile.startsWith("print-"));
  }
  const poster = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_poster");
  const breathe = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_quote_breathe");
  assert.equal(poster?.blueprintId, 282);
  assert.equal(poster?.printProviderId, 99);
  assert.deepEqual(
    poster?.variants.map((row) => row.id),
    [43138],
  );
  assert.equal(breathe?.blueprintId, 284);
  assert.equal(breathe?.printProviderId, 99);
  assert.deepEqual(
    breathe?.variants.map((row) => row.id),
    [43166],
  );
  const payload = buildPrintifyProductPayload(poster!, "img_poster");
  assert.equal(payload.visible, true);
  assert.equal("publish_details" in payload, false);
  assert.equal(payload.print_areas[0].placeholders[0].position, "front");
  assert.equal(payload.print_areas[0].placeholders[0].images[0].id, "img_poster");
  assert.deepEqual(payload.print_areas[0].variant_ids, [43138]);
  assert.equal(
    existingPrintifyProductId([{ id: "abc", title: "Fern Arc Poster" }], "Fern Arc Poster · A3 Semi-Gloss", [
      "Fern Arc Poster",
    ]),
    "abc",
  );
  assert.equal(existingPrintifyProductId([{ id: "abc", title: "Other" }], "Fern Arc Poster"), undefined);
  assert.deepEqual(printifyEnabledVariantIds({ variants: [{ id: 1, is_enabled: true }, { id: 2, is_enabled: false }] }), [
    1,
  ]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(printifyImageFileName("print-poster-fern-arc.png", jpeg), "print-poster-fern-arc.jpg");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  assert.equal(printifyImageFileName("print-tote-fern-spray.png", png), "print-tote-fern-spray.png");
});
