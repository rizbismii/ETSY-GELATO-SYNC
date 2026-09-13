"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { ProductArt } from "@/components/product-art";
import { api } from "@/lib/api";
import { formatMoney, formatPercent } from "@/lib/money";
import type { Listing } from "@/lib/types";

type Lane = {
  region: string;
  label: string;
  shipping: number;
  printCost: number;
  days: string;
  fees: number;
  ads?: number;
  net: number;
  margin: number;
  adsNet?: number;
  adsMargin?: number;
};

type Row = Listing & {
  shippingCost: number;
  net: number;
  margin: number;
  adsNet?: number;
  adsMargin?: number;
  suggestedPrice: number;
  lanes: Lane[];
  description?: string;
  quote?: string;
  collection?: string;
};

type Payload = {
  listings: Row[];
  shopName: string;
  currency: string;
  etsyAuthorized: boolean;
  gelatoLive: boolean;
  ads?: {
    mode: string;
    rate: number;
    cpcEnabled: boolean;
    countries: Array<{ region: string; label: string }>;
  };
};

const MIX = [
  { id: "all", label: "All" },
  { id: "quote", label: "Quotes" },
  { id: "botanical", label: "Botanical" },
  { id: "scenic", label: "Scenic" },
  { id: "home", label: "Home décor" },
  { id: "original", label: "Original fern" },
] as const;

