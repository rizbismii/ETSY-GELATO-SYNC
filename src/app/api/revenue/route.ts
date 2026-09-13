import { getOverview } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function GET() {
  const overview = await getOverview();
  return Response.json({
    kpis: overview.kpis,
    revenue: overview.revenue,
    topListings: overview.topListings,
    shopName: overview.shopName,
  });
}
