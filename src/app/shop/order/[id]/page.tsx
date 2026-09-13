import Link from "next/link";
import { notFound } from "next/navigation";
import { getShop } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = await getShop();
  const order = shop.orders.find((row) => row.id === id);
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Order {order.etsyReceiptId}</p>
      <h1 className="font-heading text-4xl">
        {order.status === "pending" ? "We have the order." : "Thank you."}
      </h1>
      <p className="text-sm leading-7 text-muted-foreground">
        {order.invoiceUrl
          ? "Finish payment on the Shopify invoice and Gelato will print in Australia or New Zealand."
          : "Payment is confirmed in Pressroom. Gelato prints after that — we only ship to AU and NZ."}
      </p>
      <ul className="space-y-2 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4">
            <span>
              {item.quantity}× {item.title}
            </span>
            <span>{formatMoney(item.price * item.quantity, order.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Shipping {formatMoney(order.shippingPaid, order.currency)} to {order.shippingAddress.city},{" "}
        {order.shippingAddress.country}
      </p>
      <p className="text-lg">Total {formatMoney(order.subtotal + order.shippingPaid, order.currency)}</p>
      {order.invoiceUrl ? (
        <p>
          <a className="underline" href={order.invoiceUrl}>
            Open Shopify invoice
          </a>
        </p>
      ) : null}
      <Link href="/shop" className="inline-block text-sm underline">
        Continue shopping
      </Link>
    </div>
  );
}
