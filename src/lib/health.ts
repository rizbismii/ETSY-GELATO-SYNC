import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pingEtsy } from "@/lib/etsy";
import { pingGelato } from "@/lib/gelato";
import { pingPrintify } from "@/lib/printify";
import { pingShopify } from "@/lib/shopify";
import { isEtsyCallbackHost } from "@/lib/origin";

const execFileP = promisify(execFile);

async function fetchOk(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(5000),
  });
  return response.ok;
}

async function curlViaPublicDns(origin: string) {
  const host = new URL(origin).hostname;
  const url = `${origin.replace(/\/$/, "")}/api/health`;
  const { stdout } = await execFileP("dig", ["+short", "@1.1.1.1", host, "A"], { timeout: 4000 });
  const ip = stdout
    .trim()
    .split("\n")
    .find((line) => /^\d{1,3}(\.\d{1,3}){3}$/.test(line));
  if (!ip) return false;
  const { stdout: body } = await execFileP(
    "curl",
    ["-fsS", "--max-time", "8", "--resolve", `${host}:443:${ip}`, url],
    { timeout: 12000 },
  );
  return body.includes('"ok"');
}

export async function probePublicCallback(origin: string) {
  if (!isEtsyCallbackHost(origin)) return false;
  const url = `${origin.replace(/\/$/, "")}/api/health`;
  try {
    if (await fetchOk(url)) return true;
  } catch {
    /* this VM's libc DNS often misses brand-new trycloudflare names */
  }
  try {
    return await curlViaPublicDns(origin);
  } catch {
    return false;
  }
}

export async function vendorHealth() {
  const [etsy, gelato, shopify, printify] = await Promise.allSettled([
    pingEtsy(),
    pingGelato(),
    pingShopify(),
    pingPrintify(),
  ]);
  return {
    etsyApp:
      etsy.status === "fulfilled"
        ? { ok: true as const, applicationId: etsy.value.application_id }
        : { ok: false as const, error: (etsy.reason as Error).message },
    gelato:
      gelato.status === "fulfilled"
        ? { ok: true as const, ordersSeen: gelato.value.count }
        : { ok: false as const, error: (gelato.reason as Error).message },
    shopify:
      shopify.status === "fulfilled"
        ? shopify.value
        : { ok: false as const, error: (shopify.reason as Error).message },
    printify:
      printify.status === "fulfilled"
        ? { ok: true as const, shopTitle: printify.value.shopTitle, shopId: printify.value.shopId }
        : { ok: false as const, error: (printify.reason as Error).message },
  };
}
