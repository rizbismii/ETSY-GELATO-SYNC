"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type TunnelRow = {
  origin: string;
  status: "updated" | "not_updated";
  note: string;
  at?: string;
};

type Payload = {
  connections: Connections;
  callbackUrl?: string;
  websiteUrl?: string;
  shopifyCallbackUrl?: string;
  shopifyAppUrl?: string;
  shopUrl?: string;
  callbackIsPublic?: boolean;
  callbackReachable?: boolean;
  live?: LiveStatus;
  tunnel?: {
    origin: string;
    etsy: TunnelRow;
    shopify: TunnelRow;
    gelato: TunnelRow;
  };
  etsy: {
    apiKeySet: boolean;
    sharedSecretSet: boolean;
    apiKey?: string;
    sharedSecret?: string;
    shopName?: string;
    shopId?: string;
  };
  gelato: { apiKeySet: boolean; apiKey?: string };
  shopify?: {
    clientIdSet: boolean;
    clientSecretSet: boolean;
    clientId?: string;
    clientSecret?: string;
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
  const dirty = useRef<Record<string, boolean>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<
    | "callback"
    | "website"
    | "desk"
    | "shop"
    | "shopify-callback"
    | "shopify-app"
    | "etsy-key"
    | "etsy-secret"
    | "gelato-key"
    | "shopify-key"
    | "shopify-secret"
    | null
  >(null);
  const [shopifyAuthOpen, setShopifyAuthOpen] = useState(false);
  const callbackUrl = data?.callbackUrl || "";
  const websiteUrl = data?.websiteUrl || "";
  const shopUrl = data?.shopUrl || (websiteUrl ? `${websiteUrl.replace(/\/$/, "")}/shop` : "/shop");
  const shopifyCallbackUrl = data?.shopifyCallbackUrl || "";
  const shopifyAppUrl = data?.shopifyAppUrl || websiteUrl;
  const deskUrl = websiteUrl ? `${websiteUrl.replace(/\/$/, "")}/connections` : "";
  const callbackIsPublic = Boolean(data?.callbackIsPublic && data?.callbackReachable);
  const live = data?.live;

  const load = useCallback(async () => {
    const next = await api<Payload>("/api/connections");
    setData(next);
    if (next.shopify?.shop) setShopifyShop(next.shopify.shop);
    if (!dirty.current.etsyKey) setEtsyKey(next.etsy.apiKey || "");
    if (!dirty.current.etsySecret) setEtsySecret(next.etsy.sharedSecret || "");
    if (!dirty.current.gelatoKey) setGelatoKey(next.gelato.apiKey || "");
    if (!dirty.current.shopifyKey) setShopifyKey(next.shopify?.clientId || "");
    if (!dirty.current.shopifySecret) setShopifySecret(next.shopify?.clientSecret || "");
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
    if (shopify === "error") {
      const reason = search.get("reason") || "Shopify connect failed";
      toast.error(reason);
      if (/matching hosts|App URL|Redirect URL|application url|redirect_uri/i.test(reason)) {
        setShopifyAuthOpen(true);
      }
    }
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
      dirty.current.etsyKey = false;
      dirty.current.etsySecret = false;
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
      dirty.current.shopifyKey = false;
      dirty.current.shopifySecret = false;
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
      dirty.current.gelatoKey = false;
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

  async function pushTunnel(platform: "etsy" | "shopify" | "gelato" | "all") {
    setBusy(`tunnel-${platform}`);
    try {
      const result = await api<{ tunnel: NonNullable<Payload["tunnel"]> }>("/api/connections/tunnel", {
        method: "POST",
        body: JSON.stringify({ platform }),
      });
      setData((current) => (current ? { ...current, tunnel: result.tunnel } : current));
      const rows =
        platform === "all"
          ? [result.tunnel.etsy, result.tunnel.shopify, result.tunnel.gelato]
          : [result.tunnel[platform]];
      if (rows.every((row) => row.status === "updated")) toast.success("Tunnel updated");
      else toast.warning(rows.map((row) => `${row.status === "updated" ? "Tunnel updated" : "Tunnel not updated"}: ${row.note}`).join(" · "));
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

  function secretField(
    id: string,
    copyId: "etsy-key" | "etsy-secret" | "gelato-key" | "shopify-key" | "shopify-secret",
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    dirtyKey: string,
    saved?: boolean,
  ) {
    const visible = Boolean(show[id]);
    const hint = saved && value.length >= 4 ? `Kept on this desk · ends ${value.slice(-4)}` : saved ? "Kept on this desk" : null;
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex gap-2">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(event) => {
              dirty.current[dirtyKey] = true;
              onChange(event.target.value);
            }}
            placeholder={placeholder}
            autoComplete="off"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setShow((current) => ({ ...current, [id]: !current[id] }))}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          >
            {visible ? <EyeOff /> : <Eye />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={async () => {
              if (!value) return;
              await navigator.clipboard.writeText(value);
              setCopied(copyId);
              toast.success(`${label} copied`);
            }}
            aria-label={`Copy ${label}`}
          >
            <Copy />
          </Button>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {copied === copyId ? <p className="text-xs text-muted-foreground">Copied</p> : null}
      </div>
    );
  }

  function copyUrlRow(
    label: string,
    value: string,
    copyId: "shopify-app" | "shopify-callback",
    toastLabel: string,
  ) {
    if (!value) return null;
    return (
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide">{label}</p>
        <span className="flex flex-col gap-2 sm:flex-row">
          <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
            {value}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              setCopied(copyId);
              toast.success(toastLabel);
            }}
          >
            {copied === copyId ? "Copied" : "Copy"}
          </Button>
        </span>
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

      {search.get("shopify") === "error" &&
      /matching hosts|App URL|Redirect URL|application url|redirect_uri/i.test(search.get("reason") || "") ? (
        <Card className="border-amber-500/40">
          <CardContent className="pt-6 text-sm leading-6">
            <p className="font-medium text-foreground">Shopify matching hosts</p>
            <p className="mt-1 text-muted-foreground">
              {search.get("reason") ||
                "The Dev Dashboard App URL is still an old tunnel hostname. Copy App URL and Redirect URL from this page, save them in the Shopify app URLs, then Authorize again."}
            </p>
            <Button className="mt-3" onClick={() => setShopifyAuthOpen(true)}>
              Copy matching URLs
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-foreground/20">
        <CardHeader>
          <CardTitle>Live desk URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          {callbackIsPublic && deskUrl ? (
            <>
              <p className="text-muted-foreground">
                Open Pressroom here. Cloudflare quick tunnels get a new random hostname
                when they recycle — old names cannot be restored. Use this URL, and paste
                the matching Website URL into{" "}
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
              No public .com hostname is reachable yet. Run{" "}
              <code className="rounded bg-muted px-1">npm run desk</code> (Pressroom + live
              tunnel) and wait for a trycloudflare URL. Do not bookmark a previous hostname.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tunnel · Etsy · Shopify · Gelato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p className="text-muted-foreground">
            Cloudflare quick tunnels get a new hostname when they recycle. That does not delete
            saved Etsy, Shopify, or Gelato keys. Push the live desk URL so Pressroom OAuth,
            Shopify paid-order webhooks, and Gelato print-file URLs all use the current tunnel.
            Etsy’s developer portal still needs the Website + Callback URLs pasted if Authorize
            fails.
          </p>
          <ul className="space-y-3">
            {(
              [
                ["etsy", "Etsy"],
                ["shopify", "Shopify"],
                ["gelato", "Gelato"],
              ] as const
            ).map(([id, label]) => {
              const row = data.tunnel?.[id];
              return (
                <li key={id} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={row?.status || "not_updated"} />
                      <span className="font-medium">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{row?.note || "Not pushed yet."}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void pushTunnel(id)}
                    disabled={Boolean(busy)}
                  >
                    {busy === `tunnel-${id}` ? <Loader2 className="animate-spin" /> : null}
                    Push to {label}
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button onClick={() => void pushTunnel("all")} disabled={Boolean(busy)}>
            {busy === "tunnel-all" ? <Loader2 className="animate-spin" /> : null}
            Push this tunnel to all three
          </Button>
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
            : data.shopify?.clientIdSet
              ? "app keys saved · paste matching App URL + Redirect URL, then authorize"
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
                  : " · keys work; click Authorize with Etsy as the FERNORATRENDS owner"}
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
                  : data.shopify?.clientIdSet
                    ? data.shopify?.storefrontStatus === "frozen"
                      ? " · fernora is frozen (unpaid plan). Paste matching App URL + Redirect URL, then Authorize"
                      : " · paste matching App URL + Redirect URL in the Dev Dashboard, then Authorize"
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
                    app Website + Callback URLs. Keystring and shared secret stay saved — a new
                    tunnel does not delete them.
                  </>
                ) : (
                  <>
                    No public .com callback is available yet. Run{" "}
                    <code className="rounded bg-muted px-1">npm run desk</code> in this
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
                Keys are already saved — that is why the app API shows Live. The shop row stays
                Waiting until you click <strong className="font-medium text-foreground">Authorize with Etsy</strong>{" "}
                and approve access while signed in as the FERNORATRENDS owner. A new tunnel hostname
                does not keep a previous OAuth login; authorize once on the current callback URL.
              </li>
            </ol>
            <div className="space-y-4">
              {secretField(
                "etsy-key",
                "etsy-key",
                "Keystring",
                etsyKey,
                setEtsyKey,
                data.etsy.apiKeySet ? "Saved on this desk" : "etsy_keystring",
                "etsyKey",
                data.etsy.apiKeySet,
              )}
              {secretField(
                "etsy-secret",
                "etsy-secret",
                "Shared secret",
                etsySecret,
                setEtsySecret,
                data.etsy.sharedSecretSet ? "Saved on this desk" : "shared secret",
                "etsySecret",
                data.etsy.sharedSecretSet,
              )}
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
                Open the{" "}
                <a
                  className="underline"
                  href="https://developers.gelato.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Gelato API Portal
                </a>. Sign in as an admin. This is not the Create store dashboard at{" "}
                <a
                  className="underline"
                  href="https://dashboard.gelato.com/home/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  dashboard.gelato.com
                </a>{" "}
                — there is no API key there.
              </li>
              <li>
                In the left sidebar expand <strong className="font-medium text-foreground">Developer</strong>, then
                click <strong className="font-medium text-foreground">API Keys</strong>. Existing keys show a
                name and status only; Gelato never redisplays a saved secret.
              </li>
              <li>
                Click <strong className="font-medium text-foreground">Add API key</strong> (top right), name it{" "}
                Pressroom, then <strong className="font-medium text-foreground">Create key</strong>. Copy it
                immediately — once you leave that page the full key is gone.
              </li>
              <li>
                Paste it below and click{" "}
                <strong className="font-medium text-foreground">Save and test Gelato</strong>.
                Pressroom keeps this key permanently. A new tunnel hostname does not delete it.
                Paid Etsy receipts use it to create v4 print orders.
              </li>
            </ol>
            <p className="text-sm leading-6 text-muted-foreground">
              Gelato’s own steps:{" "}
              <a
                className="underline"
                href="https://support.gelato.com/en/articles/8996574-how-do-i-add-remove-deactivate-or-replace-an-api-key"
                target="_blank"
                rel="noreferrer"
              >
                How do I add an API key?
              </a>
            </p>
            {secretField(
              "gelato-key",
              "gelato-key",
              "API key",
              gelatoKey,
              setGelatoKey,
              data.gelato.apiKeySet ? "Saved on this desk" : "gelato_live_…",
              "gelatoKey",
              data.gelato.apiKeySet,
            )}
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
                Open the{" "}
                <a
                  className="underline"
                  href="https://dev.shopify.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  Shopify Dev Dashboard
                </a>{" "}
                app → <strong className="font-medium text-foreground">URLs</strong>. Shopify
                rejects OAuth when <strong className="font-medium text-foreground">App URL</strong>{" "}
                and <strong className="font-medium text-foreground">Allowed redirection URL</strong>{" "}
                use different hostnames — that is the “matching hosts” error. Paste both of these
                from the live desk (they share this tunnel hostname), then save:
                {shopifyAppUrl || shopifyCallbackUrl ? (
                  <div className="mt-2 space-y-2">
                    {copyUrlRow("App URL", shopifyAppUrl, "shopify-app", "Shopify App URL copied")}
                    {copyUrlRow(
                      "Allowed redirection URL",
                      shopifyCallbackUrl,
                      "shopify-callback",
                      "Shopify Redirect URL copied",
                    )}
                  </div>
                ) : null}
                If the tunnel hostname changes, update both fields before Authorize. Leave the
                storefront frozen if you like — OAuth still needs matching hosts.
              </li>
              <li>
                Click <strong className="font-medium text-foreground">Authorize Shopify</strong>{" "}
                only after those two URLs are saved. Then publish the 20 live products and lock
                shipping to AU/NZ.
              </li>
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
            {secretField(
              "shopify-key",
              "shopify-key",
              "Client ID",
              shopifyKey,
              setShopifyKey,
              data.shopify?.clientIdSet ? "Saved on this desk" : "Shopify client ID",
              "shopifyKey",
              Boolean(data.shopify?.clientIdSet),
            )}
            {secretField(
              "shopify-secret",
              "shopify-secret",
              "Client secret",
              shopifySecret,
              setShopifySecret,
              data.shopify?.clientSecretSet ? "Saved on this desk" : "shpss_…",
              "shopifySecret",
              Boolean(data.shopify?.clientSecretSet),
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void saveShopify()} disabled={busy === "shopify"}>
                Save Shopify app
              </Button>
              <Button
                onClick={() => setShopifyAuthOpen(true)}
                disabled={!data.shopify?.clientIdSet || !callbackIsPublic}
              >
                Authorize Shopify
              </Button>
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

      <Dialog open={shopifyAuthOpen} onOpenChange={setShopifyAuthOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>App URL and Redirect URL must match</DialogTitle>
            <DialogDescription>
              Shopify shows “redirect_uri and application url must have matching hosts” when the
              Dev Dashboard still has an old trycloudflare hostname. Paste both values below into{" "}
              <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noreferrer">
                the app URLs page
              </a>
              , save, then continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {copyUrlRow("App URL", shopifyAppUrl, "shopify-app", "Shopify App URL copied")}
            {copyUrlRow(
              "Allowed redirection URL",
              shopifyCallbackUrl,
              "shopify-callback",
              "Shopify Redirect URL copied",
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Both must use {shopifyAppUrl || "this desk’s hostname"}. Do not mix an old tunnel
              with the current Redirect URL.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopifyAuthOpen(false)}>
              Cancel
            </Button>
            <a
              href="/api/shopify/connect"
              className={cn(
                buttonVariants(),
                !data.shopify?.clientIdSet || !callbackIsPublic ? "pointer-events-none opacity-50" : "",
              )}
            >
              I saved both — Authorize
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
