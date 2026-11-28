import { getAdsDesk } from "@/lib/ads-desk";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getAdsDesk());
}
