"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { ProductArt } from "@/components/product-art";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Listing, ProductTemplate } from "@/lib/types";

type Row = Listing & { shippingCost: number; net: number; suggestedPrice: number };
type Payload = { listings: Row[]; catalog: ProductTemplate[] };

export default function ListingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { uid: string; file: string }>>({});

  const load = useCallback(async () => {
    try {
      const payload = await api<Payload>("/api/listings");
      setData(payload);
      setDrafts((current) => {
        const next = { ...current };
        for (const listing of payload.listings) {
          next[listing.id] ??= {
            uid: listing.gelatoProductUid || payload.catalog[0]?.uid || "",
            file: listing.printFileUrl || "",
          };
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(id: string) {
    const draft = drafts[id];
    setBusy(id);
    try {
      await api(`/api/listings/${id}/map`, {
        method: "POST",
        body: JSON.stringify({
          gelatoProductUid: draft.uid,
          printFileUrl: draft.file || undefined,
        }),
      });
      toast.success("Listing mapped to Gelato");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function autoMap() {
    setBusy("map");
    try {
      const result = await api<{ mappedListings: number }>("/api/ops/repair", {
        method: "POST",
        body: JSON.stringify({ action: "map" }),
      });
      toast.success(`Mapped ${result.mappedListings} listings`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reprice() {
    setBusy("price");
    try {
      const result = await api<{ repriced: number }>("/api/ops/repair", {
        method: "POST",
        body: JSON.stringify({ action: "price" }),
      });
      toast.success(`Raised ${result.repriced} thin prices`);
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
        Loading listings…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Listings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each live Etsy listing needs a Gelato product UID, a print file, and a price
            that still nets after marketplace fees.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void reprice()} disabled={Boolean(busy)}>
            Raise thin prices
          </Button>
          <Button onClick={() => void autoMap()} disabled={Boolean(busy)}>
            Auto-map unmapped
          </Button>
        </div>
      </div>

      {data.listings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No listings yet. Connect Etsy to pull your active shop catalog.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.listings.map((listing) => {
            const draft = drafts[listing.id] ?? { uid: "", file: "" };
            const healthy = listing.net >= 4 && listing.gelatoProductUid && listing.printFileUrl;
            return (
              <Card key={listing.id}>
                <CardContent className="flex flex-col gap-4 md:flex-row">
                  <ProductArt
                    id={listing.id}
                    title={listing.title}
                    className="h-24 w-full shrink-0 md:h-28 md:w-28"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{listing.title}</p>
                          <StatusPill value={listing.state} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Etsy #{listing.etsyListingId} · {listing.views} views · {listing.favorites} favorites
                        </p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p>{formatMoney(listing.price)}</p>
                        <p className={listing.net < 4 ? "text-destructive" : "text-profit"}>
                          Net {formatMoney(listing.net)}
                        </p>
                      </div>
                    </div>
                    {listing.issues.length ? (
                      <p className="text-xs text-destructive">{listing.issues.join(" · ")}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {healthy
                          ? `Mapped to ${listing.gelatoProductName}. Ready for Gelato.`
                          : "Connect a Gelato product before this listing sells."}
                      </p>
                    )}
                    {listing.net < 4 && listing.gelatoProductUid ? (
                      <p className="text-xs text-amber-800">
                        Suggested price {formatMoney(listing.suggestedPrice)} to keep about 42% net.
                      </p>
                    ) : null}
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <label className="text-xs text-muted-foreground">
                        Gelato product
                        <select
                          className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                          value={draft.uid}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [listing.id]: { ...draft, uid: event.target.value },
                            }))
                          }
                        >
                          {data.catalog.map((product) => (
                            <option key={product.uid} value={product.uid}>
                              {product.name} · {formatMoney(product.unitCost)} print
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Print file URL
                        <Input
                          className="mt-1"
                          value={draft.file}
                          placeholder="https://…"
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [listing.id]: { ...draft, file: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <div className="flex items-end">
                        <Button
                          className="w-full md:w-auto"
                          size="sm"
                          onClick={() => void save(listing.id)}
                          disabled={busy === listing.id}
                        >
                          {busy === listing.id ? <Loader2 className="animate-spin" /> : null}
                          Save map
                        </Button>
                      </div>
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
