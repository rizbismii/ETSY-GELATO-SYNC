import { pingGelato } from "@/lib/gelato";
import { getCredentials, patchCredentials } from "@/lib/credentials";
import { connectionStatus } from "@/lib/ops";

export async function POST(request: Request) {
  const body = (await request.json()) as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return Response.json({ error: "Paste a Gelato API key." }, { status: 400 });
  }
  const current = await getCredentials();
  await patchCredentials({ ...current, gelatoApiKey: apiKey });
  try {
    await pingGelato();
    return Response.json({ ok: true, live: true, connections: await connectionStatus() });
  } catch (error) {
    return Response.json({
      ok: true,
      live: false,
      warning: (error as Error).message,
      connections: await connectionStatus(),
    });
  }
}
