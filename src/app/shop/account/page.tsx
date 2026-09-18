"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { CountrySelect } from "../country-select";
import { EMPTY_PROFILE, useCustomerProfile, type CustomerProfile } from "../account-store";

export default function AccountPage() {
  const { profile, setProfile, orders, ready } = useCustomerProfile();
  const [draft, setDraft] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ready) setDraft(profile);
  }, [ready, profile]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setProfile(draft);
    setSaved(true);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
      <form className="space-y-4" onSubmit={save}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Customer profile</p>
        <h1 className="font-heading text-4xl">Your details</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Saved on this device and used to prefill checkout. Shopify also keeps the email and address
          from each paid invoice for order history and returns.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" value={draft.firstName} onChange={(firstName) => setDraft({ ...draft, firstName })} />
          <Field label="Last name" value={draft.lastName} onChange={(lastName) => setDraft({ ...draft, lastName })} />
        </div>
        <Field label="Email" type="email" value={draft.email} onChange={(email) => setDraft({ ...draft, email })} />
        <Field label="Phone" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
        <Field label="Address" value={draft.addressLine1} onChange={(addressLine1) => setDraft({ ...draft, addressLine1 })} />
        <Field
          label="Apartment, suite"
          value={draft.addressLine2}
          onChange={(addressLine2) => setDraft({ ...draft, addressLine2 })}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="City" value={draft.city} onChange={(city) => setDraft({ ...draft, city })} />
          <Field label="Region" value={draft.state} onChange={(state) => setDraft({ ...draft, state })} />
          <Field label="Postcode" value={draft.postCode} onChange={(postCode) => setDraft({ ...draft, postCode })} />
        </div>
        <CountrySelect
          value={draft.country}
          onChange={(country) => setDraft({ ...draft, country })}
          label="Default ship-to country"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!ready}>
            Save profile
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_PROFILE);
              setProfile(EMPTY_PROFILE);
              setSaved(false);
            }}
          >
            Clear
          </Button>
          {saved ? <p className="text-xs text-muted-foreground">Saved on this device.</p> : null}
        </div>
      </form>
      <aside className="h-fit space-y-4 rounded-[1.6rem] border border-border/70 bg-card p-5">
        <h2 className="font-heading text-2xl">Orders on this device</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Place an order from the shop and it will appear here, with a link to the Shopify invoice.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="border-b border-border/60 pb-3 last:border-0">
                <Link href={`/shop/order/${order.id}`} className="font-medium underline-offset-4 hover:underline">
                  {order.etsyReceiptId}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {order.items.map((item) => item.title).join(" · ")} ·{" "}
                  {formatMoney(order.subtotal + order.shippingPaid, order.currency)} · {order.status}
                </p>
              </li>
            ))}
          </ul>
        )}
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
  const id = `account-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
