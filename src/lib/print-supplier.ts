import { shipLaneForCountry, type ShipLaneCode } from "./gelato-countries.ts";

export type PrintSupplier = "printify" | "gelato";

/** UK lane (GB + Ireland) and EU lane print through Gelato for GPSR. Everything else is Printify. */
export const GELATO_COMPLIANCE_LANES: readonly ShipLaneCode[] = ["GB", "EU"];

export const PRINTIFY_MAIN_HEADLINE = "Printify is the main supplier · Gelato holds EU/UK";

export const PRINTIFY_MAIN_NOTE =
  "Printify is the main print supplier except the United Kingdom and the European Union. Keep Non-EU on Printify: Add business information will not accept Wellington 6012. Gelato stays connected for EU/UK GPSR only. Leave the saved connections as they are. Do not republish the deleted catalog onto Gelato, and do not migrate leftover External products.";

export const GELATO_EU_UK_HOLD_NOTE =
  "Gelato stays connected as the EU/UK compliance printer. Shopify and website Gelato shipping stay as they are — do not rebuild those now. Do not disconnect the Gelato key.";

export const CATALOG_CLEARED_NOTE =
  "The live catalog is cleared. Recreate products on Printify for New Zealand, Australia, the United States, and other non-EU/UK destinations. Keep Gelato for the United Kingdom and the European Union only.";

export function isGelatoComplianceLane(lane?: ShipLaneCode | string | null) {
  return lane === "GB" || lane === "EU";
}

export function isGelatoComplianceCountry(code?: string | null) {
  return isGelatoComplianceLane(shipLaneForCountry(code));
}

export function printSupplierForCountry(code?: string | null): PrintSupplier {
  return isGelatoComplianceCountry(code) ? "gelato" : "printify";
}

export function printSupplierForOrder(order?: { shippingAddress?: { country?: string | null } } | null) {
  return printSupplierForCountry(order?.shippingAddress?.country);
}
