export type CatalogMixId = "all" | "quote" | "botanical" | "scenic" | "home" | "original";

export type CatalogMenuItem = {
  id: CatalogMixId;
  label: string;
  handle: string;
};

/** Same Catalog dropdown on Printify tags, Pressroom, /shop, Shopify, and Etsy sections. */
export const CATALOG_MENU: readonly CatalogMenuItem[] = [
  { id: "all", label: "All", handle: "all" },
  { id: "quote", label: "Quotes", handle: "quotes" },
  { id: "botanical", label: "Botanical", handle: "botanical" },
  { id: "scenic", label: "Scenic", handle: "scenic" },
  { id: "home", label: "Home décor", handle: "home-decor" },
  { id: "original", label: "Original fern", handle: "original-fern" },
] as const;

export const CATALOG_SERIES = CATALOG_MENU.filter((row) => row.id !== "all");

export function catalogMenuLabel(id?: string | null) {
  return CATALOG_MENU.find((row) => row.id === id)?.label || id || "";
}

export function catalogSeriesByCollection(id?: string | null) {
  return CATALOG_SERIES.find((row) => row.id === id);
}
