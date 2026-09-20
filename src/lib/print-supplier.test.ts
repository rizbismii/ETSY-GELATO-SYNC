import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { shipLaneForCountry } from "./gelato-countries.ts";

function printSupplierForCountry(code?: string | null) {
  const lane = shipLaneForCountry(code);
  return lane === "GB" || lane === "EU" ? "gelato" : "printify";
}

test("Printify is the main supplier except EU and UK lanes", () => {
  assert.equal(printSupplierForCountry("NZ"), "printify");
  assert.equal(printSupplierForCountry("AU"), "printify");
  assert.equal(printSupplierForCountry("US"), "printify");
  assert.equal(printSupplierForCountry("CA"), "printify");
  assert.equal(printSupplierForCountry("SG"), "printify");
  assert.equal(printSupplierForCountry("GB"), "gelato");
  assert.equal(printSupplierForCountry("UK"), "gelato");
  assert.equal(printSupplierForCountry("IE"), "gelato");
  assert.equal(printSupplierForCountry("FR"), "gelato");
  assert.equal(printSupplierForCountry("DE"), "gelato");
  assert.equal(printSupplierForCountry("CH"), "gelato");
});

test("desk copy names Printify as main except EU/UK", () => {
  const source = readFileSync(new URL("./print-supplier.ts", import.meta.url), "utf8");
  assert.match(source, /Printify is the main supplier/);
  assert.match(source, /except the United Kingdom and the European Union/);
  assert.match(source, /Leave the saved connections as they are/);
  assert.doesNotMatch(source, /cannot replace Gelato as the live print platform/);
  assert.doesNotMatch(source, /from "\.\/gelato-countries\.ts"/);
});
