import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  CATALOG_LISTING_TAGS,
  LISTING_TAG_LIMIT,
  fillListingTags,
  listingGallery,
  listingHealth,
  tagsForListing,
} from "./listing-health.ts";
import { FERNORA_PRINTIFY_STARTERS } from "./printify-products.ts";
import { listingAdsRate, OFFSITE_ADS_RATE } from "./money.ts";
import { catalogLanes, catalogPrice, PRINTIFY_PRINT_NZD, printifyShipUsd } from "./printify-costs.ts";

test("current and future listings fill 13 unique tags under 20 characters", () => {
  const tags = fillListingTags(["fern", "poster"], ["nz art", "Quotes"]);
  assert.equal(tags.length, LISTING_TAG_LIMIT);
  assert.equal(new Set(tags.map((tag) => tag.toLowerCase())).size, LISTING_TAG_LIMIT);
  assert.ok(tags.every((tag) => tag.length > 0 && tag.length <= 20));
  assert.ok(tags.includes("Quotes"));
});

test("live catalog and Printify starters share 13 listing-health tags", () => {
  const catalog = readFileSync(new URL("./live-catalog.ts", import.meta.url), "utf8");
  const mixLabels = ["Original fern", "Quotes", "Botanical", "Scenic", "Home décor"];
  for (const spec of FERNORA_PRINTIFY_STARTERS) {
    assert.equal(spec.tags.length, 13, spec.key);
    assert.deepEqual(spec.tags, CATALOG_LISTING_TAGS[spec.key]);
    assert.deepEqual(spec.tags, tagsForListing(spec.key));
    assert.ok(mixLabels.some((label) => spec.tags.includes(label)), spec.key);
    assert.match(catalog, new RegExp(`id: "${spec.key}"[\\s\\S]*tags: tagsForListing\\("${spec.key}"\\)`));
    const health = listingHealth({ tags: spec.tags, gallery: listingGallery(spec.key) });
    assert.equal(health.tagsOk, true);
  }
});

test("gallery lists the listing photo, print file, and extra stills", () => {
  const files = listingGallery("live_poster");
  assert.ok(files.includes("/catalog/catalog-poster.png"));
  assert.ok(files.includes("/catalog/print-poster-fern-arc.png"));
  assert.ok(files.includes("/catalog/gallery-live_poster-detail.png"));
  const sneakers = listingGallery("live_sneaker_star");
  assert.ok(sneakers.includes("/catalog/catalog-star-sneakers-angle.jpg"));
  assert.ok(sneakers.includes("/catalog/gallery-live_sneaker_star-model.jpg"));
  assert.ok(sneakers.includes("/catalog/gallery-live_sneaker_star-model-2.jpg"));
});

test("prices use Printify costs and do not pad for opted-out Offsite Ads", () => {
  assert.equal(listingAdsRate(), 0);
  assert.equal(OFFSITE_ADS_RATE, 0.15);
  assert.equal(PRINTIFY_PRINT_NZD.live_poster, 9.28);
  const nz = catalogLanes("live_poster").find((lane) => lane.region === "NZ");
  const gb = catalogLanes("live_poster").find((lane) => lane.region === "GB");
  assert.equal(nz?.printer, "printify");
  assert.equal(nz?.printCost, 9.28);
  assert.equal(gb?.printer, "gelato");
  assert.ok(catalogPrice("live_poster") < 56.99);
  assert.equal(printifyShipUsd("poster", "US"), 5.99);
  assert.equal(printifyShipUsd("canvas", "NZ"), 18.29);
  const sneakerNz = catalogLanes("live_sneaker_star").find((lane) => lane.region === "NZ");
  const sneakerGb = catalogLanes("live_sneaker_star").find((lane) => lane.region === "GB");
  assert.equal(sneakerNz?.printer, "printify");
  assert.equal(sneakerGb?.printer, "printify");
  assert.equal(PRINTIFY_PRINT_NZD.live_sneaker_star, 37.77);
  assert.equal(catalogPrice("live_sneaker_star"), 83.99);
});

test("Catalog table shows Printify costs and current ads, not Offsite 15%", () => {
  const page = readFileSync(new URL("../app/listings/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Printer/);
  assert.match(page, /Printify print cost/);
  assert.match(page, /Meta daily cap/);
  assert.doesNotMatch(page, /After ads/);
  assert.doesNotMatch(page, /After Offsite Ads/);
});
