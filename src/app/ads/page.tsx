"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import type { Connections, MetaAdsCampaign } from "@/lib/types";

type Payload = {
  connections: Connections;
  landingUrl: string;
  dailyBudgetMin: number;
  dailyBudgetMax: number;
  dailyBudgetDefault: number;
  offsiteRate: number;
  campaign: MetaAdsCampaign;
  ping?: { user?: string; accountName?: string; currency?: string };
  pingError?: string;
  meta: {
    accessTokenSet: boolean;
    accessToken: string;
    adAccountId: string;
    pixelId: string;
    pageId: string;
  };
};

export default function AdsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [pageId, setPageId] = useState("");
  const [dailyBudget, setDailyBudget] = useState(5);

  const load = useCallback(async () => {
    const next = await api<Payload>("/api/ads");
    setData(next);
    setError(null);
    setToken(next.meta.accessToken);
    setAdAccountId(next.meta.adAccountId);
    setPixelId(next.meta.pixelId);
    setPageId(next.meta.pageId);
    setDailyBudget(next.campaign.dailyBudget || next.dailyBudgetDefault);
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function saveMeta() {
    setBusy("save");
    try {
      const result = await api<{ live: boolean; notes?: string[]; ping?: { currency?: string } }>(
        "/api/meta/connect",
        {
          method: "POST",
          body: JSON.stringify({ accessToken: token, adAccountId, pixelId, pageId }),
        },
      );
      if (result.live) toast.success("Meta ad account accepted");
      else toast.warning(result.notes?.join(" ") || "Saved. Test the token if the campaign cannot start.");
      for (const note of result.notes || []) toast.message(note);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runCampaign(live: boolean) {
    setBusy(live ? "live" : "create");
    try {
      const result = await api<{ notes?: string[]; campaign: MetaAdsCampaign }>("/api/meta/campaign", {
        method: "POST",
        body: JSON.stringify({ dailyBudget, live }),
      });
      toast.success(live ? `Campaign live at ${dailyBudget}/day` : "Campaign created and paused");
      for (const note of result.notes || []) toast.message(note);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pauseCampaign() {
    setBusy("pause");
    try {
      await api("/api/meta/campaign", { method: "POST", body: JSON.stringify({ pause: true }) });
      toast.success("Campaign paused");
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
        Loading ads…
      </div>
    );
  }

  const currency = data.ping?.currency || data.campaign.currency || "NZD";
  const status = data.campaign.status;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-4xl tracking-tight">Ads</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Meta (Facebook and Instagram) ads from Pressroom land on{" "}
          <a className="underline" href={data.landingUrl} target="_blank" rel="noreferrer">
            fernora.nz
          </a>
          . Daily spend is capped — default {data.dailyBudgetDefault} {currency}, never above{" "}
          {data.dailyBudgetMax}. Leave Etsy Offsite Ads ({Math.round(data.offsiteRate * 100)}% of a
          sale) and Etsy CPC Ads off so the shop is not charged twice.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        <p className="font-medium">Lower spend</p>
        <p className="mt-1 text-muted-foreground">
          Etsy Offsite Ads take {Math.round(data.offsiteRate * 100)}% of an attributed order. A{" "}
          {data.dailyBudgetDefault}/{currency} Meta cap is the cheaper path for fernora.nz. In{" "}
          <strong>Etsy Shop Manager → Marketing</strong> keep Offsite Ads off and Etsy Ads (CPC) off.
          Pressroom cannot flip those Etsy switches.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Meta account</CardTitle>
            <StatusPill value={data.connections.meta.authorized ? "live" : "demo"} />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              In Meta Events Manager create a Pixel. In Business Manager copy the ad account ID, a
              user token with <code>ads_management</code> and <code>ads_read</code>, and the Facebook
              Page ID.{" "}
              <a className="underline" href="https://business.facebook.com" target="_blank" rel="noreferrer">
                business.facebook.com
              </a>
            </p>
            <div className="space-y-1">
              <Label htmlFor="meta-token">Access token</Label>
              <Input
                id="meta-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="EAAB…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meta-account">Ad account ID</Label>
              <Input
                id="meta-account"
                value={adAccountId}
                onChange={(event) => setAdAccountId(event.target.value)}
                placeholder="act_123456789"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meta-pixel">Pixel ID</Label>
              <Input
                id="meta-pixel"
                value={pixelId}
                onChange={(event) => setPixelId(event.target.value)}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meta-page">Facebook Page ID</Label>
              <Input
                id="meta-page"
                value={pageId}
                onChange={(event) => setPageId(event.target.value)}
                placeholder="Needed to publish the ad creative"
              />
            </div>
            {data.pingError ? <p className="text-xs text-destructive">{data.pingError}</p> : null}
            {data.ping?.accountName ? (
              <p className="text-xs text-muted-foreground">
                {data.ping.user} · {data.ping.accountName} · {data.ping.currency}
              </p>
            ) : null}
            <Button onClick={() => void saveMeta()} disabled={Boolean(busy)}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : null}
              Save and install Pixel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Campaign</CardTitle>
            <StatusPill value={status === "active" ? "live" : "warning"} />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Traffic campaign to {data.landingUrl}, ages 25–65 in New Zealand and Australia. Paid
              Shopify orders send a Purchase event back to the Pixel from Pressroom.
            </p>
            <div className="space-y-1">
              <Label htmlFor="meta-budget">Daily budget ({currency})</Label>
              <Input
                id="meta-budget"
                type="number"
                min={data.dailyBudgetMin}
                max={data.dailyBudgetMax}
                value={dailyBudget}
                onChange={(event) => setDailyBudget(Number(event.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Allowed range {data.dailyBudgetMin}–{data.dailyBudgetMax} {currency} per day.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Status: {status}
              {data.campaign.campaignId ? ` · campaign ${data.campaign.campaignId}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void runCampaign(false)}
                disabled={Boolean(busy) || !data.connections.meta.authorized}
              >
                {busy === "create" ? <Loader2 className="animate-spin" /> : <Megaphone />}
                Create paused campaign
              </Button>
              <Button
                onClick={() => void runCampaign(true)}
                disabled={Boolean(busy) || !data.connections.meta.authorized}
              >
                {busy === "live" ? <Loader2 className="animate-spin" /> : null}
                Go live at {dailyBudget}/{currency} a day
              </Button>
              <Button
                variant="ghost"
                onClick={() => void pauseCampaign()}
                disabled={Boolean(busy) || status !== "active"}
              >
                {busy === "pause" ? <Loader2 className="animate-spin" /> : null}
                Pause
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Catalog and prices stay on{" "}
              <Link className="underline" href="/listings">
                Catalog
              </Link>
              . Pixel and Shopify live on{" "}
              <Link className="underline" href="/connections">
                Connections
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
