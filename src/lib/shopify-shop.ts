/** Canonical Shopify Admin hostname for the live Fernora NZ store (storefront fernora.nz). */
export const FERNORA_SHOPIFY_SHOP = "gi6ey4-wc.myshopify.com";
export const FERNORA_SHOPIFY_STOREFRONT = "fernora.nz";
export const FERNORA_STOREFRONT_HOSTS = ["fernora.nz", "www.fernora.nz"] as const;
export const FERNORA_STOREFRONT_ORIGIN = "https://fernora.nz";

export function isFernoraStorefrontHost(host?: string | null) {
  const name = (host || "").split(":")[0].trim().toLowerCase();
  return (FERNORA_STOREFRONT_HOSTS as readonly string[]).includes(name);
}
