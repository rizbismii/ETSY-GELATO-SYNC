import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyGpsrHeadline,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  safetyInformationNeedsGpsr,
} from "./printify-gpsr.ts";

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
  assert.match(notes[0], /Non-EU/);
  assert.match(notes[0], /Wellington 6012 is not valid/);
  assert.match(notes[0], /Gelato/);
  assert.doesNotMatch(notes[0], /Leave EU/);
  assert.equal(printifyGpsrHeadline("non-eu"), "Non-EU hold · GPSR off until a real EU/NI contact is saved");
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
