"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Connections } from "@/lib/types";

type LiveStatus = {
  etsyApp: { ok: true; applicationId?: number } | { ok: false; error: string };
  gelato: { ok: true; ordersSeen: number } | { ok: false; error: string };
  shopify?:
    | { ok: true; storefrontStatus?: string; shop?: string; name?: string; url?: string }
    | { ok: false; storefrontStatus?: string; shop?: string; error: string };
  callbackReachable: boolean;
  readyToSell: boolean;
};

type Payload = {
  connections: Connections;
  callbackUrl?: string;
  websiteUrl?: string;
  shopifyCallbackUrl?: string;
  shopUrl?: string;
  callbackIsPublic?: boolean;
  callbackReachable?: boolean;
  live?: LiveStatus;
  etsy: { apiKeySet: boolean; sharedSecretSet: boolean; shopName?: string; shopId?: string };
  gelato: { apiKeySet: boolean };
  shopify?: {
    clientIdSet: boolean;
    clientSecretSet: boolean;
    shop?: string;
    authorized: boolean;
    storefrontStatus?: string;
    scope?: string;
  };
};

export function ConnectionsClient() {
  const search = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [etsyKey, setEtsyKey] = useState("");
  const [etsySecret, setEtsySecret] = useState("");
  const [gelatoKey, setGelatoKey] = useState("");
  const [shopifyKey, setShopifyKey] = useState("");
  const [shopifySecret, setShopifySecret] = useState("");
  const [shopifyShop, setShopifyShop] = useState("fernora.myshopify.com");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<"callback" | "website" | "desk" | "shop" | "shopify-callback" | null>(null);
  const callbackUrl = data?.callbackUrl || "";
  const websiteUrl = data?.websiteUrl || "";
  const shopUrl = data?.shopUrl || (websiteUrl ? `${websiteUrl.replace(/\/$/, "")}/shop` : "/shop");
  const shopifyCallbackUrl = data?.shopifyCallbackUrl || "";
  const deskUrl = websiteUrl ? `${websiteUrl.replace(/\/$/, "")}/connections` : "";
  const callbackIsPublic = Boolean(data?.callbackIsPublic && data?.callbackReachable);
  const live = data?.live;

  const load = useCallback(async () => {
    const next = await api<Payload>("/api/connections");
    setData(next);
    if (next.shopify?.shop) setShopifyShop(next.shopify.shop);
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => toast.error(err.message));
  }, [load]);

  useEffect(() => {
    if (live?.readyToSell) return;
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(id);
  }, [load, live?.readyToSell]);

  useEffect(() => {
    const etsy = search.get("etsy");
    if (etsy === "connected") toast.success("Etsy shop authorized");
    if (etsy === "denied") toast.error("Etsy authorization was cancelled");
    if (etsy === "invalid") toast.error("Etsy OAuth state did not match — try again");
    if (etsy === "error") toast.error(search.get("reason") || "Etsy connect failed");
    const shopify = search.get("shopify");
    if (shopify === "connected") toast.success("Shopify shop authorized");
    if (shopify === "denied") toast.error("Shopify authorization was cancelled");
    if (shopify === "invalid") toast.error("Shopify OAuth state did not match — try again");
    if (shopify === "error") toast.error(search.get("reason") || "Shopify connect failed");
  }, [search]);

  async function saveEtsy() {
    setBusy("etsy");
    try {
      const result = await api<{ etsyLive?: boolean; warning?: string; applicationId?: number }>(
        "/api/connections",
        {
          method: "POST",
          body: JSON.stringify({ etsyApiKey: etsyKey, etsySharedSecret: etsySecret }),
        },
      );
      if (result.etsyLive) {
        toast.success("Etsy API accepted the app. Authorize the shop next.");
      } else {
        toast.warning(result.warning || "Keys saved. Authorize the shop next.");
      }
      setEtsyKey("");
      setEtsySecret("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveShopify() {
    setBusy("shopify");
    try {
      const result = await api<{ shopify?: { ok: boolean; error?: string; storefrontStatus?: string } }>(
        "/api/connections",
        {
          method: "POST",
          body: JSON.stringify({
            shopifyClientId: shopifyKey,
            shopifyClientSecret: shopifySecret,
            shopifyShop,
          }),
        },
      );
      if (result.shopify?.ok) toast.success("Shopify token accepted. Catalog can sync.");
      else toast.warning(result.shopify?.error || "Keys saved. Authorize the Fernora shop next.");
      setShopifyKey("");
      setShopifySecret("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function syncShopify() {
    setBusy("shopify-sync");
    try {
      const result = await api<{ notes: string[]; products?: number }>("/api/shopify/sync", { method: "POST" });
      toast.message(result.notes.join(" · "));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function saveGelato() {
    setBusy("gelato");
    try {
      const result = await api<{ live: boolean; warning?: string }>("/api/gelato/connect", {
        method: "POST",
        body: JSON.stringify({ apiKey: gelatoKey }),
      });
      if (result.live) toast.success("Gelato API key accepted");
      else toast.warning(result.warning || "Key saved, but Gelato did not confirm it yet");
      setGelatoKey("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function resetDemo() {
    setBusy("reset");
    try {
      await api("/api/demo/reset", { method: "POST" });
      toast.success("Sample orders removed. Live Fernora catalog restored.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const result = await api<{ notes: string[] }>("/api/sync", { method: "POST" });
      toast.message(result.notes.join(" · "));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Checking connections…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-4xl tracking-tight">Connections</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pressroom talks to Etsy Open API v3, Shopify Admin API, and Gelato Order API v4.
          FERNORATRENDS stays on Etsy. The Fernora website at /shop sells the same 20 products
          to Australia and New Zealand only, fulfilled by Gelato.
        </p>
      </div>

      <Card className="border-foreground/20">
        <CardHeader>
          <CardTitle>Live desk URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          {callbackIsPublic && deskUrl ? (
            <>
              <p className="text-muted-foreground">
                Open Pressroom here. Cloudflare quick tunnels get a new random hostname
                when they recycle — old names cannot be restored.{" "}
                <code className="rounded bg-muted px-1 text-xs text-foreground">
                  remix-cookbook-brad-initiatives.trycloudflare.com
                </code>{" "}
                is dead. Use this one, and paste the matching Website URL into{" "}
                <strong className="font-medium text-foreground">fernora-etsgelto-app</strong>.
              </p>
              <span className="flex flex-col gap-2 sm:flex-row">
                <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                  {deskUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(deskUrl);
                    setCopied("desk");
                    toast.success("Desk URL copied");
                  }}
                >
                  {copied === "desk" ? "Copied" : "Copy desk"}
                </Button>
              </span>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fernora shop (AU/NZ)</p>
              <span className="flex flex-col gap-2 sm:flex-row">
                <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                  {shopUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shopUrl);
                    setCopied("shop");
                    toast.success("Fernora shop URL copied");
                  }}
                >
                  {copied === "shop" ? "Copied" : "Copy shop"}
                </Button>
              </span>
            </>
          ) : (
            <p className="text-muted-foreground">
              No public .com hostname is reachable yet. Wait for{" "}
              <code className="rounded bg-muted px-1">npm run etsy-tunnel</code> to print a
              new trycloudflare URL. Do not bookmark a previous hostname.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={data.connections.etsy.authorized ? "live" : "demo"} />
        <span className="text-sm text-muted-foreground">
          Etsy{" "}
          {data.connections.etsy.authorized
            ? data.connections.etsy.shopName || "authorized"
            : data.connections.etsy.configured
              ? "keys accepted · authorize shop"
              : "not authorized"}
        </span>
        <StatusPill value={live?.gelato.ok ? "live" : "demo"} />
        <span className="text-sm text-muted-foreground">
          Gelato {live?.gelato.ok ? "print API live" : "not configured"}
        </span>
        <StatusPill value={data.connections.shopify.authorized ? "live" : data.shopify?.storefrontStatus === "frozen" ? "warning" : "demo"} />
        <span className="text-sm text-muted-foreground">
          Shopify{" "}
          {data.connections.shopify.authorized
            ? data.shopify?.shop || "authorized"
            : data.shopify?.storefrontStatus === "frozen"
              ? "fernora frozen · authorize after unfreeze"
              : data.shopify?.clientIdSet
                ? "app keys saved · authorize shop"
                : "not connected"}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p className="text-muted-foreground">
            {live?.readyToSell
              ? "Gelato can print. Paid Etsy and Fernora/Shopify orders go to production."
              : "Gelato can print. Connect Etsy or Shopify, then use the Fernora shop at /shop for AU/NZ."}
          </p>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value={live?.etsyApp.ok ? "live" : "critical"} />
              <span>
                Etsy app API
                {live?.etsyApp.ok && live.etsyApp.applicationId
                  ? ` · application ${live.etsyApp.applicationId}`
                  : live?.etsyApp.ok
                    ? ""
                    : ` · ${live?.etsyApp && !live.etsyApp.ok ? live.etsyApp.error : "checking"}`}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value={data.connections.etsy.authorized ? "live" : "warning"} />
              <span>
                Etsy shop
                {data.connections.etsy.authorized
                  ? ` · ${data.connections.etsy.shopName || "authorized"}`
                  : " · not authorized yet"}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value={live?.gelato.ok ? "live" : "critical"} />
              <span>
                Gelato Order API
                {live?.gelato.ok ? " · key accepted" : ` · ${live?.gelato && !live.gelato.ok ? live.gelato.error : "checking"}`}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value={callbackIsPublic ? "live" : "critical"} />
              <span>
                Public .com callback
                {callbackIsPublic ? " · reachable now" : " · offline (quick tunnels expire — wait for a new hostname)"}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill
                value={
                  data.connections.shopify.authorized
                    ? "live"
                    : data.shopify?.storefrontStatus === "frozen"
                      ? "warning"
                      : "critical"
                }
              />
              <span>
                Shopify Fernora
                {data.connections.shopify.authorized
                  ? ` · ${data.shopify?.shop || "authorized"}`
                  : data.shopify?.storefrontStatus === "frozen"
                    ? " · fernora.myshopify.com exists but the storefront is frozen (unpaid Shopify plan)"
                    : live?.shopify && !live.shopify.ok
                      ? ` · ${live.shopify.error}`
                      : " · not authorized"}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value="live" />
              <span>
                Fernora website · AU/NZ only ·{" "}
                <a className="underline" href="/shop">
                  Open shop
                </a>
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Etsy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Account settings (
              <a
                className="underline"
                href="https://www.etsy.com/nz/your/account"
                target="_blank"
                rel="noreferrer"
              >
                etsy.com/nz/your/account
              </a>
              ) is email and password only. The Open API v3 keys live in the developer portal.
            </p>
            <ol className="list-decimal space-y-3 pl-4 text-sm leading-6 text-muted-foreground">
              <li>
                Open{" "}
                <a
                  className="underline"
                  href="https://www.etsy.com/developers/your-apps"
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage your apps
                </a>{" "}
                → <strong className="font-medium text-foreground">fernora-etsgelto-app</strong>.
                Etsy’s Callback URL field only accepts an HTTPS public hostname (a{" "}
                <strong className="font-medium text-foreground">.com</strong> address). It
                rejects <code className="rounded bg-muted px-1">127.0.0.1</code> and{" "}
                <code className="rounded bg-muted px-1">localhost</code>.
              </li>
              <li>
                {callbackIsPublic ? (
                  <>
                    Paste these exact values. Remove any previous trycloudflare hostname — that
                    tunnel is dead and is why the URL was not reached:
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide">Website URL</p>
                        <span className="flex flex-col gap-2 sm:flex-row">
                          <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                            {websiteUrl}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await navigator.clipboard.writeText(websiteUrl);
                              setCopied("website");
                              toast.success("Website URL copied");
                            }}
                          >
                            {copied === "website" ? "Copied" : "Copy"}
                          </Button>
                        </span>
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide">Callback URL</p>
                        <span className="flex flex-col gap-2 sm:flex-row">
                          <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                            {callbackUrl}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await navigator.clipboard.writeText(callbackUrl);
                              setCopied("callback");
                              toast.success("Callback URL copied");
                            }}
                          >
                            {copied === "callback" ? "Copied" : "Copy"}
                          </Button>
                        </span>
                      </div>
                    </div>
                    If the tunnel restarts, the hostname changes and you must update the Etsy
                    app to match.
                  </>
                ) : (
                  <>
                    No public .com callback is available yet. Run{" "}
                    <code className="rounded bg-muted px-1">npm run etsy-tunnel</code> in this
                    repo (with the desk already running). That prints an{" "}
                    <code className="rounded bg-muted px-1">https://….trycloudflare.com</code>{" "}
                    website URL and matching Callback URL to paste into Etsy.
                    {callbackUrl ? (
                      <code className="mt-2 block break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                        Not ready: {callbackUrl}
                      </code>
                    ) : null}
                  </>
                )}
              </li>
              <li>
                Keys are already saved. After Etsy accepts the .com callback, click authorize
                and approve access for this shop.
              </li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="etsy-key">Keystring</Label>
              <Input
                id="etsy-key"
                value={etsyKey}
                onChange={(event) => setEtsyKey(event.target.value)}
                placeholder={data.etsy.apiKeySet ? "Saved · paste to replace" : "etsy_keystring"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="etsy-secret">Shared secret</Label>
              <Input
                id="etsy-secret"
                type="password"
                value={etsySecret}
                onChange={(event) => setEtsySecret(event.target.value)}
                placeholder={data.etsy.sharedSecretSet ? "Saved · paste to replace" : "shared secret"}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void saveEtsy()} disabled={busy === "etsy"}>
                Save keys
              </Button>
              <a
                href="/api/etsy/connect"
                className={cn(
                  buttonVariants(),
                  !data.etsy.apiKeySet || !callbackIsPublic ? "pointer-events-none opacity-50" : "",
                )}
              >
                Authorize with Etsy
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gelato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
              <li>
                Open{" "}
                <a className="underline" href="https://dashboard.gelato.com/" target="_blank" rel="noreferrer">
                  Gelato dashboard
                </a>{" "}
                → API.
              </li>
              <li>Create an API key. It is sent as the X-API-KEY header, never in the browser after save.</li>
              <li>Paid Etsy receipts use that key to create v4 print orders.</li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="gelato-key">API key</Label>
              <Input
                id="gelato-key"
                type="password"
                value={gelatoKey}
                onChange={(event) => setGelatoKey(event.target.value)}
                placeholder={data.gelato.apiKeySet ? "Saved · paste to replace" : "gelato_live_…"}
              />
            </div>
            <Button onClick={() => void saveGelato()} disabled={!gelatoKey || busy === "gelato"}>
              {busy === "gelato" ? <Loader2 className="animate-spin" /> : null}
              Save and test Gelato
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shopify · Fernora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Store name is <strong className="font-medium text-foreground">fernora</strong> (
              <code className="rounded bg-muted px-1 text-xs">fernora.myshopify.com</code>
              ). Shopify already has that shop, but the public storefront is frozen until a plan
              is paid. The Fernora website at{" "}
              <a className="underline" href="/shop">
                /shop
              </a>{" "}
              sells the same catalog now, ships AU/NZ only, and sends paid orders to Gelato.
            </p>
            <ol className="list-decimal space-y-3 pl-4 text-sm leading-6 text-muted-foreground">
              <li>
                In the Shopify Dev Dashboard app, add this Redirect URL, then unfreeze the store
                if Shopify still shows “Store unavailable”:
                {shopifyCallbackUrl ? (
                  <span className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                      {shopifyCallbackUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shopifyCallbackUrl);
                        setCopied("shopify-callback");
                        toast.success("Shopify callback copied");
                      }}
                    >
                      {copied === "shopify-callback" ? "Copied" : "Copy"}
                    </Button>
                  </span>
                ) : null}
              </li>
              <li>Authorize the app on fernora. Then publish the 20 live products and lock shipping to AU/NZ.</li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="shopify-shop">Shop domain</Label>
              <Input
                id="shopify-shop"
                value={shopifyShop}
                onChange={(event) => setShopifyShop(event.target.value)}
                placeholder="fernora.myshopify.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopify-key">Client ID</Label>
              <Input
                id="shopify-key"
                value={shopifyKey}
                onChange={(event) => setShopifyKey(event.target.value)}
                placeholder={data.shopify?.clientIdSet ? "Saved · paste to replace" : "Shopify client ID"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopify-secret">Client secret</Label>
              <Input
                id="shopify-secret"
                type="password"
                value={shopifySecret}
                onChange={(event) => setShopifySecret(event.target.value)}
                placeholder={data.shopify?.clientSecretSet ? "Saved · paste to replace" : "shpss_…"}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void saveShopify()} disabled={busy === "shopify"}>
                Save Shopify app
              </Button>
              <a
                href="/api/shopify/connect"
                className={cn(
                  buttonVariants(),
                  !data.shopify?.clientIdSet || !callbackIsPublic ? "pointer-events-none opacity-50" : "",
                )}
              >
                Authorize Shopify
              </a>
              <Button
                variant="outline"
                onClick={() => void syncShopify()}
                disabled={!data.connections.shopify.authorized || busy === "shopify-sync"}
              >
                {busy === "shopify-sync" ? <Loader2 className="animate-spin" /> : null}
                Publish catalog · AU/NZ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-muted-foreground">
            Pull live Etsy listings and receipts. Restore the Fernora mix (quotes, botanicals,
            home décor) if the desk was still on leftover demo data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void resetDemo()} disabled={Boolean(busy)}>
              Clear sample data
            </Button>
            <Button onClick={() => void sync()} disabled={Boolean(busy)}>
              {busy === "sync" ? <Loader2 className="animate-spin" /> : null}
              Sync now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
