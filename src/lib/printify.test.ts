import assert from "node:assert/strict";
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
  assert.match(notes[0], /cannot replace Gelato/);
  assert.match(notes[0], /other sales channels/);
  assert.match(notes[0], /Wellington 6012 is not/);
  assert.doesNotMatch(notes[0], /default affiliate/);
  assert.equal(printifyGpsrHeadline("non-eu"), "Non-EU hold · Gelato stays the live print path");
});

test("Printify is fully connected only with products on a sales channel", () => {
  const shops = [
    { id: 28911657, title: "Fernora", salesChannel: "disconnected", productCount: 5 },
    { id: 28911689, title: "My Etsy Store", salesChannel: "etsy", productCount: 0 },
  ];
  assert.equal(printifyIsFullyConnected(shops), false);
  assert.match(
    printifyConnectionHeadline({
      shops,
      fullyConnected: false,
      gpsrStatus: "non-eu",
      etsyShopName: "FERNORATRENDS",
    }),
    /Printify does not show FERNORATRENDS/,
  );
  assert.equal(
    printifyShopLine(shops[0]),
    "Fernora · 28911657 · not linked to a sales platform · 5 products",
  );
  assert.equal(
    printifyShopLine(shops[1], "FERNORATRENDS"),
    "My Etsy Store · 28911689 · Etsy channel · 0 products · not FERNORATRENDS",
  );
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
