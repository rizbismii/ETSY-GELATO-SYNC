export type PrintifyGpsrBlock = {
  title?: string;
  text?: string;
};

export type PrintifyGpsrStatus = "no-shop" | "empty" | "non-eu" | "stamped" | "available";

export type PrintifyShopSummary = {
  id: number;
  title?: string;
  salesChannel: string;
  productCount: number;
};

export const PRINTIFY_EU_GPSR_NOTE =
  "Printify stamps GPSR only after Store settings can save EU with a real EU or Northern Ireland responsible-person address. Add business information will not accept Wellington. The API cannot flip the EU / Non-EU radio. Printify is the main supplier except EU/UK; Gelato stays connected for those destinations only.";

export const PRINTIFY_NON_EU_NOTE =
  "Printify is the main print supplier except the United Kingdom and the European Union. Keep Non-EU on Printify: Add business information will not accept Wellington 6012. Gelato stays connected for EU/UK GPSR only. Leave the saved connections as they are. Do not republish the deleted catalog onto Gelato, and do not migrate leftover External products.";

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
      "Shop is empty. Create the 20-item Printify catalog (one variant each). Do not migrate leftover External products.",
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
  if (status === "non-eu") return "Non-EU hold · Printify is main except EU/UK";
  if (status === "stamped") return "GPSR stamped on products";
  if (status === "available") return "EU GPSR available · stamp on Save";
  if (status === "empty") return "shop connected · no products yet";
  if (status === "no-shop") return "token saved · no shop yet";
  return "";
}

export function printifyChannelKey(channel?: string | null) {
  return (channel || "disconnected").trim().toLowerCase() || "disconnected";
}

export function printifySalesChannelLabel(channel?: string | null) {
  const value = printifyChannelKey(channel);
  if (value === "disconnected") return "not linked to a sales platform";
  if (value === "etsy") return "Etsy channel";
  if (value === "shopify") return "Shopify channel";
  return `${channel} channel`;
}

export function printifyShopNameKey(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function printifyShopNamesMatch(left?: string | null, right?: string | null) {
  const a = printifyShopNameKey(left);
  const b = printifyShopNameKey(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function printifyIsFullyConnected(shops: PrintifyShopSummary[]) {
  return shops.some((shop) => printifyChannelKey(shop.salesChannel) !== "disconnected" && shop.productCount > 0);
}

export function printifyConnectionHeadline(input: {
  gpsrStatus?: PrintifyGpsrStatus | null;
  fullyConnected?: boolean;
  shops?: PrintifyShopSummary[];
  etsyShopName?: string | null;
}) {
  const gpsr = printifyGpsrHeadline(input.gpsrStatus);
  const shops = input.shops || [];
  const etsyShop = (input.etsyShopName || "").trim();
  const channel = shops.find((shop) => printifyChannelKey(shop.salesChannel) === "etsy");
  const channelShowsEtsyShop = Boolean(channel) && printifyShopNamesMatch(channel?.title, etsyShop || channel?.title);
  const parts: string[] = [];
  if (input.fullyConnected && channelShowsEtsyShop) parts.push(`Etsy connected · ${channel?.title || etsyShop}`);
  else if (channel && printifyShopNamesMatch(channel.title, etsyShop || "Fernora Trends") && channel.productCount === 0) {
    parts.push(`Etsy connected as ${channel.title} · 0 Printify products`);
  } else if (etsyShop && channel && !printifyShopNamesMatch(channel.title, etsyShop)) {
    parts.push(`token live · Printify does not show ${etsyShop}`);
  } else if (input.fullyConnected) parts.push("fully connected on a sales channel");
  else if (!shops.length) parts.push("token live · not fully connected");
  else if (channel && channel.productCount === 0) parts.push("token live · Etsy channel empty · not fully connected");
  else parts.push("token live · not fully connected");
  if (gpsr) parts.push(gpsr);
  return parts.join(" · ");
}

export function printifyShopLine(shop: PrintifyShopSummary, etsyShopName?: string | null) {
  const title = shop.title || "Printify shop";
  const products = `${shop.productCount} product${shop.productCount === 1 ? "" : "s"}`;
  const etsy = (etsyShopName || "").trim();
  const mismatch =
    printifyChannelKey(shop.salesChannel) === "etsy" && etsy && !printifyShopNamesMatch(title, etsy)
      ? ` · not ${etsy}`
      : "";
  const connected =
    printifyChannelKey(shop.salesChannel) === "etsy" && printifyShopNamesMatch(title, etsy || title)
      ? " · Etsy connected"
      : "";
  return `${title} · ${shop.id} · ${printifySalesChannelLabel(shop.salesChannel)} · ${products}${connected}${mismatch}`;
}

export function pickPrintifyShop<
  T extends { id: number; title?: string; sales_channel?: string; salesChannel?: string },
>(shops: T[]) {
  if (!shops.length) return undefined;
  const channelOf = (shop: T) => printifyChannelKey(shop.sales_channel || shop.salesChannel);
  const fernora = shops.filter((shop) => /fernora/i.test(shop.title || ""));
  const etsyFernora = fernora.find((shop) => channelOf(shop) === "etsy");
  if (etsyFernora) return etsyFernora;
  if (fernora[0]) return fernora[0];
  const named = shops.find((shop) => /new store|my store/i.test(shop.title || ""));
  return named || shops[0];
}
