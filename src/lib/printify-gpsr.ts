export type PrintifyGpsrBlock = {
  title?: string;
  text?: string;
};

export type PrintifyGpsrStatus = "no-shop" | "empty" | "non-eu" | "stamped" | "available";

export const PRINTIFY_EU_GPSR_NOTE =
  "Printify stamps GPSR only after Store settings can save EU with a real EU or Northern Ireland responsible-person address. Add business information will not accept Wellington. The API cannot flip the EU / Non-EU radio. Gelato stays the live print path for Pressroom and fernora.nz, including EU and UK.";

export const PRINTIFY_NON_EU_NOTE =
  "Printify cannot replace Gelato as the live print platform while the store is Non-EU. Printify’s EU save opens Add business information and requires your own EU address, email, and name — it will not save a blank form, and Wellington 6012 is not valid. Cancel that modal, keep Non-EU, and leave paid fernora.nz / Etsy orders on Gelato, which already prints in-region for EU and UK.";

export function formatPrintifySafetyInformation(blocks: PrintifyGpsrBlock[]) {
  return blocks
    .map((block) => {
      const title = (block.title || "").trim();
      const text = (block.text || "").trim();
      if (!title && !text) return "";
      if (!title) return text;
      if (!text) return title;
      return `${title}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function safetyInformationNeedsGpsr(current?: string | null) {
  const text = (current || "").trim();
  if (!text) return true;
  return !/gpsr/i.test(text);
}

export function printifyGpsrIsUnavailable(message?: string | null) {
  return /not found/i.test((message || "").trim());
}

export function printifyGpsrModeFromProbe(input: {
  shopId?: number;
  productCount: number;
  updated: number;
  gpsrUnavailable: boolean;
  alreadyStamped?: number;
}): PrintifyGpsrStatus {
  if (!input.shopId) return "no-shop";
  if (input.gpsrUnavailable) return "non-eu";
  if (input.productCount === 0) return "empty";
  if (input.updated > 0 || (input.alreadyStamped || 0) > 0) return "stamped";
  return "available";
}

export function printifyGpsrNotes(status: PrintifyGpsrStatus, scanned: number, updated: number) {
  if (status === "non-eu") return [PRINTIFY_NON_EU_NOTE];
  if (status === "no-shop") {
    return [PRINTIFY_EU_GPSR_NOTE, "No Printify shop on this token yet. Create the store, then Save again."];
  }
  if (status === "empty") {
    return [
      PRINTIFY_EU_GPSR_NOTE,
      "Shop is empty. Add products in Printify, then Save again to stamp GPSR once EU is on.",
    ];
  }
  return [
    PRINTIFY_EU_GPSR_NOTE,
    scanned
      ? `GPSR safety text checked on ${scanned} product${scanned === 1 ? "" : "s"}; updated ${updated}.`
      : "Shop is empty. Add products in Printify, then Save again to stamp GPSR.",
  ];
}

export function printifyGpsrHeadline(status?: PrintifyGpsrStatus | null) {
  if (status === "non-eu") return "Non-EU hold · Gelato stays the live print path";
  if (status === "stamped") return "GPSR stamped on products";
  if (status === "available") return "EU GPSR available · stamp on Save";
  if (status === "empty") return "shop connected · no products yet";
  if (status === "no-shop") return "token saved · no shop yet";
  return "";
}

export function pickPrintifyShop<T extends { id: number; title?: string }>(shops: T[]) {
  if (!shops.length) return undefined;
  const fernora = shops.find((shop) => /fernora/i.test(shop.title || ""));
  if (fernora) return fernora;
  const named = shops.find((shop) => /new store|my store/i.test(shop.title || ""));
  return named || shops[0];
}
