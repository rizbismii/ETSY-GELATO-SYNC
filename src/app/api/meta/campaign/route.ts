import { connectionStatus } from "@/lib/ops";
import {
  clampMetaDailyBudget,
  pauseMetaCampaign,
  readMetaCampaign,
  upsertMetaCampaign,
} from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { dailyBudget?: number; live?: boolean; pause?: boolean };
  try {
    if (body.pause) {
      const campaign = await pauseMetaCampaign();
      return Response.json({
        ok: true,
        campaign,
        notes: ["Campaign paused. Spend stops at the daily cap already used today."],
        connections: await connectionStatus(),
      });
    }
    const result = await upsertMetaCampaign({
      dailyBudget: body.dailyBudget,
      live: Boolean(body.live),
    });
    return Response.json({ ok: true, ...result, connections: await connectionStatus() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({
    campaign: await readMetaCampaign(),
    dailyBudget: clampMetaDailyBudget((await readMetaCampaign()).dailyBudget),
  });
}
