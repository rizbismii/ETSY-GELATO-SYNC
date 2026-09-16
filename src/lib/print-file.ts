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
