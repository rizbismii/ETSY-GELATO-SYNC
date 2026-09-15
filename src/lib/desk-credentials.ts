/**
 * Fernora desk app keys. These are the shop’s own API credentials so a fresh
 * clone, a recycled Cloudflare hostname, or a missing data/credentials.json
 * still has Etsy + Gelato. Rotating OAuth tokens stay in credentials.json only.
 */
export const DESK_CREDENTIALS = {
  gelatoApiKey:
    "4bf398ed-c49b-4452-a69c-2b775254c12c-76c842b7-f703-478e-8b0b-774c693ef6dd:28087160-4119-42c3-a3ae-31da7ade21a3",
  etsy: {
    apiKey: "nt8ik7c56gcydn58wb8xk3hn",
    sharedSecret: "pm8n0mlxq3",
  },
  shopify: {
    clientId: "",
    clientSecret: "",
    shop: "fernora.myshopify.com",
  },
};

export function usableGelatoKey(value?: string) {
  const key = value?.trim();
  if (!key) return undefined;
  if (/etsgelto|fernora etsgelto/i.test(key)) return undefined;
  if (key.length < 20) return undefined;
  return key;
}
