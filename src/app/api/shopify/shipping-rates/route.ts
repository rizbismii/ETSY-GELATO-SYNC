import { quoteGelatoShipment } from "@/lib/shop";
import {
  carrierDestinationCountry,
  carrierLineItems,
  gelatoCarrierRateResponse,
  type ShopifyCarrierRequest,
} from "@/lib/shopify-carrier";

export const dynamic = "force-dynamic";

function emptyRates() {
  return Response.json({ rates: [] });
}

export async function GET() {
  return Response.json({ ok: true, service: "fernora-gelato-shipping" });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as ShopifyCarrierRequest;
  const country = carrierDestinationCountry(payload);
  const lines = carrierLineItems(payload);
  if (!country || !lines.length) return emptyRates();
  try {
    const quote = quoteGelatoShipment(lines, country);
    return Response.json(gelatoCarrierRateResponse(quote));
  } catch {
    return emptyRates();
  }
}
