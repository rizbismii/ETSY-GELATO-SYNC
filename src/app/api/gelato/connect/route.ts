import { pingGelato } from "@/lib/gelato";
import { patchCredentials, usableGelatoKey } from "@/lib/credentials";
import { connectionStatus } from "@/lib/ops";

export async function POST(request: Request) {
  const body = (await request.json()) as { apiKey?: string };
  const apiKey = usableGelatoKey(body.apiKey);
  if (!apiKey) {
    return Response.json(
      { error: "Paste a Gelato API key from Developer → API Keys. The Etsy app name is not a Gelato key." },
      { status: 400 },
    );
  }
  await patchCredentials({ gelatoApiKey: apiKey });
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
