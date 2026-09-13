"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeDollarSign,
  Loader2,
  Printer,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { ProductArt } from "@/components/product-art";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/types";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-3xl tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function DeskPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/overview"));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function repair() {
    setBusy(true);
    try {
      const result = await api<{
        mappedListings: number;
        repriced: number;
        fulfilled: number;
        trackingPushed: number;
      }>("/api/ops/repair", { method: "POST", body: JSON.stringify({}) });
      toast.success(
        `Mapped ${result.mappedListings}, repriced ${result.repriced}, fulfilled ${result.fulfilled}, tracking ${result.trackingPushed}.`,
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <p className="font-medium">The desk could not load.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Opening the shop desk…
      </div>
    );
  }

  const maxGross = Math.max(...data.revenue.map((day) => day.gross), 1);
  const sample = data.connections.etsy.mode === "demo" || data.connections.gelato.mode === "demo";
  const money = (value: number) => formatMoney(value, data.currency || "NZD");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight md:text-5xl">
            {data.shopName}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Live FERNORATRENDS desk. Etsy takes the sale. Gelato prints near the buyer.
            Catalog prices are NZD and already include fee and print margin math.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/connections" />}>
            {sample ? "Connect live shops" : "Connection status"}
          </Button>
          <Button onClick={() => void repair()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Wrench />}
            Fix store operations
          </Button>
        </div>
      </div>

      {sample ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Gelato is live. Authorize Etsy on Connections if you have not already, then publish
          the five Fernora products from Catalog.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Net profit · 30 days"
          value={money(data.kpis.net30d)}
          hint={`${money(data.kpis.gross30d)} gross after Etsy fees and Gelato cost`}
        />
        <Kpi
          label="Ops score"
          value={`${data.kpis.opsScore}`}
          hint="Mappings, open orders, and tracking gaps"
        />
        <Kpi
          label="Waiting on print"
          value={String(data.kpis.awaitingFulfillment)}
          hint={`${data.kpis.inProduction} currently at Gelato`}
        />
        <Kpi
          label="Unmapped listings"
          value={String(data.kpis.unmappedListings)}
          hint="These will block the next paid order"
        />
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl tracking-tight">{data.drop.name}</h2>
            <p className="text-sm text-muted-foreground">
              Five live Gelato products with AI artwork: poster, hoodie, tote, mug, and canvas.
            </p>
          </div>
          <p className="text-sm">
            <span className="font-medium text-profit">{money(data.drop.net30d)} net</span>
            <span className="text-muted-foreground">
              {" "}
              · {money(data.drop.gross30d)} gross · {data.drop.units30d} units
            </span>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.drop.listings.map((listing) => (
            <Card key={listing.id} size="sm">
              <CardContent className="space-y-3">
                <ProductArt
                  id={listing.id}
                  title={listing.title}
                  category={listing.category}
                  imageUrl={listing.imageUrl}
                  className="h-28 w-full"
                />
                <div>
                  <p className="text-sm font-medium leading-5">{listing.title}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {listing.category} · {listing.units30d} sold
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{money(listing.price)}</span>
                  <span className="text-profit">{money(listing.net30d)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>What to fix</CardTitle>
            <StatusPill value={data.issues.some((i) => i.severity === "critical") ? "blocked" : "paid"} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Shop is clear. New paid orders can go straight to Gelato.
              </p>
            ) : (
              data.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="size-3.5 text-primary" />
                      <p className="text-sm font-medium">{issue.title}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{issue.detail}</p>
                  </div>
                  {issue.action?.href ? (
                    <Button size="sm" variant="outline" nativeButton={false} render={<Link href={issue.action.href} />}>
                      {issue.action.label}
                      <ArrowRight />
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gross · last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-1">
              {data.revenue.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 rounded-sm bg-primary/80"
                  style={{ height: `${Math.max(6, (day.gross / maxGross) * 100)}%` }}
                  title={`${day.date}: ${money(day.gross)}`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <p>Etsy fees</p>
                <p className="text-sm text-foreground">{money(data.kpis.fees30d)}</p>
              </div>
              <div>
                <p>Gelato cost</p>
                <p className="text-sm text-foreground">{money(data.kpis.cogs30d)}</p>
              </div>
              <div>
                <p>Orders</p>
                <p className="text-sm text-foreground">{data.kpis.orders30d}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/orders" />}>
              All orders
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No receipts yet.</p>
            ) : (
              data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.buyerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.map((item) => item.title).join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm">{formatMoney(order.subtotal, order.currency)}</span>
                    <StatusPill value={order.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>What is making money</CardTitle>
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/listings" />}>
              Catalog
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.topListings.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {listing.units30d} sold · {listing.gelatoProductName ?? "Unmapped"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium text-profit">
                  {money(listing.net30d)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div className="flex gap-3">
          <Printer className="mt-0.5 size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Fulfill from Etsy</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Paid receipts become Gelato print jobs with the mapped product UID and artwork.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <BadgeDollarSign className="mt-0.5 size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Price for net profit</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Etsy takes ~6.5% plus 3% + $0.25. Listings below Gelato cost get flagged.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Protect Star Seller</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Push Gelato tracking back to Etsy so dispatch time and cases stay clean.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
