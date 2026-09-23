import { getCredentials } from "@/lib/credentials";
import { getShop, updateShop } from "@/lib/store";
import type { MetaAdsCampaign } from "@/lib/types";
import { explainMetaConnectError, isMetaAppDevelopmentError } from "@/lib/meta-connect-error";
import {
  clampMetaDailyBudget,
  dailyBudgetToMinor,
  META_ADS_AD_NAME,
  META_ADS_ADSET_NAME,
  META_ADS_CAMPAIGN_NAME,
  META_ADS_DAILY_BUDGET_DEFAULT,
  META_ADS_LANDING_URL,
  metaPurchasePayload,
  normalizeAdAccountId,
  normalizePixelId,
  type MetaGraphAssets,
} from "@/lib/meta-budget";

export {
  clampMetaDailyBudget,
  dailyBudgetToMinor,
  META_ADS_AD_NAME,
  META_ADS_ADSET_NAME,
  META_ADS_CAMPAIGN_NAME,
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
} from "@/lib/meta-budget";
export {
  explainMetaConnectError,
  isMetaAccountDisabledError,
  isMetaTokenExpiredError,
  META_ACCOUNT_DISABLED_HELP,
  META_APP_DEVELOPMENT_HELP,
  META_TOKEN_EXPIRED_HELP,
} from "@/lib/meta-connect-error";

const GRAPH = "https://graph.facebook.com/v21.0";

type GraphError = {
  error?: {
    message?: string;
    error_user_msg?: string;
    error_user_title?: string;
    code?: number;
    error_subcode?: number;
  };
};

