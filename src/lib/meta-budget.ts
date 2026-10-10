import crypto from "node:crypto";

/** Shop home. Purchase events stay on this URL. */
export const META_ADS_SHOP_URL = "https://fernora.nz";
/** Click destination: the Fern Star bag already published on the shop. */
export const META_ADS_LANDING_URL =
  "https://fernora.nz/products/copy-of-purple-floral-waterproof-travel-bag-leakproof-duffle-with-vibrant-orchid-lily-print";
/** Clear square product photo from fernora.nz. Meta saves this into the ad account image library. */
export const META_ADS_IMAGE_URL =
  "https://fernora.nz/cdn/shop/files/1826055067722872459_2048.jpg";
export const META_ADS_CAMPAIGN_NAME = "Fernora · Pressroom";
export const META_ADS_ADSET_NAME = "Fernora storefront · NZ AU";
export const META_ADS_AD_NAME = "Fernora · fernora.nz";
/**
 * New Zealand, Australia, the United States, and Canada.
 * Peru and the other cheap-click countries stay off. Singapore stays off
 * until its beneficiary step is confirmed.
 */
export const META_ADS_COUNTRIES = ["NZ", "AU", "US", "CA"] as const;
/** Shown on EU ads: the brand the ad promotes, and the business that pays. */
export const META_ADS_DSA_BENEFICIARY = "Fernora";
export const META_ADS_DSA_PAYOR = "Fernora";
/** Verified Fernora business. Singapore ads must name this beneficiary and payer. */
export const META_ADS_BUSINESS_ID = "1613821157193235";

export function metaAdSetRegulation() {
  const body: Record<string, unknown> = {
    dsa_beneficiary: META_ADS_DSA_BENEFICIARY,
    dsa_payor: META_ADS_DSA_PAYOR,
  };
  if ((META_ADS_COUNTRIES as readonly string[]).includes("SG")) {
    body.regional_regulated_categories = ["SINGAPORE_UNIVERSAL"];
    body.regional_regulation_identities = {
      singapore_universal_beneficiary: META_ADS_BUSINESS_ID,
      singapore_universal_payer: META_ADS_BUSINESS_ID,
    };
  }
  return body;
}
/** Default daily cap in the ad-account currency (whole units). */
export const META_ADS_DAILY_BUDGET_DEFAULT = 5;
export const META_ADS_DAILY_BUDGET_MIN = 3;
export const META_ADS_DAILY_BUDGET_MAX = 15;

export function clampMetaDailyBudget(value: number) {
  const amount = Number.isFinite(value) ? value : META_ADS_DAILY_BUDGET_DEFAULT;
  return Math.min(META_ADS_DAILY_BUDGET_MAX, Math.max(META_ADS_DAILY_BUDGET_MIN, Math.round(amount)));
}

export function dailyBudgetToMinor(amount: number) {
  return clampMetaDailyBudget(amount) * 100;
}

export function normalizeAdAccountId(value?: string | null) {
  const digits = (value || "").replace(/^act_/i, "").replace(/\D/g, "");
  return digits ? `act_${digits}` : "";
}

export function normalizePixelId(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

export type MetaGraphPage = {
  id: string;
  name?: string;
  instagramUserId?: string;
};

export type MetaGraphAssets = {
  user?: string;
  adAccounts: Array<{ id: string; name?: string; currency?: string; account_status?: number }>;
  pages: MetaGraphPage[];
  pixels: Array<{ id: string; name?: string }>;
};

export function metaAdTargeting() {
  return {
    geo_locations: { countries: [...META_ADS_COUNTRIES] },
    age_min: 25,
    age_max: 65,
    // Keep the saved country list. Do not hand the audience to Advantage+.
    targeting_automation: { advantage_audience: 0 },
  };
}

export function metaAdStorySpec(input: { pageId: string; instagramUserId?: string }) {
  const storySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      message: "Fern Star waterproof travel bag, with ferns, stars, and hearts.",
      link: META_ADS_LANDING_URL,
      name: "Fern Star Waterproof Travel Bag",
      description: "Made to order. Checkout ships to the country you choose.",
      picture: META_ADS_IMAGE_URL,
      call_to_action: { type: "SHOP_NOW", value: { link: META_ADS_LANDING_URL } },
    },
  };
  if (input.instagramUserId) storySpec.instagram_user_id = input.instagramUserId;
  return storySpec;
}

export function pickMetaIds(
  assets: MetaGraphAssets,
  current: { adAccountId?: string; pageId?: string; pixelId?: string; instagramUserId?: string },
) {
  const adAccountId = normalizeAdAccountId(current.adAccountId) || assets.adAccounts[0]?.id || "";
  const namedPage = assets.pages.find((page) => /fernora/i.test(page.name || ""));
  const pageId = current.pageId?.trim() || namedPage?.id || assets.pages[0]?.id || "";
  const page = assets.pages.find((row) => row.id === pageId);
  const pixelId = normalizePixelId(current.pixelId) || assets.pixels[0]?.id || "";
  const instagramUserId =
    current.instagramUserId?.trim() ||
    page?.instagramUserId ||
    assets.pages.find((row) => row.instagramUserId)?.instagramUserId ||
    "";
  return { adAccountId, pageId, pixelId, instagramUserId };
}

export function metaPixelSnippet(pixelId: string) {
  const id = normalizePixelId(pixelId);
  if (!id) return "";
  return `{%- comment -%} fernora-meta-pixel {%- endcomment -%}
<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', ${JSON.stringify(id)});
  fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>`;
}

export function withMetaPixelInTheme(source: string, pixelId: string) {
  const snippet = metaPixelSnippet(pixelId);
  if (!snippet) return source;
  const start = source.indexOf("{%- comment -%} fernora-meta-pixel");
  if (start >= 0) {
    const after = source.indexOf("</noscript>", start);
    const end = after >= 0 ? after + "</noscript>".length : source.indexOf("</head>", start);
    if (end > start) return `${source.slice(0, start)}${snippet}${source.slice(end)}`;
  }
  if (source.includes("</head>")) return source.replace("</head>", `${snippet}\n</head>`);
  return `${source}\n${snippet}\n`;
}

function sha256(value?: string) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;
  return crypto.createHash("sha256").update(trimmed).digest("hex");
}

export function metaPurchasePayload(input: {
  eventId: string;
  email?: string;
  value: number;
  currency: string;
  eventTime?: number;
}) {
  const hashed = sha256(input.email);
  return {
    data: [
      {
        event_name: "Purchase",
        event_time: input.eventTime || Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: META_ADS_SHOP_URL,
        user_data: {
          em: hashed ? [hashed] : [],
        },
        custom_data: {
          currency: input.currency,
          value: Number(input.value.toFixed(2)),
        },
      },
    ],
  };
}
