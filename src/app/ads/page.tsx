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
import {
  FERNORA_META_APP_DASHBOARD_URL,
  FERNORA_META_APP_ID,
  FERNORA_META_APP_NAME,
  FERNORA_META_BUSINESS_SUITE_URL,
  FERNORA_META_EXPLORER_URL,
  FERNORA_META_INSTAGRAM_ACCOUNTS_URL,
  FERNORA_META_WAIT_ENDED_ON,
} from "@/lib/meta-app";
import { isMetaAccountDisabledError, isMetaTokenExpiredError } from "@/lib/meta-connect-error";
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
  etsyCpcEnabled?: boolean;
  etsyCpcWaitDaysLeft?: number;
  etsyCpcWaitNotedOn?: string;
  etsyCpcWaitNote?: string;
  campaign: MetaAdsCampaign;
  ping?: {
    user?: string;
    accountName?: string;
    currency?: string;
    instagramUserId?: string;
    instagramConnected?: boolean;
  };
  pingError?: string;
  meta: {
    accessTokenSet: boolean;
    accessToken: string;
    adAccountId: string;
    pixelId: string;
    pageId: string;
    instagramUserId: string;
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
  const [instagramUserId, setInstagramUserId] = useState("");
  const [dailyBudget, setDailyBudget] = useState(5);

  const load = useCallback(async () => {
    const next = await api<Payload>("/api/ads");
    setData(next);
    setError(null);
    setToken(next.meta.accessToken);
    setAdAccountId(next.meta.adAccountId);
    setPixelId(next.meta.pixelId);
    setPageId(next.meta.pageId);
    setInstagramUserId(next.meta.instagramUserId);
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
          body: JSON.stringify({ accessToken: token, adAccountId, pixelId, pageId, instagramUserId }),
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
  const metaExpired = isMetaTokenExpiredError(data.pingError);
  const metaLive = Boolean(data.ping?.accountName || data.ping?.user);
  const instagramConnected = Boolean(data.ping?.instagramConnected || instagramUserId);

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
          — do not click Turn on Offsite Ads. Etsy Ads (CPC) are not activated
          {data.etsyCpcWaitDaysLeft
            ? ` — about ${data.etsyCpcWaitDaysLeft} days left in the 15-day new-shop wait as of ${
                data.etsyCpcWaitNotedOn || "20 September 2026"
              }`
            : ""}
          . Do not turn them on.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={data.offsiteEnabled ? "warning" : "live"} />
          <p className="font-medium">Etsy Offsite Ads opted out</p>
        </div>
        <p className="mt-1 text-muted-foreground">
          Shop Manager shows Offsite Ads off since {data.offsiteOptedOutOn || "19 September 2026"}. Etsy
          can take a few days to drop leftover Offsite placements. Do not turn them back on. Etsy Ads
          (CPC) are not activated
          {data.etsyCpcWaitDaysLeft
            ? ` (new shop 15-day wait, ~${data.etsyCpcWaitDaysLeft} days left as of ${
                data.etsyCpcWaitNotedOn || "20 September 2026"
              })`
            : ""}
          . Do not click Start advertising when the wait ends unless we decide to. Paid traffic to
          fernora.nz is the Meta daily cap below ({data.dailyBudgetDefault}–{data.dailyBudgetMax}{" "}
          {currency}). Listing prices still survive a {Math.round(data.offsiteRate * 100)}% Offsite
          hit if a leftover ad attributes a sale.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={data.etsyCpcEnabled ? "warning" : "live"} />
          <p className="font-medium">Etsy Ads (CPC) not activated</p>
        </div>
        <p className="mt-1 text-muted-foreground">
          {data.etsyCpcWaitNote ||
            "The shop is new to Etsy and must wait 15 days before on-site ads. Do not turn them on."}
        </p>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
          metaDisabled || metaExpired ? "border-destructive/40 bg-destructive/5" : "border-border bg-background"
        }`}
      >
        <p className="font-medium">
          {FERNORA_META_APP_NAME} · 48-hour wait ended {FERNORA_META_WAIT_ENDED_ON}
        </p>
        <p className="mt-1 text-muted-foreground">
          Use the existing app{" "}
          <a className="underline" href={FERNORA_META_APP_DASHBOARD_URL} target="_blank" rel="noreferrer">
            {FERNORA_META_APP_NAME}
          </a>{" "}
          ({FERNORA_META_APP_ID}) in Development mode — do not create a second app. The saved Explorer
          token expired 19 September 2026. Generate a new User Token, Save, then create the paused
          campaign in the same sitting. Keep the App Secret in Meta — never paste it here.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Open{" "}
            <a className="underline" href={FERNORA_META_APP_DASHBOARD_URL} target="_blank" rel="noreferrer">
              {FERNORA_META_APP_NAME}
            </a>
            . Add the <strong>Marketing API</strong> product if it is not already there.
          </li>
          <li>
            Open{" "}
            <a className="underline" href={FERNORA_META_EXPLORER_URL} target="_blank" rel="noreferrer">
              Graph API Explorer
            </a>
            . Meta App = {FERNORA_META_APP_NAME}. User or Page = <strong>User Token</strong>. Add{" "}
            <code>ads_management</code>, <code>ads_read</code>, <code>pages_show_list</code>,{" "}
            <code>pages_read_engagement</code>, <code>pages_manage_ads</code>,{" "}
            <code>business_management</code>, <code>instagram_basic</code>. Click{" "}
            <strong>Generate Access Token</strong> as the Fernora login (not Dealstic). Copy the token
            (starts with EAAB) into Access token below.
          </li>
          <li>
            Ad account, Pixel, and Page IDs are already saved. Save here and Pressroom will re-read
            them from Graph. If an ID is empty, run{" "}
            <code>GET /me/adaccounts?fields=id,name,account_id,currency</code>,{" "}
            <code>GET /me/accounts?fields=id,name,instagram_business_account</code>, and{" "}
            <code>GET /act_YOURID/adspixels?fields=id,name</code> in Explorer.
          </li>
          <li>
            Connect Instagram in{" "}
            <a className="underline" href={FERNORA_META_INSTAGRAM_ACCOUNTS_URL} target="_blank" rel="noreferrer">
              Business Suite → Instagram accounts
            </a>{" "}
            to the Fernora Page. Then run{" "}
            <code>GET /PAGE_ID?fields=instagram_business_account</code> and paste that id, or leave it
            blank and Save so Graph can fill it.
          </li>
          <li>
            Save and install Pixel. Then Create paused campaign at {data.dailyBudgetDefault}{" "}
            {currency}/day. Do not click Go live unless we decide to.
          </li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          If Graph returns a disabled / account-integrity error, that login is still the blocked
          Dealstic identity — switch to the Fernora Facebook login that owns {FERNORA_META_APP_NAME}.{" "}
          <a className="underline" href={FERNORA_META_BUSINESS_SUITE_URL} target="_blank" rel="noreferrer">
            Business Suite
          </a>
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Meta account</CardTitle>
            <StatusPill
              value={metaLive ? "live" : metaDisabled ? "blocked" : metaExpired ? "warning" : "warning"}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Paste a fresh {FERNORA_META_APP_NAME} User Token. Ad account, Pixel, and Page stay as
              saved unless Graph returns new ones.{" "}
              <a className="underline" href={FERNORA_META_EXPLORER_URL} target="_blank" rel="noreferrer">
                Graph API Explorer
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
            <div className="space-y-1">
              <Label htmlFor="meta-instagram">Instagram professional ID</Label>
              <Input
                id="meta-instagram"
                value={instagramUserId}
                onChange={(event) => setInstagramUserId(event.target.value)}
                placeholder="Filled from the Page after Instagram is linked"
              />
              <p className="text-[11px] text-muted-foreground">
                {instagramConnected
                  ? "Instagram is linked — the paused campaign can use Facebook and Instagram placements."
                  : "Not linked yet. Connect the Fernora Instagram account to the Page in Business Suite, then Save."}
              </p>
            </div>
            {data.pingError ? <p className="text-xs text-destructive">{data.pingError}</p> : null}
            {data.ping?.accountName ? (
              <p className="text-xs text-muted-foreground">
                {data.ping.user} · {data.ping.accountName} · {data.ping.currency}
                {data.ping.instagramConnected ? " · Instagram linked" : ""}
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
