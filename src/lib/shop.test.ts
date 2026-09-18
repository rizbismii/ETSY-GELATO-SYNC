import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gelatoCodesForLane,
  gelatoDestination,
  isGelatoCountry,
  shipLaneForCountry,
} from "./gelato-countries.ts";
import { printFileName, printSurface, printTreatment } from "./print-file.ts";

test("Gelato destinations include AU, NZ, and other print countries", () => {
  assert.equal(isGelatoCountry("NZ"), true);
  assert.equal(isGelatoCountry("AU"), true);
  assert.equal(isGelatoCountry("US"), true);
  assert.equal(isGelatoCountry("GB"), true);
  assert.equal(isGelatoCountry("FR"), true);
  assert.equal(isGelatoCountry("DE"), true);
  assert.equal(isGelatoCountry("JP"), true);
  assert.equal(isGelatoCountry("AUS"), true);
  assert.equal(isGelatoCountry("XX"), false);
  assert.equal(isGelatoCountry("IE"), true);
  assert.equal(isGelatoCountry("AQ"), false);
});

test("country codes map onto catalog rate lanes", () => {
  assert.equal(shipLaneForCountry("NZ"), "NZ");
  assert.equal(shipLaneForCountry("AU"), "AU");
  assert.equal(shipLaneForCountry("CA"), "US");
  assert.equal(shipLaneForCountry("GB"), "GB");
  assert.equal(shipLaneForCountry("IE"), "GB");
  assert.equal(shipLaneForCountry("FR"), "EU");
  assert.equal(shipLaneForCountry("CH"), "EU");
  assert.equal(shipLaneForCountry("SG"), "US");
  assert.equal(gelatoDestination("uk")?.code, "GB");
});

test("print templates keep a downloadable filename and surface for current products", () => {
  assert.equal(printFileName("/catalog/print-poster-fern-arc.png"), "print-poster-fern-arc.png");
  assert.equal(printSurface("hoodie"), "dtg");
  assert.equal(printTreatment("hoodie"), "sage-emblem");
  assert.equal(printTreatment("poster"), "full-bleed");
  assert.ok(gelatoCodesForLane("EU").includes("DE"));
  assert.ok(gelatoCodesForLane("NZ").includes("NZ"));
});
