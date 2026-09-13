"use client";

import { useCallback, useEffect, useState } from "react";
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
  net: number;
  margin: number;
};

type Row = Listing & {
  shippingCost: number;
  net: number;
  margin: number;
  suggestedPrice: number;
  lanes: Lane[];
  description?: string;
};

type Payload = {
  listings: Row[];
  shopName: string;
  currency: string;
  etsyAuthorized: boolean;
  gelatoLive: boolean;
};

export default function ListingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      else toast.success(mode === "live" ? "All five are live on Etsy" : "All five saved as Etsy drafts");
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Catalog</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Five Fernora products, each with AI artwork, a real Gelato SKU, and destination
            shipping from the shop’s Gelato Etsy profiles. Prices are in {currency} and set
            so about 42% remains after Etsy fees and the highest regional print cost.
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

      {!data.etsyAuthorized ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Etsy is not authorized yet. You can still review images, locations, and profit.
          Authorize the shop on Connections before a draft or live publish will send.
        </p>
      ) : null}

      {data.listings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No live products yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.listings.map((listing) => {
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
                          <StatusPill value={listing.category} />
                        </div>
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
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{listing.description}</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[32rem] text-left text-xs">
                        <thead className="bg-muted/60 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Ships to</th>
                            <th className="px-3 py-2 font-medium">Print</th>
                            <th className="px-3 py-2 font-medium">Ship</th>
                            <th className="px-3 py-2 font-medium">Etsy fees</th>
                            <th className="px-3 py-2 font-medium">Your net</th>
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
                              <td className="px-3 py-2 text-muted-foreground">{lane.days}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Buyer pays the Gelato shipping profile. Net is the listing price minus Etsy
                      fees and the regional print cost, after shipping is passed through. Shop
                      origin on Etsy is Wellington 6012; Gelato still prints in-region.
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