export default function ListingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mix, setMix] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      setData(await api<Payload>("/api/listings"));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!data) return [];
    if (mix === "all") return data.listings;
    return data.listings.filter((row) => row.collection === mix);
  }, [data, mix]);

  async function publish(id: string, mode: "draft" | "live") {
    setBusy(`${id}:${mode}`);
    try {
      const result = await api<{ url?: string; state: string }>(`/api/listings/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      toast.success(mode === "live" ? "Live on Etsy" : "Saved as Etsy draft");
      if (result.url) window.open(result.url, "_blank");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function publishAll(mode: "draft" | "live") {
    setBusy(`all:${mode}`);
    try {
      const result = await api<{ results: Array<{ id: string; error?: string; url?: string }> }>(
        "/api/listings/publish-all",
        { method: "POST", body: JSON.stringify({ mode }) },
      );
      const failed = result.results.filter((row) => row.error);
      if (failed.length) toast.error(failed.map((row) => row.error).join(" · "));
      else toast.success(mode === "live" ? "Catalog is live on Etsy" : "Saved as Etsy drafts");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading the live catalog…
      </div>
    );
  }

  const currency = data.currency || "NZD";
  const adsRate = Math.round((data.ads?.rate ?? 0.15) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Catalog</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Mixed Fernora shop: positive quote prints, botanicals, scenic work and five home-décor
            pieces — not an all-abstract wall. Prices in {currency}. New listings bake in Offsite Ads
            ({adsRate}% of the sale) so advertised orders still keep about 42% after print.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void publishAll("draft")}
            disabled={Boolean(busy) || !data.etsyAuthorized}
          >
            {busy === "all:draft" ? <Loader2 className="animate-spin" /> : null}
            Save all as drafts
          </Button>
          <Button onClick={() => void publishAll("live")} disabled={Boolean(busy) || !data.etsyAuthorized}>
            {busy === "all:live" ? <Loader2 className="animate-spin" /> : null}
            Publish all live
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        <p className="font-medium">Where it ships · how ads are paid</p>
        <p className="mt-1 text-muted-foreground">
          Buyers in{" "}
          {(data.ads?.countries ?? []).map((country) => country.label).join(", ") ||
            "New Zealand, Australia, United States, United Kingdom, European Union"}{" "}
          see destination shipping at checkout (Gelato prints in-region). Advertising is{" "}
          <strong>Etsy Offsite Ads</strong>: {adsRate}% of that sale only if an ad brought the
          buyer. On-site CPC Etsy Ads stay off so there is no daily click budget eating profit.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Confirm Offsite Ads is on and Etsy Ads (CPC) is off in Shop Manager → Marketing. The Open
          API cannot flip those switches.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MIX.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={mix === option.id ? "default" : "outline"}
            onClick={() => setMix(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {!data.etsyAuthorized ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Etsy is not authorized yet. You can still review images, locations, and profit.
          Authorize the shop on Connections before a draft or live publish will send.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing in this mix yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {visible.map((listing) => {
            const status = listing.publishState || "ready";
            return (
              <Card key={listing.id}>
                <CardContent className="grid gap-4 p-4 lg:grid-cols-[220px_1fr]">
                  <ProductArt
                    id={listing.id}
                    title={listing.title}
                    category={listing.category}
                    imageUrl={listing.imageUrl}
                    className="h-56 w-full rounded-lg lg:h-full min-h-52"
                  />
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{listing.title}</p>
                          <StatusPill value={status === "live" ? "live" : status === "draft" ? "paid" : "drop"} />
                          <StatusPill value={listing.collection || listing.category} />
                        </div>
                        {listing.quote ? (
                          <p className="mt-1 font-heading text-lg text-foreground/80">“{listing.quote}”</p>
                        ) : null}
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {listing.gelatoProductName} · {listing.category}
                          {listing.etsyListingId ? ` · Etsy #${listing.etsyListingId}` : " · not on Etsy yet"}
                        </p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="font-heading text-2xl">{formatMoney(listing.price, currency)}</p>
                        <p className="text-profit">
                          NZ net {formatMoney(listing.net, currency)} · {formatPercent(listing.margin)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          After Offsite Ads {formatMoney(listing.adsNet ?? 0, currency)} ·{" "}
                          {formatPercent(listing.adsMargin ?? 0)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{listing.description}</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[36rem] text-left text-xs">
                        <thead className="bg-muted/60 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Ships to</th>
                            <th className="px-3 py-2 font-medium">Print</th>
                            <th className="px-3 py-2 font-medium">Ship</th>
                            <th className="px-3 py-2 font-medium">Etsy fees</th>
                            <th className="px-3 py-2 font-medium">Organic net</th>
                            <th className="px-3 py-2 font-medium">After ads {adsRate}%</th>
                            <th className="px-3 py-2 font-medium">Transit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(listing.lanes || []).map((lane) => (
                            <tr key={lane.region} className="border-t border-border/70">
                              <td className="px-3 py-2">{lane.label}</td>
                              <td className="px-3 py-2">{formatMoney(lane.printCost, currency)}</td>
                              <td className="px-3 py-2">{formatMoney(lane.shipping, currency)}</td>
                              <td className="px-3 py-2">{formatMoney(lane.fees, currency)}</td>
                              <td className={`px-3 py-2 ${lane.net < 8 ? "text-destructive" : "text-profit"}`}>
                                {formatMoney(lane.net, currency)} ({formatPercent(lane.margin)})
                              </td>
                              <td
                                className={`px-3 py-2 ${(lane.adsNet ?? 0) < 8 ? "text-destructive" : "text-profit"}`}
                              >
                                {formatMoney(lane.adsNet ?? 0, currency)} (
                                {formatPercent(lane.adsMargin ?? 0)})
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{lane.days}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Buyer pays destination shipping. Organic net is price minus marketplace fees and
                      print. After ads subtracts Offsite Ads ({adsRate}% of price + shipping) only when
                      Etsy attributes the order — never a CPC click budget.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void publish(listing.id, "draft")}
                        disabled={Boolean(busy) || !data.etsyAuthorized}
                      >
                        {busy === `${listing.id}:draft` ? <Loader2 className="animate-spin" /> : null}
                        Save Etsy draft
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void publish(listing.id, "live")}
                        disabled={Boolean(busy) || !data.etsyAuthorized}
                      >
                        {busy === `${listing.id}:live` ? <Loader2 className="animate-spin" /> : null}
                        Publish live
                      </Button>
                      {listing.etsyUrl ? (
                        <a
                          href={listing.etsyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          View on Etsy
                        </a>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
