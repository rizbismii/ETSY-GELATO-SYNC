"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";

const SNAPSHOT_KEY = (id: string) => `fernora-order:${id}`;

export function cacheShopOrder(order: Order) {
  try {
    sessionStorage.setItem(SNAPSHOT_KEY(order.id), JSON.stringify(order));
  } catch {
    /* private mode */
  }
}

export function ShopOrderReceipt() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      const raw = sessionStorage.getItem(SNAPSHOT_KEY(id));
      if (raw) setOrder(JSON.parse(raw) as Order);
    } catch {
      /* ignore */
    }
    void api<{ order: Order }>(`/api/shop/orders/${id}`)
      .then((result) => {
        setOrder(result.order);
        cacheShopOrder(result.order);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [id]);

  if (!order && !error) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Finding your order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="font-heading text-4xl">We could not find that order.</h1>
        <p className="text-sm text-muted-foreground">
          {error || "It may still be writing. Check Pressroom → Orders, or place the order again."}
        </p>
        <Link href="/shop" className="inline-block text-sm underline">
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Order {order.etsyReceiptId}</p>
      <h1 className="font-heading text-4xl">
        {order.status === "pending" ? "We have the order." : "Thank you."}
      </h1>
      <p className="text-sm leading-7 text-muted-foreground">
        {order.invoiceUrl
          ? "Finish payment on the Shopify invoice. We print in-region for New Zealand, Australia, and the other countries we ship to after Shopify marks it paid."
          : "We print after payment is confirmed. We ship to New Zealand, Australia, and the other countries we deliver to."}
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
