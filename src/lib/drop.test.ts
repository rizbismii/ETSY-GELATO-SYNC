import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("live catalog covers every mix plus sneakers and the embroidered zip hoodie", () => {
  const catalog = readFileSync(new URL("./live-catalog.ts", import.meta.url), "utf8");
  const liveIds = [...catalog.matchAll(/^\s+id: "(live_[^"]+)"/gm)].map((row) => row[1]);
  assert.deepEqual(liveIds, [
    "live_poster",
    "live_quote_breathe",
    "live_botanical_kowhai",
    "live_canvas_harbour",
    "live_frame_kind",
    "live_sneaker_star",
    "live_sneaker_star_w",
    "live_hoodie_bloom",
    "live_tee_bloom",
  ]);
  assert.match(catalog, /LIVE_CATALOG_IDS/);
  assert.match(catalog, /collection: "original"/);
  assert.match(catalog, /collection: "quote"/);
  assert.match(catalog, /collection: "botanical"/);
  assert.match(catalog, /collection: "scenic"/);
  assert.match(catalog, /collection: "home"/);
  assert.match(catalog, /export const ETSY_KNOWN_LISTINGS[\s\S]*= \{\}/);
  assert.match(catalog, /STALE_ETSY_LISTINGS/);
  assert.match(catalog, /RETIRED_CATALOG_IDS/);
  assert.match(catalog, /title: "Black Camo · Men’s Mesh Sneakers"/);
  assert.match(catalog, /title: "Southern Cross Star · Women’s Mesh Sneakers"/);
  assert.match(catalog, /title: "Grow With Purpose · Embroidered Zip Hoodie"/);
  assert.match(catalog, /title: "Grow With Purpose · Embroidered Heavy Cotton Tee"/);
  assert.match(catalog, /variants: sneakerVariants\("live_sneaker_star"/);
  assert.match(catalog, /variants: zipHoodieVariants\("live_hoodie_bloom"\)/);
  assert.match(catalog, /variants: teeVariants\("live_tee_bloom"\)/);
  assert.doesNotMatch(catalog, /id: "live_hoodie"/);
});

test("Pressroom catalog strips stale Etsy IDs and keeps retired products tombstoned", () => {
  const drop = readFileSync(new URL("./drop.ts", import.meta.url), "utf8");
  assert.match(drop, /RETIRED_CATALOG_IDS/);
  assert.match(drop, /isStaleEtsyListingId/);
  assert.match(drop, /isStaleGelatoProductId/);
  assert.match(drop, /writeDeletedListingIds\(nextDeleted\)/);
  assert.doesNotMatch(drop, /clearDeletedListings/);
  assert.doesNotMatch(drop, /Bring the 20-item mix back/);
  const printify = readFileSync(new URL("./printify.ts", import.meta.url), "utf8");
  assert.match(printify, /deleteOlderGelatoProducts/);
  assert.match(printify, /inactivateOlderEtsyListings/);
  assert.match(printify, /deleteOlderShopifyProducts/);
  assert.match(printify, /syncFernoraCatalogToShopify/);
  assert.match(printify, /fillShopifyCollections/);
  assert.match(printify, /attachPrintifyEtsyIds/);
  assert.match(printify, /refreshPrintifyCatalogItem/);
  assert.match(printify, /upsertPrintifyCatalogItem/);
  assert.match(printify, /pullPrintifyVariantPhotos/);
  assert.doesNotMatch(printify, /clearDeletedListings/);
});