async function graph<T>(
  path: string,
  init?: { method?: string; search?: Record<string, string>; body?: Record<string, unknown>; token?: string },
) {
  const creds = await getCredentials();
  const token = init?.token || creds.meta?.accessToken;
  if (!token) throw new Error("Save a Meta access token on Ads first");
  const url = new URL(`${GRAPH}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(init?.search || {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: init?.method || "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as T & GraphError;
  if (!response.ok || json.error) {
    throw new Error(
      explainMetaConnectError(
        json.error?.error_user_msg || json.error?.error_user_title || json.error?.message,
        json.error?.code,
        json.error?.error_subcode,
      ) || `Meta API ${response.status}`,
    );
  }
  return json as T;
}

export type { MetaGraphAssets, MetaGraphPage } from "@/lib/meta-budget";

export async function discoverMetaAssets(token?: string): Promise<MetaGraphAssets> {
  const me = await graph<{ id: string; name?: string }>("/me", { token, search: { fields: "id,name" } });
  const accounts = await graph<{
    data?: Array<{ id: string; name?: string; currency?: string; account_status?: number }>;
  }>("/me/adaccounts", {
    token,
    search: { fields: "id,name,account_id,currency,account_status", limit: "25" },
  });
  const pages = await graph<{
    data?: Array<{ id: string; name?: string; instagram_business_account?: { id: string } }>;
  }>("/me/accounts", {
    token,
    search: { fields: "id,name,instagram_business_account", limit: "25" },
  });
  const creds = await getCredentials();
  const prefer = normalizeAdAccountId(creds.meta?.adAccountId) || accounts.data?.[0]?.id || "";
  let pixels: Array<{ id: string; name?: string }> = [];
  if (prefer) {
    const listed = await graph<{ data?: Array<{ id: string; name?: string }> }>(`/${prefer}/adspixels`, {
      token,
      search: { fields: "id,name" },
    });
    pixels = listed.data || [];
  }
  return {
    user: me.name || me.id,
    adAccounts: accounts.data || [],
    pages: (pages.data || []).map((page) => ({
      id: page.id,
      name: page.name,
      instagramUserId: page.instagram_business_account?.id,
    })),
    pixels,
  };
}

export async function pingMetaAds() {
  const creds = await getCredentials();
  const accountId = normalizeAdAccountId(creds.meta?.adAccountId);
  if (!creds.meta?.accessToken) throw new Error("Paste a Meta access token");
  if (!accountId) throw new Error("Paste a Meta ad account ID (act_…)");
  const me = await graph<{ id: string; name?: string }>("/me", { search: { fields: "id,name" } });
  const account = await graph<{
    id: string;
    name?: string;
    account_id?: string;
    currency?: string;
    account_status?: number;
  }>(`/${accountId}`, { search: { fields: "id,name,account_id,currency,account_status" } });
  const pageId = creds.meta.pageId?.trim() || "";
  let instagramUserId = creds.meta.instagramUserId?.trim() || "";
  if (pageId) {
    try {
      const page = await graph<{ instagram_business_account?: { id: string } }>(`/${pageId}`, {
        search: { fields: "instagram_business_account" },
      });
      instagramUserId = page.instagram_business_account?.id || instagramUserId;
    } catch {
      // Page read can fail without pages_read_engagement; keep the saved Instagram id.
    }
  }
  return {
    user: me.name || me.id,
    accountId,
    accountName: account.name,
    currency: account.currency || "USD",
    pixelId: normalizePixelId(creds.meta.pixelId) || undefined,
    pageId: pageId || undefined,
    instagramUserId: instagramUserId || undefined,
    instagramConnected: Boolean(instagramUserId),
  };
}

export function defaultMetaCampaign(): MetaAdsCampaign {
  return {
    dailyBudget: META_ADS_DAILY_BUDGET_DEFAULT,
    landingUrl: META_ADS_LANDING_URL,
    status: "draft",
  };
}

export async function readMetaCampaign() {
  const shop = await getShop();
  return shop.metaAds || defaultMetaCampaign();
}

async function saveMetaCampaign(patch: Partial<MetaAdsCampaign>) {
  let saved: MetaAdsCampaign = defaultMetaCampaign();
  await updateShop((shop) => {
    saved = {
      ...defaultMetaCampaign(),
      ...shop.metaAds,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    shop.metaAds = saved;
  });
  return saved;
}

export async function upsertMetaCampaign(input: { dailyBudget?: number; live?: boolean }) {
  const accountId = normalizeAdAccountId((await getCredentials()).meta?.adAccountId);
  if (!accountId) throw new Error("Save the Meta ad account ID first");
  const ping = await pingMetaAds();
  const dailyBudget = clampMetaDailyBudget(input.dailyBudget ?? (await readMetaCampaign()).dailyBudget);
  const current = await readMetaCampaign();
  const status = input.live ? "ACTIVE" : "PAUSED";
  const notes: string[] = [];

  const existingCampaigns = await graph<{ data?: Array<{ id: string; name?: string }> }>(`/${accountId}/campaigns`, {
    search: { fields: "id,name", limit: "25" },
  });
  const namedCampaignId = existingCampaigns.data?.find((row) => row.name === META_ADS_CAMPAIGN_NAME)?.id;
  const campaignId =
    current.campaignId ||
    namedCampaignId ||
    (
      await graph<{ id: string }>(`/${accountId}/campaigns`, {
        method: "POST",
        body: {
          name: META_ADS_CAMPAIGN_NAME,
          objective: "OUTCOME_TRAFFIC",
          status: "PAUSED",
          special_ad_categories: [],
          // Ad-set daily cap (not CBO). False keeps the 5/day limit on this one ad set.
          is_adset_budget_sharing_enabled: false,
        },
      })
    ).id;
  notes.push(current.campaignId ? "Campaign already on this ad account." : "Created the Fernora · Pressroom campaign.");

  const targeting = {
    geo_locations: { countries: ["NZ", "AU"] },
    age_min: 25,
    age_max: 65,
  };
  const existingAdSets = await graph<{ data?: Array<{ id: string; name?: string; campaign_id?: string }> }>(
    `/${accountId}/adsets`,
    { search: { fields: "id,name,campaign_id", limit: "25" } },
  );
  const namedAdSetId = existingAdSets.data?.find(
    (row) => row.name === META_ADS_ADSET_NAME && row.campaign_id === campaignId,
  )?.id;
  const adSetId =
    current.adSetId ||
    namedAdSetId ||
    (
      await graph<{ id: string }>(`/${accountId}/adsets`, {
        method: "POST",
        body: {
          name: META_ADS_ADSET_NAME,
          campaign_id: campaignId,
          daily_budget: dailyBudgetToMinor(dailyBudget),
          billing_event: "IMPRESSIONS",
          optimization_goal: "LINK_CLICKS",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          destination_type: "WEBSITE",
          targeting,
          status: "PAUSED",
        },
      })
    ).id;
  if (current.adSetId) {
    await graph(`/${adSetId}`, {
      method: "POST",
      body: { daily_budget: dailyBudgetToMinor(dailyBudget), targeting, status },
    });
    notes.push(`Ad set budget set to ${dailyBudget} ${ping.currency}/day.`);
  } else {
    notes.push(`Ad set created at ${dailyBudget} ${ping.currency}/day for New Zealand and Australia.`);
  }

  let creativeId = current.creativeId;
  let adId = current.adId;
  if (ping.pageId) {
    try {
      if (!creativeId) {
        const storySpec: Record<string, unknown> = {
          page_id: ping.pageId,
          link_data: {
            message: "Original botanicals for considered homes.",
            link: META_ADS_LANDING_URL,
            name: "Fernora",
            description: "Prints, apparel, and objects — priced in your currency.",
            call_to_action: { type: "SHOP_NOW", value: { link: META_ADS_LANDING_URL } },
          },
        };
        if (ping.instagramUserId) storySpec.instagram_user_id = ping.instagramUserId;
        const created = await graph<{ id: string }>(`/${accountId}/adcreatives`, {
          method: "POST",
          body: {
            name: META_ADS_AD_NAME,
            object_story_spec: storySpec,
          },
        });
        creativeId = created.id;
        notes.push(
          ping.instagramUserId
            ? "Ad creative points shoppers to fernora.nz on Facebook and Instagram."
            : "Ad creative points shoppers to fernora.nz.",
        );
      }
      if (!adId && creativeId) {
        const created = await graph<{ id: string }>(`/${accountId}/ads`, {
          method: "POST",
          body: {
            name: META_ADS_AD_NAME,
            adset_id: adSetId,
            creative: { creative_id: creativeId },
            status,
          },
        });
        adId = created.id;
        notes.push("Meta ad created and linked to Pressroom.");
      } else if (adId) {
        await graph(`/${adId}`, { method: "POST", body: { status } });
      }
    } catch (error) {
      notes.push((error as Error).message);
    }
  } else {
    notes.push("Add a Facebook Page ID to publish the ad creative. The campaign budget is ready without it.");
  }
  if (ping.pageId && !ping.instagramUserId) {
    notes.push(
      "Instagram is not linked to the Fernora Page yet. Facebook placements still work. In Business Suite, connect the Instagram professional account to the Page, then Save again.",
    );
  }

  if (current.campaignId) {
    await graph(`/${campaignId}`, {
      method: "POST",
      body: {
        status: input.live ? "ACTIVE" : "PAUSED",
        is_adset_budget_sharing_enabled: false,
      },
    });
  }

  const saved = await saveMetaCampaign({
    campaignId,
    adSetId,
    adId,
    creativeId,
    dailyBudget,
    currency: ping.currency,
    landingUrl: META_ADS_LANDING_URL,
    status: input.live ? "active" : "paused",
    lastError: notes.find((note) => isMetaAppDevelopmentError(note)),
    pixelInstalled: Boolean(ping.pixelId),
  });
  return { campaign: saved, notes, live: Boolean(input.live), currency: ping.currency };
}

export async function pauseMetaCampaign() {
  const current = await readMetaCampaign();
  if (current.adId) await graph(`/${current.adId}`, { method: "POST", body: { status: "PAUSED" } });
  if (current.adSetId) await graph(`/${current.adSetId}`, { method: "POST", body: { status: "PAUSED" } });
  if (current.campaignId) await graph(`/${current.campaignId}`, { method: "POST", body: { status: "PAUSED" } });
  return saveMetaCampaign({ status: "paused" });
}

export async function sendMetaPurchase(input: {
  eventId: string;
  email?: string;
  value: number;
  currency: string;
}) {
  const creds = await getCredentials();
  const pixelId = normalizePixelId(creds.meta?.pixelId);
  if (!pixelId || !creds.meta?.accessToken) return { skipped: true as const };
  const payload = metaPurchasePayload(input);
  await graph(`/${pixelId}/events`, { method: "POST", body: payload });
  return { skipped: false as const, eventId: input.eventId };
}
