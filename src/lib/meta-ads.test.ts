import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  explainMetaConnectError,
  isMetaAccountDisabledError,
  isMetaTokenExpiredError,
  META_ACCOUNT_DISABLED_HELP,
  META_APP_DEVELOPMENT_HELP,
  META_TOKEN_EXPIRED_HELP,
} from "./meta-connect-error.ts";
import {
  FERNORA_META_APP_ID,
  FERNORA_META_APP_NAME,
  FERNORA_META_WAIT_ENDED_ON,
} from "./meta-app.ts";
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
  pickMetaIds,
  withMetaPixelInTheme,
} from "./meta-budget.ts";
import {
  ETSY_CPC_ADS_ENABLED,
  ETSY_CPC_WAIT_DAYS_LEFT,
  ETSY_CPC_WAIT_NOTED_ON,
  ETSY_OFFSITE_ADS_ENABLED,
  ETSY_OFFSITE_OPTED_OUT_ON,
  listingAdsRate,
} from "./money.ts";

test("Meta daily budget stays on a low cap", () => {
  assert.equal(clampMetaDailyBudget(5), META_ADS_DAILY_BUDGET_DEFAULT);
  assert.equal(clampMetaDailyBudget(1), META_ADS_DAILY_BUDGET_MIN);
  assert.equal(clampMetaDailyBudget(99), META_ADS_DAILY_BUDGET_MAX);
  assert.equal(dailyBudgetToMinor(5), 500);
  assert.equal(META_ADS_LANDING_URL, "https://fernora.nz");
});

test("Etsy Offsite Ads stay opted out and CPC Ads are not activated", () => {
  assert.equal(ETSY_OFFSITE_ADS_ENABLED, false);
  assert.equal(ETSY_CPC_ADS_ENABLED, false);
  assert.equal(ETSY_OFFSITE_OPTED_OUT_ON, "19 September 2026");
  assert.equal(ETSY_CPC_WAIT_DAYS_LEFT, 6);
  assert.equal(ETSY_CPC_WAIT_NOTED_ON, "20 September 2026");
  assert.equal(listingAdsRate(), 0);
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
  assert.match(META_ACCOUNT_DISABLED_HELP, /same email cannot open Business Suite/i);
  assert.equal(explainMetaConnectError("Invalid OAuth access token"), "Invalid OAuth access token");
  assert.equal(isMetaAccountDisabledError("Invalid OAuth access token"), false);
});

test("expired Graph Explorer tokens ask for a Fernora Pressroom refresh", () => {
  const expired =
    "Error validating access token: Session has expired on Saturday, 19-Sep-26 03:00:00 PDT.";
  assert.equal(isMetaTokenExpiredError(expired, 190, 463), true);
  assert.equal(explainMetaConnectError(expired, 190, 463), META_TOKEN_EXPIRED_HELP);
  assert.match(META_TOKEN_EXPIRED_HELP, new RegExp(FERNORA_META_APP_ID));
  assert.match(META_TOKEN_EXPIRED_HELP, /Generate a new User Token/i);
  assert.equal(isMetaAccountDisabledError(expired, 190, 463), false);
});

test("development-mode Page ads get a Pressroom-safe Meta error", () => {
  const raw = "Ads creative post was created by an app that is in development mode. It must be in public to create this ad.";
  assert.equal(explainMetaConnectError(raw), META_APP_DEVELOPMENT_HELP);
  assert.match(META_APP_DEVELOPMENT_HELP, /switch the app to Live/);
  assert.match(META_APP_DEVELOPMENT_HELP, /fernora.nz\/policies\/privacy-policy/);
  assert.match(META_APP_DEVELOPMENT_HELP, /fernora.nz\/pages\/data-deletion/);
  assert.match(META_APP_DEVELOPMENT_HELP, /Do not Go live/);
});

test("campaign create keeps a hard ad-set cap and does not share budget", () => {
  const source = readFileSync(new URL("./meta-ads.ts", import.meta.url), "utf8");
  assert.match(source, /is_adset_budget_sharing_enabled: false/);
  assert.doesNotMatch(source, /is_adset_budget_sharing_enabled: true/);
});

test("Ads page uses the existing Fernora Pressroom app after the 48-hour wait", () => {
  const page = readFileSync(new URL("../app/ads/page.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("./meta-app.ts", import.meta.url), "utf8");
  assert.match(app, new RegExp(FERNORA_META_APP_ID));
  assert.match(app, new RegExp(FERNORA_META_APP_NAME));
  assert.match(app, new RegExp(FERNORA_META_WAIT_ENDED_ON));
  assert.match(page, /FERNORA_META_APP_ID/);
  assert.match(page, /FERNORA_META_WAIT_ENDED_ON/);
  assert.match(page, /instagram_basic/);
  assert.match(page, /Instagram professional ID/);
  assert.match(page, /Do not click/);
  assert.match(page, /switch the app to/i);
  assert.match(page, /FERNORA_META_DATA_DELETION_URL/);
  assert.doesNotMatch(page, /Create app/);
  assert.doesNotMatch(page, /\bGelato\b/);
});

test("pickMetaIds keeps saved Fernora IDs and fills Instagram from the Page", () => {
  const picked = pickMetaIds(
    {
      adAccounts: [{ id: "act_999" }],
      pages: [{ id: "page_other", name: "Other" }, { id: "page_fernora", name: "Fernora", instagramUserId: "ig_1" }],
      pixels: [{ id: "px_2" }],
    },
    { adAccountId: "act_1081027171182996", pageId: "page_fernora", pixelId: "1435089141828956" },
  );
  assert.equal(picked.adAccountId, "act_1081027171182996");
  assert.equal(picked.pageId, "page_fernora");
  assert.equal(picked.pixelId, "1435089141828956");
  assert.equal(picked.instagramUserId, "ig_1");
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
