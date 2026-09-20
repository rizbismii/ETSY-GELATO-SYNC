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
import { cartLineKey, fernoraProduct } from "@/lib/shop";
import { gelatoCountryName } from "@/lib/gelato-countries";
import { POLICY_PATHS } from "@/lib/shop-policies";
import { api } from "@/lib/api";
import { useCart } from "../cart-provider";
import { ProductArt } from "@/components/product-art";
import { cacheShopOrder } from "../order/[id]/ui";
import { CountrySelect } from "../country-select";
import { readProfile, rememberOrder, writeProfile, type CustomerProfile } from "../account-store";
import type { Order } from "@/lib/types";

type Quote = {
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  days?: string;
  countryName?: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPrice: number;
    shipping: number;
    imageUrl?: string;
    variantLabel?: string;
  }>;
};

export default function CheckoutPage() {
  const { lines, setQuantity, remove, clear } = useCart();
  const router = useRouter();
  const [country, setCountry] = useState("NZ");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CustomerProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postCode: "",
    country: "NZ",
  });

  useEffect(() => {
    const saved = readProfile();
    setForm(saved);
    setCountry(saved.country || "NZ");
  }, []);

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
      const profile = { ...form, country };
      writeProfile(profile);
      const result = await api<{ orderId: string; invoiceUrl?: string; order?: Order }>("/api/shop/checkout", {
        method: "POST",
        body: JSON.stringify({ ...profile, country, lines }),
      });
      if (result.order) {
        cacheShopOrder(result.order);
        rememberOrder(result.order);
      }
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
        <p className="mt-3 text-sm text-muted-foreground">
          The catalog ships to New Zealand, Australia, the United States, the United Kingdom, the
          European Union, and the countries listed at checkout.
        </p>
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
          Country matches Gelato delivery. After you place the order, pay the Shopify invoice
          (cards, Shop Pay, Apple Pay where available). Gelato prints only after payment.
        </p>
        <CountrySelect
          value={country}
          onChange={(value) => {
            setCountry(value);
            setForm((current) => ({ ...current, country: value }));
          }}
        />
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
            label={country === "AU" || country === "US" ? "State" : "Region"}
            value={form.state}
            onChange={(value) => setForm({ ...form, state: value })}
          />
          <Field label="Postcode" value={form.postCode} onChange={(value) => setForm({ ...form, postCode: value })} />
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          Saved to your{" "}
          <Link className="underline" href="/shop/account">
            customer profile
          </Link>{" "}
          on this device.{" "}
          <Link className="underline" href={POLICY_PATHS.returns}>
            Returns
          </Link>
          {" · "}
          <Link className="underline" href={POLICY_PATHS.privacy}>
            Privacy
          </Link>
          {" · "}
          <Link className="underline" href={POLICY_PATHS.payments}>
            Payments
          </Link>
        </p>
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="animate-spin" /> : null}
          Place order &amp; pay with Shopify
        </Button>
      </form>
      <aside className="h-fit space-y-4 rounded-[1.6rem] border border-border/70 bg-card p-5">
        <h2 className="font-heading text-2xl">Bag</h2>
        <ul className="space-y-4">
          {localLines.map((line) => (
            <li key={cartLineKey(line)} className="flex gap-3">
              <div className="size-16 overflow-hidden rounded-md bg-muted">
                <ProductArt
                  id={line.product!.id}
                  title={line.product!.title}
                  imageUrl={line.product!.imageUrl}
                  fit="contain"
                  className="size-full"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{line.product!.title}</p>
                {line.variantId ? (
                  <p className="text-xs text-muted-foreground">
                    {line.product!.variants?.find((row) => row.id === line.variantId)?.color} ·{" "}
                    {line.product!.variants?.find((row) => row.id === line.variantId)?.size}
                  </p>
                ) : null}
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
                    onChange={(event) => setQuantity(cartLineKey(line), Number(event.target.value))}
                  />
                  <button type="button" className="text-xs underline" onClick={() => remove(cartLineKey(line))}>
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
              <dt>Gelato shipping ({quote.countryName || gelatoCountryName(country)})</dt>
              <dd>{formatMoney(quote.shipping, quote.currency)}</dd>
            </div>
            {quote.days ? (
              <div className="flex justify-between text-muted-foreground">
                <dt>Transit</dt>
                <dd>{quote.days}</dd>
              </div>
            ) : null}
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
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={!label.includes("optional")}
      />
    </div>
  );
}
