import { apparelColorDesk, printTemplateDesk } from "@/lib/print-templates";
import { getCredentials } from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
  const creds = await getCredentials();
  return Response.json({
    templates: printTemplateDesk(),
    colors: apparelColorDesk(),
    openaiKeySet: Boolean(creds.openaiApiKey),
  });
}
