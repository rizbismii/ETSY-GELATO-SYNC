import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  CATALOG_LISTING_TAGS,
  LISTING_TAG_LIMIT,
  customerListingGallery,
  fillListingTags,
  listingGallery,
  listingHealth,
  tagsForListing,
} from "./listing-health.ts";
import { FERNORA_PRINTIFY_STARTERS } from "./printify-products.ts";
import { listingAdsRate, OFFSITE_ADS_RATE } from "./money.ts";
import { catalogLanes, catalogPrice, PRINTIFY_PRINT_NZD, PRINTIFY_PRINT_USD, printifyShipUsd } from "./printify-costs.ts";

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
  assert.equal(files[1], "/catalog/gallery-live_poster-detail.png");
  assert.equal(files[2], "/catalog/gallery-live_poster-close.png");
  const sneakers = listingGallery("live_sneaker_star");
  assert.ok(sneakers.includes("/catalog/catalog-camo-sneakers-angle.jpg"));
  assert.ok(sneakers.includes("/catalog/gallery-live_sneaker_star-camo-model.jpg"));
  assert.ok(sneakers.includes("/catalog/gallery-live_sneaker_star-camo-detail.png"));
  assert.ok(sneakers.includes("/catalog/print-camo-sneakers.png"));
  const womens = listingGallery("live_sneaker_star_w");
  assert.ok(womens.includes("/catalog/catalog-star-sneakers-w-angle.jpg"));
  assert.ok(womens.includes("/catalog/gallery-live_sneaker_star_w-model.jpg"));
  const hoodie = listingGallery("live_hoodie_bloom");
  assert.ok(hoodie.includes("/catalog/catalog-hoodie-bloom.jpg"));
  assert.ok(hoodie.includes("/catalog/print-hoodie-bloom.png"));
  assert.ok(hoodie.includes("/catalog/gallery-live_hoodie_bloom-model.jpg"));
  assert.ok(hoodie.includes("/catalog/catalog-hoodie-bloom-ash.jpg"));
  assert.ok(hoodie.includes("/catalog/catalog-hoodie-bloom-light-pink.jpg"));
  assert.equal(hoodie[1], "/catalog/gallery-live_hoodie_bloom-detail.png");
  const tee = listingGallery("live_tee_bloom");
  assert.ok(tee.includes("/catalog/catalog-tee-bloom.jpg"));
  assert.ok(tee.includes("/catalog/print-tee-bloom.png"));
  assert.ok(tee.includes("/catalog/gallery-live_tee_bloom-model.jpg"));
  assert.ok(tee.includes("/catalog/catalog-tee-bloom-navy.jpg"));
  assert.ok(tee.includes("/catalog/gallery-live_tee_bloom-neck.jpg"));
  assert.equal(tee[1], "/catalog/gallery-live_tee_bloom-detail.png");
  assert.equal(tee[2], "/catalog/gallery-live_tee_bloom-close.png");
  const customer = customerListingGallery("live_tee_bloom");
  assert.equal(customer[0], "/catalog/catalog-tee-bloom.jpg");
  assert.equal(customer[1], "/catalog/gallery-live_tee_bloom-detail.png");
  assert.ok(!customer.some((file) => file.includes("/print-")));
});

test("prices use Printify costs and do not pad for opted-out Offsite Ads", () => {
  assert.equal(listingAdsRate(), 0);
  assert.equal(OFFSITE_ADS_RATE, 0.15);
  assert.equal(PRINTIFY_PRINT_USD.live_poster, 9.28);
  assert.equal(PRINTIFY_PRINT_NZD.live_poster, 15.5);
  const nz = catalogLanes("live_poster").find((lane) => lane.region === "NZ");
  const gb = catalogLanes("live_poster").find((lane) => lane.region === "GB");
  assert.equal(nz?.printer, "printify");
  assert.equal(nz?.printCost, 15.5);
  assert.equal(gb?.printer, "gelato");
  assert.ok(catalogPrice("live_poster") < 56.99);
  assert.equal(printifyShipUsd("poster", "US"), 5.99);
  assert.equal(printifyShipUsd("canvas", "NZ"), 18.29);
  const sneakerNz = catalogLanes("live_sneaker_star").find((lane) => lane.region === "NZ");
  const sneakerGb = catalogLanes("live_sneaker_star").find((lane) => lane.region === "GB");
  assert.equal(sneakerNz?.printer, "printify");
  assert.equal(sneakerGb?.printer, "printify");
  assert.equal(PRINTIFY_PRINT_USD.live_sneaker_star, 37.77);
  assert.equal(PRINTIFY_PRINT_NZD.live_sneaker_star, 63.08);
  assert.equal(catalogPrice("live_sneaker_star"), 133.99);
  const womensGb = catalogLanes("live_sneaker_star_w").find((lane) => lane.region === "GB");
  assert.equal(womensGb?.printer, "printify");
  assert.equal(catalogPrice("live_sneaker_star_w"), catalogPrice("live_sneaker_star"));
  assert.equal(PRINTIFY_PRINT_USD.live_hoodie_bloom, 41.23);
  assert.equal(PRINTIFY_PRINT_NZD.live_hoodie_bloom, 68.85);
  assert.equal(catalogPrice("live_hoodie_bloom"), 143.99);
  const hoodieGb = catalogLanes("live_hoodie_bloom").find((lane) => lane.region === "GB");
  assert.equal(hoodieGb?.printer, "printify");
  assert.equal(PRINTIFY_PRINT_USD.live_tee_bloom, 21.32);
  assert.equal(PRINTIFY_PRINT_NZD.live_tee_bloom, 35.6);
  assert.equal(catalogPrice("live_tee_bloom"), 75.99);
  const teeGb = catalogLanes("live_tee_bloom").find((lane) => lane.region === "GB");
  assert.equal(teeGb?.printer, "printify");
});

test("Catalog table shows Printify costs and current ads, not Offsite 15%", () => {
  const page = readFileSync(new URL("../app/listings/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Printer/);
  assert.match(page, /Printify print cost/);
  assert.match(page, /Meta daily cap/);
  assert.doesNotMatch(page, /After ads/);
  assert.doesNotMatch(page, /After Offsite Ads/);
});
