/** Shopify carrier-service callback helpers (cents strings, empty rates when Gelato cannot ship). */

export type ShopifyCarrierItem = {
  sku?: string | null;
  name?: string | null;
  quantity?: number | null;
};

export type ShopifyCarrierRequest = {
  rate?: {
    destination?: { country?: string | null; country_code?: string | null };
    items?: ShopifyCarrierItem[];
  };
};

export function shippingToCarrierCents(amount: number) {
  return Math.round(amount * 100).toString();
}

export function carrierDestinationCountry(payload: ShopifyCarrierRequest) {
  const dest = payload.rate?.destination;
  return (dest?.country || dest?.country_code || "").trim().toUpperCase();
}

export function carrierLineItems(payload: ShopifyCarrierRequest) {
  return (payload.rate?.items || [])
    .map((item) => ({
      sku: item.sku || undefined,
      title: item.name || undefined,
      quantity: Math.max(1, Math.floor(item.quantity || 1)),
    }))
    .filter((item) => item.sku || item.title);
}

export function gelatoCarrierRateResponse(quote: {
  serviceName: string;
  lane?: string;
  country: string;
  currency: string;
  days: string;
  shipping: number;
}) {
  return {
    rates: [
      {
        service_name: quote.serviceName,
        service_code: `gelato-${quote.lane || quote.country}`,
        description: `Printed near you · ${quote.days}`,
        currency: quote.currency,
        total_price: shippingToCarrierCents(quote.shipping),
      },
    ],
  };
}
