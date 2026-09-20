"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/status-pill";
import { ProductArt } from "@/components/product-art";
import { api } from "@/lib/api";
import { formatMoney, formatPercent } from "@/lib/money";
import { ETSY_SHOP_URL, etsyListingUrl } from "@/lib/live-catalog";
import { printFileName, printTemplateLabel, printSurface } from "@/lib/print-file";
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
  variants?: Array<{ id: string; color: string; size: string }>;
  gelatoConnectedCount?: number;
  gelatoVariantCount?: number;
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
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);

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

  async function pushPrices() {
    setBusy("reprice");
    try {
      const result = await api<{ updated: number; errors?: string[] }>("/api/listings/reprice", {
        method: "POST",
      });
      if (result.updated) toast.success(`Pushed ${result.updated} prices to Etsy (40% after ads)`);
      else toast.message(result.errors?.[0] || "No Etsy listings to reprice");
      if (result.errors?.length && result.updated) toast.warning(result.errors.slice(0, 3).join(" · "));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function connectGelato() {
    setBusy("gelato");
    try {
      const result = await api<{
        connected: number;
        products: number;
        clothingUpdated?: string[];
        notes?: string[];
      }>("/api/listings/gelato-connect", { method: "POST" });
      toast.success(
        `Attached Gelato templates on ${result.connected} variant${result.connected === 1 ? "" : "s"} across ${result.products} products`,
      );
      if (result.clothingUpdated?.length) {
        toast.message(`Clothing variants on Etsy: ${result.clothingUpdated.join(", ")}`);
      }
      if (result.notes?.length) toast.warning(result.notes.slice(0, 4).join(" · "));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteProduct() {
    if (!pendingDelete) return;
    setBusy(`delete:${pendingDelete.id}`);
    try {
      const result = await api<{ notes?: string[] }>(`/api/listings/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success(`Deleted ${pendingDelete.title}`);
      if (result.notes?.length) toast.message(result.notes.join(" · "));
      setPendingDelete(null);
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
            pieces — not an all-abstract wall. Prices in {currency}. Listings stay priced so a
            worst-case Etsy Offsite sale still leaves 40% after print and fees. Actual ad spend is
            the Meta daily cap on Ads.
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
          <Button
            variant="outline"
            onClick={() => void pushPrices()}
            disabled={Boolean(busy) || !data.etsyAuthorized}
          >
            {busy === "reprice" ? <Loader2 className="animate-spin" /> : null}
            Push 40% prices to Etsy
          </Button>
          <Button
            variant="outline"
            onClick={() => void connectGelato()}
            disabled={Boolean(busy) || !data.gelatoLive}
          >
            {busy === "gelato" ? <Loader2 className="animate-spin" /> : null}
            Attach Gelato templates
          </Button>
          <a
            href={ETSY_SHOP_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Open shop on Etsy
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        <p className="font-medium">Where it ships · how ads are paid</p>
        <p className="mt-1 text-muted-foreground">
          Buyers in{" "}
          {(data.ads?.countries ?? []).map((country) => country.label).join(", ") ||
            "New Zealand, Australia, United States, United Kingdom, European Union"}{" "}
          plus Canada, Ireland, and the selected Americas / Asia / Middle East countries enabled at
          checkout. Japan, Korea, India, Indonesia, the Philippines, and Vietnam stay off. Advertising is a{" "}
          <strong>Meta campaign from Pressroom</strong> to fernora.nz with a low daily cap. Etsy
          Offsite Ads ({adsRate}% of an attributed sale) and on-site CPC Etsy Ads stay off so spend
          does not stack.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Set the daily cap on{" "}
          <a className="underline" href="/ads">
            Ads
          </a>
          . In Etsy Shop Manager → Marketing leave Offsite Ads and Etsy Ads (CPC) off — the Open API
          cannot flip those switches.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6">
        <p className="font-medium">Print file templates</p>
        <p className="mt-1 text-muted-foreground">
          Each product stores its Gelato print file in this catalog. Download the template for the
          current mix, or keep the same <code className="rounded bg-muted px-1 text-xs">printFileUrl</code>{" "}
          when you add future products — publish and Attach Gelato templates push that file.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visible
            .filter((row) => row.printFileUrl)
            .map((row) => (
              <a
                key={row.id}
                href={row.printFileUrl}
                download={printFileName(row.printFileUrl, row.title)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download className="size-3.5" />
                {printFileName(row.printFileUrl, row.title)}
              </a>
            ))}
        </div>
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
                <CardContent className="grid gap-4 p-4 lg:grid-cols-[200px_180px_1fr]">
                  <ProductArt
                    id={listing.id}
                    title={listing.title}
                    category={listing.category}
                    imageUrl={listing.imageUrl}
                    fit="contain"
                    className="h-56 w-full rounded-lg lg:h-full min-h-52"
                  />
                  {listing.printFileUrl ? (
                    <div className="space-y-2">
                      <ProductArt
                        id={`${listing.id}-print`}
                        title={`${listing.title} print file`}
                        category={listing.category}
                        imageUrl={listing.printFileUrl}
                        kind="print"
                        fit="contain"
                        className="h-56 w-full rounded-lg lg:h-full min-h-52"
                      />
                      <p className="text-[11px] leading-4 text-muted-foreground">
                        {printTemplateLabel(listing.category, listing.id)}
                      </p>
                    </div>
                  ) : (
                    <p className="self-center text-xs text-muted-foreground">No print file saved yet.</p>
                  )}
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
                          {printSurface(listing.category) === "dtg" ? " · DTG ink (no paper square)" : ""}
                          {listing.etsyListingId ? ` · Etsy #${listing.etsyListingId}` : " · not on Etsy yet"}
                          {listing.gelatoVariantCount
                            ? ` · Gelato ${listing.gelatoConnectedCount ?? 0}/${listing.gelatoVariantCount} connected`
                            : ""}
                        </p>
                        {listing.variants?.length ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Colours {Array.from(new Set(listing.variants.map((row) => row.color))).join(", ")} ·
                            sizes {Array.from(new Set(listing.variants.map((row) => row.size))).join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="font-heading text-2xl">{formatMoney(listing.price, currency)}</p>
                        <p className="text-profit">
                          NZ net {formatMoney(listing.net, currency)} · {formatPercent(listing.margin)}
                        </p>
                        <p
                          className={`text-xs ${
                            (listing.adsMargin ?? 0) + 1e-9 >= 0.4 ? "text-profit" : "text-destructive"
                          }`}
                        >
                          After Offsite Ads {formatMoney(listing.adsNet ?? 0, currency)} ·{" "}
                          {formatPercent(listing.adsMargin ?? 0)} · target 40%
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
                                className={`px-3 py-2 ${
                                  (lane.adsMargin ?? 0) + 1e-9 >= 0.4 ? "text-profit" : "text-destructive"
                                }`}
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
                      print. After ads is the Etsy Offsite worst case ({adsRate}% of price + shipping) if
                      that switch is left on. Actual spend is the Meta daily cap on Ads.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listing.printFileUrl ? (
                        <a
                          href={listing.printFileUrl}
                          download={printFileName(listing.printFileUrl, listing.title)}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          <Download className="size-3.5" />
                          Download print template
                        </a>
                      ) : null}
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
                      {etsyListingUrl(listing.etsyListingId) || listing.etsyUrl ? (
                        <a
                          href={etsyListingUrl(listing.etsyListingId) || listing.etsyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          View on Etsy
                        </a>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(listing)}
                        disabled={Boolean(busy)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.title}?</DialogTitle>
            <DialogDescription>
              This removes the product from the Gelato store, sets the Etsy listing inactive (the app
              cannot hard-delete Etsy listings), and deletes it from Shopify. It also leaves the
              Pressroom catalog and the Fernora shop.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteProduct()}
              disabled={Boolean(busy)}
            >
              {busy?.startsWith("delete:") ? <Loader2 className="animate-spin" /> : null}
              Delete everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
