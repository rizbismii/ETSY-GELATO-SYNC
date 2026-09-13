import { connectionStatus, getOverview } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function GET() {
  const [overview, connections] = await Promise.all([getOverview(), connectionStatus()]);
  return Response.json({ ...overview, connections });
}
