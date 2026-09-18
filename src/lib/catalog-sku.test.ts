import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clothingVariants,
  parseClothingSku,
  resolveCatalogLine,
} from "./clothing.ts";

const hoodie = {
  id: "live_hoodie",
  title: "Fern Mark Hoodie",
  gelatoProductUid: "apparel_product_gca_hoodie_gsc_pullover_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0",
  printFileUrl: "/catalog/print-hoodie-fern-mark.png",
  variants: clothingVariants("live_hoodie", "hoodie"),
};

const poster = {
  id: "live_poster",
  title: "Fern Arc Poster · A3",
  gelatoProductUid: "poster-uid",
  printFileUrl: "/catalog/print-poster-fern-arc.png",
};

const catalog = [hoodie, poster];

test("parseClothingSku splits product, color, and size", () => {
  assert.deepEqual(parseClothingSku("live_hoodie-white-l"), {
    productId: "live_hoodie",
    colorUid: "white",
    sizeUid: "l",
  });
  assert.equal(parseClothingSku("live_poster"), undefined);
});

test("resolveCatalogLine maps a clothing SKU to the Gelato UID for that variant", () => {
  const line = resolveCatalogLine(catalog, "live_hoodie-white-l");
  assert.ok(line);
  assert.equal(line.listingId, "live_hoodie");
  assert.equal(line.variant?.colorUid, "white");
  assert.equal(line.variant?.sizeUid, "l");
  assert.equal(
    line.gelatoProductUid,
    "apparel_product_gca_hoodie_gsc_pullover_gcu_unisex_gqa_classic_gsi_l_gco_white_gpr_4-0",
  );
  assert.equal(line.printFileUrl, hoodie.printFileUrl);
  assert.equal(line.variation, "White · L");
});

test("resolveCatalogLine keeps a single-variant product on its own SKU", () => {
  const line = resolveCatalogLine(catalog, "live_poster");
  assert.ok(line);
  assert.equal(line.listingId, "live_poster");
  assert.equal(line.gelatoProductUid, "poster-uid");
  assert.equal(line.variant, undefined);
});

test("resolveCatalogLine falls back to title when SKU is missing", () => {
  const line = resolveCatalogLine(catalog, "", "Fern Mark Hoodie · Navy · M");
  assert.ok(line);
  assert.equal(line.listingId, "live_hoodie");
  assert.equal(line.variant?.colorUid, "navy");
  assert.equal(line.variant?.sizeUid, "m");
});
