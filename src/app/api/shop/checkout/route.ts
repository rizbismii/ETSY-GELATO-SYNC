import { placeFernoraOrder } from "@/lib/ops";
import { isFernoraCountry } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    lines?: Array<{ id: string; quantity: number }>;
    country?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postCode?: string;
  };
  try {
    if (!isFernoraCountry(body.country || "")) {
      return Response.json({ error: "Fernora only ships to Australia and New Zealand" }, { status: 400 });
    }
    if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim() || !body.addressLine1?.trim() || !body.city?.trim() || !body.postCode?.trim()) {
      return Response.json({ error: "Name, email, street, city and postcode are required" }, { status: 400 });
    }
    const result = await placeFernoraOrder({
      lines: body.lines || [],
      country: body.country!,
      address: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim(),
        phone: body.phone?.trim(),
        addressLine1: body.addressLine1.trim(),
        addressLine2: body.addressLine2?.trim(),
        city: body.city.trim(),
        state: body.state?.trim(),
        postCode: body.postCode.trim(),
        country: body.country!,
      },
    });
    return Response.json({
      ok: true,
      orderId: result.order.id,
      reference: result.order.etsyReceiptId,
      invoiceUrl: result.invoiceUrl,
      total: result.quote.total,
      currency: result.quote.currency,
      status: result.order.status,
      order: result.order,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
