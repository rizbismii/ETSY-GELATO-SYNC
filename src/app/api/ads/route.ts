import { getCredentials } from "@/lib/credentials";
import { connectionStatus } from "@/lib/ops";
import {
  META_ADS_DAILY_BUDGET_DEFAULT,
  META_ADS_DAILY_BUDGET_MAX,
  META_ADS_DAILY_BUDGET_MIN,
  META_ADS_LANDING_URL,
  pingMetaAds,
  readMetaCampaign,
} from "@/lib/meta-ads";
import { ETSY_CPC_ADS_ENABLED, ETSY_OFFSITE_ADS_ENABLED, ETSY_OFFSITE_OPTED_OUT_ON, OFFSITE_ADS_RATE } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const [connections, creds, campaign] = await Promise.all([
    connectionStatus(),
    getCredentials(),
    readMetaCampaign(),
  ]);
  let ping: Awaited<ReturnType<typeof pingMetaAds>> | undefined;
  let pingError: string | undefined;
  if (connections.meta.authorized) {
    try {
      ping = await pingMetaAds();
    } catch (error) {
      pingError = (error as Error).message;
    }
  }
  return Response.json({
    connections,
    landingUrl: META_ADS_LANDING_URL,
    dailyBudgetMin: META_ADS_DAILY_BUDGET_MIN,
    dailyBudgetMax: META_ADS_DAILY_BUDGET_MAX,
    dailyBudgetDefault: META_ADS_DAILY_BUDGET_DEFAULT,
    offsiteRate: OFFSITE_ADS_RATE,
    offsiteEnabled: ETSY_OFFSITE_ADS_ENABLED,
    offsiteOptedOutOn: ETSY_OFFSITE_OPTED_OUT_ON,
    etsyCpcEnabled: ETSY_CPC_ADS_ENABLED,
    campaign,
    ping,
    pingError,
    meta: {
      accessTokenSet: Boolean(creds.meta?.accessToken),
      accessToken: creds.meta?.accessToken || "",
      adAccountId: creds.meta?.adAccountId || "",
      pixelId: creds.meta?.pixelId || "",
      pageId: creds.meta?.pageId || "",
    },
  });
}
