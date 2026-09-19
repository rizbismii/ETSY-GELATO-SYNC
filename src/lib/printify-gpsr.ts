export type PrintifyGpsrBlock = {
  title?: string;
  text?: string;
};

export const PRINTIFY_EU_GPSR_NOTE =
  "Leave EU (selling in the EU and United Kingdom) selected in Printify store settings. The Printify API cannot flip that radio. Pressroom applies GPSR safety text on products after the token is saved.";

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

export function pickPrintifyShop<T extends { id: number; title?: string }>(shops: T[]) {
  if (!shops.length) return undefined;
  const fernora = shops.find((shop) => /fernora/i.test(shop.title || ""));
  if (fernora) return fernora;
  const named = shops.find((shop) => /new store|my store/i.test(shop.title || ""));
  return named || shops[0];
}
