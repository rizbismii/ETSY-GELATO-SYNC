import crypto from "node:crypto";

export const META_ADS_LANDING_URL = "https://fernora.nz";
export const META_ADS_CAMPAIGN_NAME = "Fernora · Pressroom";
export const META_ADS_ADSET_NAME = "Fernora storefront · NZ AU";
export const META_ADS_AD_NAME = "Fernora · fernora.nz";
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
        event_source_url: META_ADS_LANDING_URL,
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
