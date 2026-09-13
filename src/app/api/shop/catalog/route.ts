import { fernoraCatalog, quoteFernoraCart, isFernoraCountry } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const country = new URL(request.url).searchParams.get("country") || "NZ";
  const catalog = fernoraCatalog().map((product) => {
    const lane = isFernoraCountry(country)
      ? product.lanes.find((row) => row.country === country || row.region === country)
      : undefined;
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: product.currency,
      imageUrl: product.imageUrl,
      category: product.category,
      collection: product.collection,
      quote: product.quote,
      shipping: lane?.shipping ?? null,
      days: lane?.days ?? null,
    };
  });
  return Response.json({ catalog, countries: ["NZ", "AU"] });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    lines?: Array<{ id: string; quantity: number }>;
    country?: string;
  };
  try {
    if (!isFernoraCountry(body.country || "")) {
      return Response.json({ error: "Ships to Australia and New Zealand only" }, { status: 400 });
    }
    const quote = quoteFernoraCart(body.lines || [], body.country as "AU" | "NZ");
    return Response.json({
      quote: {
        subtotal: quote.subtotal,
        shipping: quote.shipping,
        total: quote.total,
        currency: quote.currency,
        country: quote.country,
        days: quote.days,
        items: quote.items.map((item) => ({
          id: item.product.id,
          title: item.product.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          shipping: item.shipping,
          imageUrl: item.product.imageUrl,
        })),
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
