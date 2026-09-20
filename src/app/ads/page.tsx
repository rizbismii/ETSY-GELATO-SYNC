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
import { isMetaAccountDisabledError } from "@/lib/meta-connect-error";
import type { Connections, MetaAdsCampaign } from "@/lib/types";

type Payload = {
  connections: Connections;
  landingUrl: string;
  dailyBudgetMin: number;
  dailyBudgetMax: number;
  dailyBudgetDefault: number;
  offsiteRate: number;
  offsiteEnabled?: boolean;
  offsiteOptedOutOn?: string;
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
  const metaDisabled = isMetaAccountDisabledError(data.pingError);

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
          {data.dailyBudgetMax}. Etsy Offsite Ads were opted out on {data.offsiteOptedOutOn || "19 September 2026"}
          — do not click Turn on Offsite Ads. On-site Etsy Ads (CPC) stay off so spend is only the Meta cap.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={data.offsiteEnabled ? "warning" : "live"} />
          <p className="font-medium">Etsy Offsite Ads opted out</p>
        </div>
        <p className="mt-1 text-muted-foreground">
          Shop Manager shows Offsite Ads off since {data.offsiteOptedOutOn || "19 September 2026"}. Etsy
          can take a few days to drop leftover Offsite placements. Do not turn them back on. On-site
          Etsy Ads (CPC) stay off. Paid traffic to fernora.nz is the Meta daily cap below (
          {data.dailyBudgetDefault}–{data.dailyBudgetMax} {currency}). Listing prices still survive a{" "}
          {Math.round(data.offsiteRate * 100)}% Offsite hit if a leftover ad attributes a sale.
        </p>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
          metaDisabled ? "border-destructive/40 bg-destructive/5" : "border-border bg-background"
        }`}
      >
        <p className="font-medium">Get the API from Meta for Developers</p>
        <p className="mt-1 text-muted-foreground">
          Stay in{" "}
          <a className="underline" href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
            developers.facebook.com/apps
          </a>
          . Pressroom needs four values: access token, ad account ID, Pixel ID, and Page ID. Keep the
          App Secret in Meta — never paste it here.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>Create app</strong> at{" "}
            <a className="underline" href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noreferrer">
              apps/creation
            </a>
            . Choose <strong>Other</strong> then <strong>Business</strong>, or the use case{" "}
            <strong>Create &amp; manage ads with Marketing API</strong>. Name it Fernora Pressroom.
          </li>
          <li>
            In the app dashboard add the <strong>Marketing API</strong> product if it is not already
            there.
          </li>
          <li>
            Open{" "}
            <a className="underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
              Graph API Explorer
            </a>
            . Meta App = your new app. User or Page = <strong>User Token</strong>. Add permissions{" "}
            <code>ads_management</code>, <code>ads_read</code>, <code>pages_show_list</code>,{" "}
            <code>pages_read_engagement</code>, <code>pages_manage_ads</code>,{" "}
            <code>business_management</code>. Click <strong>Generate Access Token</strong> and allow
            the login dialog. Copy the token (starts with EAAB) into Access token below.
          </li>
          <li>
            In Explorer run <code>GET /me/adaccounts?fields=id,name,account_id,currency</code>. Copy the{" "}
            <code>id</code> that looks like <code>act_…</code> into Ad account ID. If the list is
            empty, create an ad account in{" "}
            <a className="underline" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer">
              Ads Manager
            </a>{" "}
            and run the query again.
          </li>
          <li>
            Run <code>GET /me/accounts?fields=id,name</code>. Copy the Fernora Page <code>id</code> into
            Facebook Page ID. If there is no Page, create one, then run the query again.
          </li>
          <li>
            Run <code>GET /act_YOURID/adspixels?fields=id,name</code> (use the digits after{" "}
            <code>act_</code>). Copy the Pixel <code>id</code>. Or create a Pixel for fernora.nz in{" "}
            <a className="underline" href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer">
              Events Manager
            </a>
            .
          </li>
          <li>Save and install Pixel here. Explorer tokens expire in about an hour — generate a new one if Save fails.</li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          If any of those calls return a disabled / account-integrity error, that login is still the
          blocked Dealstic identity and cannot issue ads API access.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Meta account</CardTitle>
            <StatusPill
              value={data.connections.meta.authorized ? "live" : metaDisabled ? "blocked" : "warning"}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Use the Graph API Explorer steps above. Paste only the user token, ad account ID, Pixel
              ID, and Page ID.{" "}
              <a className="underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
                developers.facebook.com/tools/explorer
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
            <StatusPill value={status === "active" ? "live" : status} />
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
