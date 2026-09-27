import assert from "node:assert/strict";
import test from "node:test";
import { TEE_PRINT_AREA, effectiveDpi, pixelsForInches, teePrintInches } from "./print-placement.ts";

test("the heavy cotton tee print box is 13.17 × 16.40 in at 300 DPI", () => {
  const inches = teePrintInches();
  assert.equal(Math.round(inches.width * 100) / 100, 13.17);
  assert.equal(Math.round(inches.height * 100) / 100, 16.4);
  assert.equal(pixelsForInches(inches.width, TEE_PRINT_AREA.dpi), TEE_PRINT_AREA.widthPx);
  assert.equal(pixelsForInches(inches.height, TEE_PRINT_AREA.dpi), TEE_PRINT_AREA.heightPx);
});

test("a 3951 px file stretched to 28.04 in reads about 140 DPI", () => {
  assert.equal(effectiveDpi(TEE_PRINT_AREA.widthPx, 28.04), 141);
  assert.equal(effectiveDpi(TEE_PRINT_AREA.heightPx, 35), 141);
});

test("28.04 × 35 in at 300 DPI needs 8412 × 10500 px", () => {
  assert.equal(pixelsForInches(28.04, 300), 8412);
  assert.equal(pixelsForInches(35, 300), 10500);
});
