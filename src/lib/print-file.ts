/** Listing mockup is the source of truth. Print files must be that same artwork. */

export const CATALOG_ART_PAIRS = [
  { key: "live_poster", mockup: "/catalog/catalog-poster.png", print: "/catalog/print-poster-fern-arc.png" },
  { key: "live_quote_breathe", mockup: "/catalog/catalog-breathe-here.png", print: "/catalog/print-breathe-here.png" },
  { key: "live_botanical_kowhai", mockup: "/catalog/catalog-kowhai-botanical.png", print: "/catalog/print-kowhai-botanical.png" },
  { key: "live_canvas_harbour", mockup: "/catalog/catalog-harbour-morning.png", print: "/catalog/print-harbour-morning.png" },
  { key: "live_frame_kind", mockup: "/catalog/catalog-kind-light.png", print: "/catalog/print-kind-light.png" },
  { key: "live_sneaker_star", mockup: "/catalog/catalog-camo-sneakers-angle.jpg", print: "/catalog/print-camo-sneakers.png" },
  { key: "live_sneaker_star_w", mockup: "/catalog/catalog-star-sneakers-w-angle.jpg", print: "/catalog/print-star-sneakers.png" },
] as const;

export function catalogArtPair(id?: string | null) {
  return CATALOG_ART_PAIRS.find((row) => row.key === id);
}

export function printFileForListing(id?: string | null, current?: string | null) {
  const pair = catalogArtPair(id);
  if (pair) return pair.print;
  if (current && isForeignPrintFile(id, current)) return "";
  return current || "";
}

export function isForeignPrintFile(id?: string | null, printFileUrl?: string | null) {
  if (!printFileUrl) return false;
  const name = printFileName(printFileUrl);
  const owner = CATALOG_ART_PAIRS.find((row) => row.print.endsWith(`/${name}`) || row.print === printFileUrl);
  return Boolean(owner && owner.key !== id);
}

/** How Gelato print files are built so templates match catalog mockups. */

export type PrintSurface = "dtg" | "wrap" | "full-bleed";

export function printSurface(category: string): PrintSurface {
  if (category === "hoodie" || category === "tee" || category === "sweatshirt" || category === "tote") {
    return "dtg";
  }
  if (category === "mug") return "wrap";
  return "full-bleed";
}

export function isDtgCategory(category: string) {
  return printSurface(category) === "dtg";
}

/**
 * Apparel and totes are DTG: RGBA ink only, no paper/linen square.
 * Mugs are wrap files that match the catalog band or lettering.
 * Wall art and cases stay full-bleed artwork.
 * Rebuild with `npm run print-files`. Publish and Attach Gelato templates
 * push whatever printFileUrl is on the listing, including future products.
 */
export function printTreatment(category: string, listingId?: string) {
  if (category === "hoodie") return "sage-emblem";
  if (category === "tee") return "knockout-light";
  if (category === "sweatshirt") return "knockout-dark";
  if (category === "tote") {
    return listingId === "live_tote_grow" ? "knockout-dark" : "catalog-extract-light";
  }
  if (category === "mug") {
    return listingId === "live_mug_morning" ? "mug-letter-wrap" : "mug-sage-band";
  }
  return "full-bleed";
}

export function printFileName(printFileUrl?: string, title?: string) {
  const fromUrl = printFileUrl?.split("/").pop()?.split("?")[0];
  if (fromUrl) return fromUrl;
  const slug = (title || "print-template")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "print-template"}.png`;
}

export function printTemplateLabel(category: string, listingId?: string) {
  const surface = printSurface(category);
  const treatment = printTreatment(category, listingId);
  if (surface === "dtg") return `DTG RGBA · ${treatment} (transparent ground, matches mockup)`;
  if (surface === "wrap") return `Mug wrap · ${treatment}`;
  return "Print file must match the listing photo — same artwork the customer sees";
}

/** Catalog mockups are lifestyle photos; print files must stay uncropped. */
export function artFit(kind: "mockup" | "print" = "mockup") {
  return kind === "print" ? "contain" : "contain";
}
