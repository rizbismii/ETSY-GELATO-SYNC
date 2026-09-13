"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney, formatPercent } from "@/lib/money";
import type { DailyRevenue, Listing } from "@/lib/types";

type Payload = {
  kpis: {
    gross30d: number;
    net30d: number;
    fees30d: number;
    cogs30d: number;
    orders30d: number;
  };
  revenue: DailyRevenue[];
  topListings: Array<Listing & { units30d: number; net30d: number }>;
  shopName: string;
};

export default function RevenuePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Payload>("/api/revenue")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Crunching the last 30 days…
      </div>
    );
  }

  const max = Math.max(...data.revenue.map((day) => Math.max(day.gross, day.net, 1)));
  const margin = data.kpis.gross30d ? data.kpis.net30d / data.kpis.gross30d : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-4xl tracking-tight">Revenue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gross is what buyers paid on Etsy. Net is what you keep after marketplace
          fees and Gelato print-and-ship cost.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Gross
            </CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-3xl">
            {formatMoney(data.kpis.gross30d)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Etsy fees
            </CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-3xl">
            {formatMoney(data.kpis.fees30d)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Gelato cost
            </CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-3xl">
            {formatMoney(data.kpis.cogs30d)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Net margin
            </CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-3xl text-profit">
            {formatPercent(margin)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Daily gross vs net</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-1">
            {data.revenue.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-stretch justify-end gap-0.5">
                <div
                  className="rounded-sm bg-primary/35"
                  style={{ height: `${(day.gross / max) * 100}%` }}
                  title={`${day.date} gross ${formatMoney(day.gross)}`}
                />
                <div
                  className="rounded-sm bg-primary"
                  style={{ height: `${Math.max(2, (Math.max(day.net, 0) / max) * 100)}%` }}
                  title={`${day.date} net ${formatMoney(day.net)}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-primary/35" /> Gross
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-primary" /> Net
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product contribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.topListings.map((listing) => (
            <div key={listing.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{listing.title}</p>
                <p className="text-xs text-muted-foreground">
                  {listing.units30d} units · listed at {formatMoney(listing.price)}
                </p>
              </div>
              <p className="text-profit">{formatMoney(listing.net30d)}</p>
            </div>
          ))}
          {data.topListings.every((row) => row.units30d === 0) ? (
            <p className="text-sm text-muted-foreground">
              No sales in this window yet. Fulfill a few orders and the mix will show here.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
