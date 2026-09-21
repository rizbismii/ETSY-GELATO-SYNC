import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogPrice } from "./printify-costs.ts";
import { formatMoney } from "./money.ts";
import {
  amountInCurrency,
  listCentsInCurrency,
  printifyListCents,
  retailPriceInCurrency,
  SHOP_CURRENCY,
  usdToNzd,
} from "./shop-currency.ts";

test("catalog, Printify, and Etsy list in shop NZD; other currencies convert from that price", () => {
  assert.equal(SHOP_CURRENCY, "NZD");
  const sneakers = catalogPrice("live_sneaker_star");
  assert.equal(sneakers, 83.99);
  assert.equal(printifyListCents(sneakers), 8399);
  assert.equal(listCentsInCurrency(sneakers, "NZD"), 8399);
  assert.equal(retailPriceInCurrency(sneakers, "NZD"), 83.99);
  assert.equal(retailPriceInCurrency(sneakers, "USD"), 50.99);
  assert.equal(retailPriceInCurrency(sneakers, "AUD"), 68.99);
  assert.equal(retailPriceInCurrency(sneakers, "GBP"), 38.99);
  assert.equal(retailPriceInCurrency(sneakers, "EUR"), 44.99);
  assert.ok(retailPriceInCurrency(sneakers, "USD") !== sneakers);
  assert.equal(usdToNzd(18.69), 31.21);
  assert.equal(amountInCurrency(37.77, "USD"), 22.62);
});

test("upcoming products use the same NZD list helper, not a pasted USD number", () => {
  const futureNzd = catalogPrice("live_poster");
  assert.equal(retailPriceInCurrency(futureNzd, "USD"), 20.99);
  assert.equal(listCentsInCurrency(futureNzd, "USD"), 2099);
  assert.equal(printifyListCents(futureNzd), Math.round(futureNzd * 100));
  assert.equal(formatMoney(futureNzd), formatMoney(futureNzd, "NZD"));
  assert.match(formatMoney(futureNzd), /NZ\$/);
});

test("desk and Shopify sync keep shop NZD separate from presentment currencies", () => {
  const storefront = readFileSync(new URL("./shopify-storefront.ts", import.meta.url), "utf8");
  const listings = readFileSync(new URL("../app/listings/page.tsx", import.meta.url), "utf8");
  const money = readFileSync(new URL("./money.ts", import.meta.url), "utf8");
  assert.match(storefront, /syncShopifyPresentmentPrices/);
  assert.match(storefront, /retailPriceInCurrency/);
  assert.match(listings, /never paste the NZD number into a USD field/);
  assert.match(money, /currency = "NZD"/);
});
