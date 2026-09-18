import { fernoraCatalog, quoteFernoraCart, isFernoraCountry, shopLane } from "@/lib/shop";
import { GELATO_DESTINATIONS, gelatoCountriesByGroup } from "@/lib/gelato-countries";
import { getDeletedListingIds } from "@/lib/tombstones";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const country = new URL(request.url).searchParams.get("country") || "NZ";
  const deleted = new Set(getDeletedListingIds());
  const catalog = fernoraCatalog()
    .filter((product) => !deleted.has(product.id))
    .map((product) => {
      const lane = isFernoraCountry(country) ? shopLane(product, country) : undefined;
      return {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        printFileUrl: product.printFileUrl,
        category: product.category,
        collection: product.collection,
        quote: product.quote,
        shipping: lane?.shipping ?? null,
        days: lane?.days ?? null,
        lanes: product.lanes.map((row) => ({
          region: row.region,
          label: row.label,
          shipping: row.shipping,
          days: row.days,
        })),
      };
    });
  return Response.json({
    catalog,
    countries: GELATO_DESTINATIONS.map((row) => ({
      code: row.code,
      name: row.name,
      lane: row.lane,
      group: row.group,
    })),
    groups: gelatoCountriesByGroup(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    lines?: Array<{ id: string; quantity: number; variantId?: string }>;
    country?: string;
  };
  try {
    if (!isFernoraCountry(body.country || "")) {
      return Response.json({ error: "Ships only to the countries we deliver to" }, { status: 400 });
    }
    const quote = quoteFernoraCart(body.lines || [], body.country!);
    return Response.json({
      quote: {
        subtotal: quote.subtotal,
        shipping: quote.shipping,
        total: quote.total,
        currency: quote.currency,
        country: quote.country,
        countryName: quote.countryName,
        lane: quote.lane,
        days: quote.days,
        items: quote.items.map((item) => ({
          id: item.product.id,
          title: item.variantLabel ? `${item.product.title} · ${item.variantLabel}` : item.product.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          shipping: item.shipping,
          imageUrl: item.product.imageUrl,
          variantLabel: item.variantLabel,
        })),
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
