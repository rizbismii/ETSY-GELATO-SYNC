import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isGelatoComplianceCountry,
  printSupplierForCountry,
  printSupplierForOrder,
  PRINTIFY_MAIN_HEADLINE,
  PRINTIFY_MAIN_NOTE,
} from "./print-supplier.ts";

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
  assert.equal(isGelatoComplianceCountry("US"), false);
  assert.equal(isGelatoComplianceCountry("GB"), true);
  assert.equal(printSupplierForOrder({ shippingAddress: { country: "AU" } }), "printify");
  assert.equal(printSupplierForOrder({ shippingAddress: { country: "NL" } }), "gelato");
});

test("desk copy names Printify as main except EU/UK", () => {
  assert.match(PRINTIFY_MAIN_HEADLINE, /Printify is the main supplier/);
  assert.match(PRINTIFY_MAIN_NOTE, /except the United Kingdom and the European Union/);
  assert.match(PRINTIFY_MAIN_NOTE, /Leave the saved connections as they are/);
  assert.doesNotMatch(PRINTIFY_MAIN_NOTE, /cannot replace Gelato as the live print platform/);
});
