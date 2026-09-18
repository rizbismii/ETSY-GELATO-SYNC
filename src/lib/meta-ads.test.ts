import assert from "node:assert/strict";
import { test } from "node:test";
import {
  explainMetaConnectError,
  isMetaAccountDisabledError,
  META_ACCOUNT_DISABLED_HELP,
} from "./meta-connect-error.ts";
import {
  clampMetaDailyBudget,
  dailyBudgetToMinor,
  META_ADS_DAILY_BUDGET_DEFAULT,
  META_ADS_DAILY_BUDGET_MAX,
  META_ADS_DAILY_BUDGET_MIN,
  META_ADS_LANDING_URL,
  metaPixelSnippet,
  metaPurchasePayload,
  normalizeAdAccountId,
  normalizePixelId,
  withMetaPixelInTheme,
} from "./meta-budget.ts";

test("Meta daily budget stays on a low cap", () => {
  assert.equal(clampMetaDailyBudget(5), META_ADS_DAILY_BUDGET_DEFAULT);
  assert.equal(clampMetaDailyBudget(1), META_ADS_DAILY_BUDGET_MIN);
  assert.equal(clampMetaDailyBudget(99), META_ADS_DAILY_BUDGET_MAX);
  assert.equal(dailyBudgetToMinor(5), 500);
  assert.equal(META_ADS_LANDING_URL, "https://fernora.nz");
});

test("ad account and pixel IDs normalize", () => {
  assert.equal(normalizeAdAccountId("act_123"), "act_123");
  assert.equal(normalizeAdAccountId("123"), "act_123");
  assert.equal(normalizePixelId(" 998877 "), "998877");
  assert.equal(normalizePixelId("abc"), "");
});

test("theme pixel snippet inits the Pixel and can be replaced", () => {
  const first = metaPixelSnippet("111");
  assert.match(first, /fernora-meta-pixel/);
  assert.match(first, /fbq\('init', "111"\)/);
  assert.doesNotMatch(first, /Gelato/);
  const injected = withMetaPixelInTheme("<html><head></head></html>", "111");
  assert.match(injected, /fbq\('init', "111"\)/);
  const replaced = withMetaPixelInTheme(injected, "222");
  assert.match(replaced, /fbq\('init', "222"\)/);
  assert.doesNotMatch(replaced, /"111"/);
});

test("disabled Facebook logins get a Pressroom-safe Meta error", () => {
  assert.equal(explainMetaConnectError("We've disabled your account", 190, 459), META_ACCOUNT_DISABLED_HELP);
  assert.equal(isMetaAccountDisabledError("Community Standards on account integrity"), true);
  assert.equal(explainMetaConnectError("Invalid OAuth access token"), "Invalid OAuth access token");
  assert.equal(isMetaAccountDisabledError("Invalid OAuth access token"), false);
});

test("CAPI purchase hashes email and keeps the shop URL", () => {
  const payload = metaPurchasePayload({
    eventId: "ord_1",
    email: "Buyer@FERNORA.NZ",
    value: 61,
    currency: "NZD",
    eventTime: 1700000000,
  });
  assert.equal(payload.data[0].event_name, "Purchase");
  assert.equal(payload.data[0].event_source_url, "https://fernora.nz");
  assert.equal(payload.data[0].custom_data.value, 61);
  assert.equal(payload.data[0].user_data.em?.[0]?.length, 64);
  assert.notEqual(payload.data[0].user_data.em?.[0], "Buyer@FERNORA.NZ");
});
