import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clothingVariants,
  parseClothingSku,
  parseSneakerSku,
  resolveCatalogLine,
  sneakerVariants,
} from "./clothing.ts";
import { SNEAKER_WOMENS_WHITE_SOLE } from "./sneaker-sizes.ts";

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

test("resolveCatalogLine maps a sneaker size SKU to Printify mesh sneakers", () => {
  const sneakers = {
    id: "live_sneaker_star",
    title: "Black Camo · Men’s Mesh Sneakers",
    gelatoProductUid: "printify_mesh_sneakers_1072",
    printFileUrl: "/catalog/print-camo-sneakers.png",
    variants: sneakerVariants("live_sneaker_star", "printify_mesh_sneakers_1072"),
  };
  const line = resolveCatalogLine([sneakers], "live_sneaker_star-us-9-5");
  assert.ok(line);
  assert.equal(line.listingId, "live_sneaker_star");
  assert.equal(line.variant?.sizeUid, "9-5");
  assert.equal(line.variant?.size, "US 9.5");
  assert.equal(line.gelatoProductUid, "printify_mesh_sneakers_1072:80925");
  assert.equal(line.variation, "White sole · US 9.5");
  assert.equal(parseSneakerSku("live_sneaker_star-us-7-5")?.sizeUid, "7-5");
  assert.equal(sneakerVariants("live_sneaker_star", "printify_mesh_sneakers_1072").length, 9);
});

test("resolveCatalogLine maps a women’s sneaker size SKU to Printify 1219", () => {
  const sneakers = {
    id: "live_sneaker_star_w",
    title: "Southern Cross Star · Women’s Mesh Sneakers",
    gelatoProductUid: "printify_mesh_sneakers_1219",
    printFileUrl: "/catalog/print-star-sneakers.png",
    variants: sneakerVariants("live_sneaker_star_w", "printify_mesh_sneakers_1219", SNEAKER_WOMENS_WHITE_SOLE),
  };
  const line = resolveCatalogLine([sneakers], "live_sneaker_star_w-us-8");
  assert.ok(line);
  assert.equal(line.listingId, "live_sneaker_star_w");
  assert.equal(line.variant?.sizeUid, "8");
  assert.equal(line.variant?.size, "US 8");
  assert.equal(line.gelatoProductUid, "printify_mesh_sneakers_1219:92346");
  assert.equal(sneakerVariants("live_sneaker_star_w", "printify_mesh_sneakers_1219", SNEAKER_WOMENS_WHITE_SOLE).length, 9);
});
