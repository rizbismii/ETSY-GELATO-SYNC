import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  gelatoCodesForLane,
  gelatoDestination,
  GELATO_SHIP_BLURB,
  isGelatoCountry,
  shipLaneForCountry,
} from "./gelato-countries.ts";
import {
  CATALOG_ART_PAIRS,
  isForeignPrintFile,
  printFileForListing,
  printFileName,
  printSurface,
  printTreatment,
} from "./print-file.ts";
import {
  gelatoCarrierRateResponse,
  shippingToCarrierCents,
  carrierDestinationCountry,
  carrierLineItems,
} from "./shopify-carrier.ts";

test("Gelato destinations include AU, NZ, and other print countries", () => {
  assert.equal(isGelatoCountry("NZ"), true);
  assert.equal(isGelatoCountry("AU"), true);
  assert.equal(isGelatoCountry("US"), true);
  assert.equal(isGelatoCountry("GB"), true);
  assert.equal(isGelatoCountry("FR"), true);
  assert.equal(isGelatoCountry("DE"), true);
  assert.equal(isGelatoCountry("JP"), false);
  assert.equal(isGelatoCountry("IN"), false);
  assert.equal(isGelatoCountry("SG"), true);
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

test("print files stay paired to their own listing mockup", () => {
  assert.equal(CATALOG_ART_PAIRS.length, 8);
  assert.equal(printFileForListing("live_poster"), "/catalog/print-poster-fern-arc.png");
  assert.equal(printFileForListing("live_sneaker_star"), "/catalog/print-camo-sneakers.png");
  assert.equal(printFileForListing("live_sneaker_star_w"), "/catalog/print-star-sneakers.png");
  assert.equal(printFileForListing("live_hoodie_bloom"), "/catalog/print-hoodie-bloom.png");
  assert.equal(
    printFileForListing("live_quote_breathe", "/catalog/print-poster-fern-arc.png"),
    "/catalog/print-breathe-here.png",
  );
  assert.equal(isForeignPrintFile("live_quote_breathe", "/catalog/print-poster-fern-arc.png"), true);
  assert.equal(isForeignPrintFile("live_poster", "/catalog/print-poster-fern-arc.png"), false);
  assert.equal(printFileForListing("future_print"), "");
});

test("Shopify carrier callback quotes destination rates in cents", () => {
  assert.equal(shippingToCarrierCents(10.09), "1009");
  assert.equal(carrierDestinationCountry({ rate: { destination: { country: "au" } } }), "AU");
  assert.deepEqual(carrierLineItems({ rate: { items: [{ sku: "live_poster", quantity: 2 }] } }), [
    { sku: "live_poster", title: undefined, quantity: 2 },
  ]);
  const payload = gelatoCarrierRateResponse({
    serviceName: "Standard delivery",
    lane: "AU",
    country: "AU",
    currency: "NZD",
    days: "3–10 days",
    shipping: 12.76,
  });
  assert.equal(payload.rates[0].service_name, "Standard delivery");
  assert.equal(payload.rates[0].total_price, "1276");
  assert.equal(payload.rates[0].service_code, "gelato-AU");
});

test("ship blurb matches the live country set and does not name Gelato", () => {
  const source = readFileSync(new URL("./gelato-countries.ts", import.meta.url), "utf8");
  assert.match(source, /selected countries in the Americas, Asia, and the Middle East/);
  assert.doesNotMatch(source, /other countries Gelato delivers to/);
  assert.doesNotMatch(source, /Printed near the buyer by Gelato/);
  assert.equal(isGelatoCountry("KR"), false);
  assert.equal(isGelatoCountry("PH"), false);
  assert.equal(isGelatoCountry("ID"), false);
  assert.equal(isGelatoCountry("VN"), false);
});

test("returns policy follows made-to-order rules without naming the printer", () => {
  const source = readFileSync(new URL("./shop-policies.ts", import.meta.url), "utf8");
  assert.match(source, /30 days/);
  assert.match(source, /change of mind/);
  assert.match(source, /do not provide a return address/);
  assert.match(source, /country name and currency code/);
  assert.doesNotMatch(source, /Gelato/);
});

test("Horizon branding shows country · currency and made-to-order homepage copy", () => {
  const source = readFileSync(new URL("./shopify-horizon.ts", import.meta.url), "utf8");
  assert.match(source, /localization\.country\.name \}\} · \{\{ localization\.country\.currency\.iso_code/);
  assert.match(source, /snippets\/header-drawer\.liquid/);
  assert.match(source, /Original botanicals for considered homes/);
  assert.match(source, /Made to order\.<br>Never warehoused/);
  assert.match(source, /Shop by series/);
  assert.match(source, /privacyFeaturesDisable|publishGelatoLegalPages|installFernoraMetaPixel/);
  assert.match(source, /product_grid_width = "full-width"/);
  assert.match(source, /content_direction: "row"/);
  assert.match(source, /vertical_on_mobile: true/);
  assert.match(source, /menu_style = "text"/);
  assert.match(source, /page_width = "normal"/);
  assert.match(source, /story_fernora/);
  assert.match(source, /Nothing is stored in a warehouse/);
  assert.doesNotMatch(source, /Printed to order/);
  assert.match(source, /Quality guarantee/);
  assert.match(source, /"padding-block-start": 8/);
  assert.match(source, /title: series\.label/);
  assert.match(source, /CATALOG_SERIES/);
  assert.match(source, /All, Quotes, Botanical, Scenic, Home décor, and Original fern/);
  assert.match(source, /fernora-product-layout/);
  assert.match(source, /fernora-product-gallery/);
  assert.match(source, /body\.template-index #MainContent \.section--page-width/);
  assert.match(source, /sticky_details_desktop = false/);
  assert.match(source, /media_presentation = "grid"/);
  assert.doesNotMatch(source, /by Gelato/);
  assert.doesNotMatch(source, /Gelato quality/);
});

test("customer-facing shop copy does not name Gelato as the supplier", () => {
  assert.doesNotMatch(GELATO_SHIP_BLURB, /Gelato/);
  assert.doesNotMatch(readFileSync(new URL("./shop-policies.ts", import.meta.url), "utf8"), /Gelato/);
  const quoteSource = readFileSync(new URL("./shop.ts", import.meta.url), "utf8");
  assert.match(quoteSource, /serviceName: "Standard delivery"/);
  const shopifySource = readFileSync(new URL("./shopify.ts", import.meta.url), "utf8");
  assert.match(shopifySource, /title: "Standard delivery"/);
  assert.match(shopifySource, /name: "Standard delivery"/);
  assert.match(shopifySource, /stagedUploadsCreate/);
  assert.match(shopifySource, /name: "Size"/);
  assert.match(shopifySource, /productDeleteMedia/);
  assert.match(shopifySource, /existsSync/);
  assert.match(shopifySource, /black-camo-mens-mesh-sneakers/);
  assert.doesNotMatch(shopifySource, /escapeHtml\(GELATO_SHIP_BLURB\)/);
  const carrierSource = readFileSync(new URL("./shopify-storefront.ts", import.meta.url), "utf8");
  assert.match(carrierSource, /FERNORA_CARRIER_NAME = "Fernora"/);
  const pages = [
    "../app/shop/layout.tsx",
    "../app/shop/page.tsx",
    "../app/shop/shop-header.tsx",
    "../app/shop/checkout/page.tsx",
    "../app/shop/order/[id]/ui.tsx",
    "../app/shop/products/[id]/ui.tsx",
    "../app/api/shop/catalog/route.ts",
    "../app/api/shop/checkout/route.ts",
  ];
  for (const file of pages) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\bGelato\b/, file);
  }
  const productPage = readFileSync(new URL("../app/shop/products/[id]/ui.tsx", import.meta.url), "utf8");
  assert.match(productPage, /clothingColors\.length > 1/);
});

test("Catalog dropdown order is All, Quotes, Botanical, Scenic, Home décor, Original fern", () => {
  const menu = readFileSync(new URL("./catalog-menu.ts", import.meta.url), "utf8");
  assert.match(
    menu,
    /id: "all"[\s\S]*id: "quote"[\s\S]*id: "botanical"[\s\S]*id: "scenic"[\s\S]*id: "home"[\s\S]*id: "original"/,
  );
  const shop = readFileSync(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
  const listings = readFileSync(new URL("../app/listings/page.tsx", import.meta.url), "utf8");
  assert.match(shop, /CATALOG_MENU/);
  assert.match(listings, /CATALOG_MENU/);
  assert.match(listings, /aspect-\[4\/5\]/);
  assert.match(listings, /Printer/);
  assert.doesNotMatch(listings, /lg:h-full/);
  assert.doesNotMatch(listings, /After ads/);
});

test("markets pin countries without presentment currency to USD", () => {
  const source = readFileSync(new URL("./shopify-storefront.ts", import.meta.url), "utf8");
  assert.match(source, /USD_FALLBACK_COUNTRIES/);
  assert.match(source, /international-usd/);
  assert.match(source, /localCurrencies: false/);
  assert.match(source, /"AR"/);
  assert.match(source, /syncShopifyPresentmentPrices/);
});
