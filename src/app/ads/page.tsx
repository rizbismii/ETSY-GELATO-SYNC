import { AdsClient } from "./ads-client";
import { getAdsDesk } from "@/lib/ads-desk";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const initial = await getAdsDesk();
  return <AdsClient initial={initial} />;
}
