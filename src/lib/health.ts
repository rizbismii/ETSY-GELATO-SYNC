import { pingEtsy } from "@/lib/etsy";
import { pingGelato } from "@/lib/gelato";
import { isEtsyCallbackHost } from "@/lib/origin";

export async function probePublicCallback(origin: string) {
  if (!isEtsyCallbackHost(origin)) return false;
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}/api/health`, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function vendorHealth() {
  const [etsy, gelato] = await Promise.allSettled([pingEtsy(), pingGelato()]);
  return {
    etsyApp:
      etsy.status === "fulfilled"
        ? { ok: true as const, applicationId: etsy.value.application_id }
        : { ok: false as const, error: (etsy.reason as Error).message },
    gelato:
      gelato.status === "fulfilled"
        ? { ok: true as const, ordersSeen: gelato.value.count }
        : { ok: false as const, error: (gelato.reason as Error).message },
  };
}
