"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { fernoraProduct, type FernoraCountry } from "@/lib/shop";
import { api } from "@/lib/api";
import { useCart } from "../cart-provider";
import { ProductArt } from "@/components/product-art";
import { cacheShopOrder } from "../order/[id]/ui";
import type { Order } from "@/lib/types";

type Quote = {
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  days?: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPrice: number;
    shipping: number;
    imageUrl?: string;
  }>;
};

export default function CheckoutPage() {
  const { lines, setQuantity, remove, clear } = useCart();
  const router = useRouter();
  const [country, setCountry] = useState<FernoraCountry>("NZ");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postCode: "",
  });

  const localLines = useMemo(
    () =>
      lines
        .map((line) => ({ ...line, product: fernoraProduct(line.id) }))
        .filter((line) => line.product),
    [lines],
  );

  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      return;
    }
    void api<{ quote: Quote }>("/api/shop/catalog", {
      method: "POST",
      body: JSON.stringify({ lines, country }),
    })
      .then((result) => setQuote(result.quote))
      .catch((err: Error) => toast.error(err.message));
  }, [lines, country]);

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ orderId: string; invoiceUrl?: string; order?: Order }>("/api/shop/checkout", {
        method: "POST",
        body: JSON.stringify({ ...form, country, lines }),
      });
      if (result.order) cacheShopOrder(result.order);
      clear();
      if (result.invoiceUrl) {
        window.location.href = result.invoiceUrl;
        return;
      }
      router.push(`/shop/order/${result.orderId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!localLines.length) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-heading text-4xl">Your bag is empty</h1>
        <p className="mt-3 text-sm text-muted-foreground">The catalog ships to Australia and New Zealand only.</p>
        <Link href="/shop" className={`${buttonVariants()} mt-6`}>
          Back to the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <form className="space-y-4" onSubmit={(event) => void placeOrder(event)}>
        <h1 className="font-heading text-4xl">Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Australia and New Zealand only. Gelato prints in-region after payment is confirmed.
        </p>
        <div className="flex gap-2">
          {(["NZ", "AU"] as const).map((code) => (
            <Button
              key={code}
              type="button"
              size="sm"
              variant={country === code ? "default" : "outline"}
              onClick={() => setCountry(code)}
            >
              {code === "NZ" ? "New Zealand" : "Australia"}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} />
          <Field label="Last name" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} />
        </div>
        <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
        <Field label="Phone (optional)" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <Field label="Address" value={form.addressLine1} onChange={(value) => setForm({ ...form, addressLine1: value })} />
        <Field
          label="Apartment, suite (optional)"
          value={form.addressLine2}
          onChange={(value) => setForm({ ...form, addressLine2: value })}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
          <Field
            label={country === "AU" ? "State" : "Region"}
            value={form.state}
            onChange={(value) => setForm({ ...form, state: value })}
          />
          <Field label="Postcode" value={form.postCode} onChange={(value) => setForm({ ...form, postCode: value })} />
        </div>
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="animate-spin" /> : null}
          Place order
        </Button>
      </form>
      <aside className="h-fit space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-2xl">Bag</h2>
        <ul className="space-y-4">
          {localLines.map((line) => (
            <li key={line.id} className="flex gap-3">
              <div className="size-16 overflow-hidden rounded-md bg-muted">
                <ProductArt
                  id={line.product!.id}
                  title={line.product!.title}
                  imageUrl={line.product!.imageUrl}
                  className="size-full"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{line.product!.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(line.product!.price, line.product!.currency)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    className="h-8 w-16"
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.id, Number(event.target.value))}
                  />
                  <button type="button" className="text-xs underline" onClick={() => remove(line.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {quote ? (
          <dl className="space-y-1 border-t border-border/70 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(quote.subtotal, quote.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Gelato shipping ({country})</dt>
              <dd>{formatMoney(quote.shipping, quote.currency)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Total</dt>
              <dd>{formatMoney(quote.total, quote.currency)}</dd>
            </div>
          </dl>
        ) : null}
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => setFormValue(event.target.value, onChange)} required={!label.includes("optional")} />
    </div>
  );
}

function setFormValue(value: string, onChange: (value: string) => void) {
  onChange(value);
}
