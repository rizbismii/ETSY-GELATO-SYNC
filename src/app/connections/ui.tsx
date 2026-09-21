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
import { printifyConnectionHeadline, printifyShopLine, type PrintifyGpsrStatus, type PrintifyShopSummary } from "@/lib/printify-gpsr";
import { FERNORA_SHOPIFY_SHOP, FERNORA_SHOPIFY_STOREFRONT } from "@/lib/shopify-shop";
import type { Connections } from "@/lib/types";

type LiveStatus = {
  etsyApp: { ok: true; applicationId?: number } | { ok: false; error: string };
  gelato: { ok: true; ordersSeen: number } | { ok: false; error: string };
  shopify?:
    | { ok: true; storefrontStatus?: string; shop?: string; name?: string; url?: string }
    | { ok: false; storefrontStatus?: string; shop?: string; error: string };
  printify?:
    | {
        ok: true;
        shopTitle?: string;
        shopId?: number;
        gpsrStatus?: PrintifyGpsrStatus;
        salesChannel?: string;
        fullyConnected?: boolean;
        shops?: PrintifyShopSummary[];
      }
    | { ok: false; error: string };
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
  printify?: {
    apiTokenSet: boolean;
    apiToken?: string;
    shopId?: string;
    shopTitle?: string;
    gpsrStatus?: PrintifyGpsrStatus | "";
    salesChannel?: string;
    fullyConnected?: boolean;
    shops?: PrintifyShopSummary[];
  };
  shopify?: {
    clientIdSet: boolean;
    clientSecretSet: boolean;
    clientId?: string;
    clientSecret?: string;
    shop?: string;
    authorized: boolean;
    storefrontStatus?: string;
    scope?: string;
    accessTokenSet?: boolean;
    accessToken?: string;
  };
  shopifyInstallUrl?: string;
};

function printifyShopsFrom(data: Payload) {
  if (data.live?.printify && data.live.printify.ok && data.live.printify.shops?.length) return data.live.printify.shops;
  return data.printify?.shops || data.connections.printify.shops || [];
}

function printifyHeadlineFrom(data: Payload) {
  const live = data.live?.printify && data.live.printify.ok ? data.live.printify : undefined;
  return printifyConnectionHeadline({
    gpsrStatus: live?.gpsrStatus || data.printify?.gpsrStatus || data.connections.printify.gpsrStatus,
    fullyConnected: live?.fullyConnected ?? data.printify?.fullyConnected ?? data.connections.printify.fullyConnected,
    shops: printifyShopsFrom(data),
    etsyShopName: data.connections.etsy.shopName,
  });
}

function printifyPillFrom(data: Payload): "live" | "warning" | "demo" {
  if (data.live?.printify?.ok) return data.live.printify.fullyConnected ? "live" : "warning";
  return data.connections.printify.configured ? "warning" : "demo";
}

export function ConnectionsClient() {
  const search = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [etsyKey, setEtsyKey] = useState("");
  const [etsySecret, setEtsySecret] = useState("");
  const [gelatoKey, setGelatoKey] = useState("");
  const [printifyToken, setPrintifyToken] = useState("");
  const [shopifyKey, setShopifyKey] = useState("");
  const [shopifySecret, setShopifySecret] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");
  const [shopifyShop, setShopifyShop] = useState(FERNORA_SHOPIFY_SHOP);
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
    | "printify-key"
    | "shopify-key"
    | "shopify-secret"
    | "shopify-token"
    | null
  >(null);
  const [shopifyAuthOpen, setShopifyAuthOpen] = useState(false);
  const callbackUrl = data?.callbackUrl || "";
  const websiteUrl = data?.websiteUrl || "";
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
    if (!dirty.current.printifyToken) setPrintifyToken(next.printify?.apiToken || "");
    if (!dirty.current.shopifyKey) setShopifyKey(next.shopify?.clientId || "");
    if (!dirty.current.shopifySecret) setShopifySecret(next.shopify?.clientSecret || "");
    if (!dirty.current.shopifyToken) setShopifyToken(next.shopify?.accessToken || "");
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => toast.error(err.message));
  }, [load]);

  useEffect(() => {
    const framedByShopify = [...(window.location.ancestorOrigins || [])].some((origin) =>
      origin.includes("shopify.com"),
    );
    if (framedByShopify && window.top && window.top !== window) {
      window.top.location.href = window.location.href;
    }
  }, []);

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
      if (/matching hosts|App URL|Redirect URL|application url|redirect_uri|your-app\.com|Credentials/i.test(reason)) {
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
            shopifyAccessToken: shopifyToken,
          }),
        },
      );
      if (result.shopify?.ok) toast.success("Shopify token accepted. Catalog can sync.");
      else toast.warning(result.shopify?.error || "Keys saved. Release App URL + Redirect URL, then Authorize.");
      dirty.current.shopifyKey = false;
      dirty.current.shopifySecret = false;
      dirty.current.shopifyToken = false;
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function fetchAdminToken() {
    setBusy("shopify-token");
    try {
      const result = await api<{ ok: boolean; shopify?: { ok?: boolean; name?: string } }>(
        "/api/shopify/token",
        { method: "POST" },
      );
      if (result.ok) {
        toast.success(
          result.shopify?.name
            ? `Shopify connected · ${result.shopify.name}`
            : "Shopify Admin token saved. Catalog can sync.",
        );
      } else {
        toast.warning("Shopify did not accept the token yet.");
      }
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
  async function savePrintify() {
    setBusy("printify");
    try {
      const result = await api<{
        live: boolean;
        warning?: string;
        notes?: string[];
        gpsrStatus?: PrintifyGpsrStatus;
        fullyConnected?: boolean;
        ping?: { shopTitle?: string; fullyConnected?: boolean };
      }>(
        "/api/printify/connect",
        {
          method: "POST",
          body: JSON.stringify({ apiToken: printifyToken }),
        },
      );
      if (result.live) {
        toast.success(
          result.fullyConnected || result.ping?.fullyConnected
            ? `Printify fully connected · ${result.ping?.shopTitle || "shop live"}`
            : result.ping?.shopTitle
              ? `Printify token live · ${result.ping.shopTitle} · not fully connected`
              : "Printify token accepted · not fully connected",
        );
      } else toast.warning(result.warning || "Token saved, but Printify did not confirm it yet");
      if (result.gpsrStatus === "non-eu") {
        toast.message("Non-EU hold. Printify is the main supplier except EU/UK — Gelato stays connected for those destinations only.");
      }
      for (const note of result.notes || []) toast.message(note);
      dirty.current.printifyToken = false;
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function createPrintifyProducts() {
    setBusy("printify-products");
    try {
      const result = await api<{
        products?: Array<{ id: string; title: string; skipped: boolean }>;
        notes?: string[];
        fullyConnected?: boolean;
        shopTitle?: string;
      }>("/api/printify/products", { method: "POST" });
      const created = (result.products || []).filter((row) => !row.skipped);
      const skipped = (result.products || []).filter((row) => row.skipped);
      toast.success(
          created.length
          ? `Created ${created.length} Printify product${created.length === 1 ? "" : "s"} on ${result.shopTitle || "Printify"} · 1 variant each`
          : skipped.length
            ? `${skipped.map((row) => row.title).join(" and ")} already on ${result.shopTitle || "Printify"}`
            : "Printify products unchanged",
      );
      for (const note of result.notes || []) toast.message(note);
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
      toast.success("Sample orders removed. Deleted catalog products stay cleared.");
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
    copyId:
      | "etsy-key"
      | "etsy-secret"
      | "gelato-key"
      | "printify-key"
      | "shopify-key"
      | "shopify-secret"
      | "shopify-token",
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
          Pressroom talks to Etsy Open API v3, Shopify Admin API, Printify, and Gelato Order API v4.
          FERNORATRENDS stays on Etsy. Printify is the main print supplier except the United Kingdom
          and the European Union. Gelato stays connected for those destinations only — leave every
          saved connection as it is. The customer website is the Shopify Online Store at{" "}
          <a className="underline" href="https://fernora.nz">
            fernora.nz
          </a>
          . /shop on this desk is the catalog preview. Catalog is one Printify product per item.
        </p>
      </div>

      {search.get("shopify") === "error" &&
      /matching hosts|App URL|Redirect URL|application url|redirect_uri|your-app\.com|Credentials/i.test(search.get("reason") || "") ? (
        <Card className="border-amber-500/40">
          <CardContent className="pt-6 text-sm leading-6">
            <p className="font-medium text-foreground">Shopify matching hosts</p>
            <p className="mt-1 text-muted-foreground">
              {search.get("reason") ||
                "Application URL is still https://your-app.com. Credentials Redirect URLs do not count. Create and Release a version with App URL + Allowed redirection URL, then Authorize."}
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fernora shop (Shopify · fernora.nz)</p>
              <span className="flex flex-col gap-2 sm:flex-row">
                <code className="block flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                  https://fernora.nz
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText("https://fernora.nz");
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
        <StatusPill value={printifyPillFrom(data)} />
        <span className="text-sm text-muted-foreground">
          Printify{" "}
          {live?.printify?.ok
            ? [live.printify.shopTitle || "shop connected", printifyHeadlineFrom(data)].filter(Boolean).join(" · ")
            : data.connections.printify.configured
              ? "token saved · check the shop"
              : "not connected"}
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
        <StatusPill value={data.connections.meta.authorized ? "live" : "warning"} />
        <span className="text-sm text-muted-foreground">
          Meta ads{" "}
          {data.connections.meta.authorized ? (
            <a className="underline" href="/ads">
              campaign desk
            </a>
          ) : (
            <a className="underline" href="/ads">
              not connected — get token + IDs from developers.facebook.com on Ads
            </a>
          )}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p className="text-muted-foreground">
            {live?.readyToSell
              ? "Printify is the main printer except EU/UK. Gelato stays connected for those destinations. One Printify product per catalog item — do not republish onto Gelato."
              : "Printify is the main printer except EU/UK. Leave Etsy, Shopify, Printify, and Gelato connections as they are."}
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
              <StatusPill value={printifyPillFrom(data)} />
              <span>
                Printify
                {live?.printify?.ok
                  ? ` · ${live.printify.shopTitle || data.printify?.shopTitle || "shop connected"} · ${printifyHeadlineFrom(data)}`
                  : " · paste a personal access token below · Printify is the main supplier except EU/UK"}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value={data.connections.meta.authorized ? "live" : "warning"} />
              <span>
                Meta ads
                {data.connections.meta.authorized
                  ? " · ad account linked · low daily cap on Ads"
                  : " · not connected · get the token from developers.facebook.com · open Ads"}
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <StatusPill value="live" />
              <span>
                Fernora website · Shopify Online Store · same country set as Etsy ·{" "}
                <a className="underline" href="https://fernora.nz" target="_blank" rel="noreferrer">
                  Open fernora.nz
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
            <p className="text-xs leading-5 text-muted-foreground">
              Catalog shop sections (Quotes, Botanical, Scenic, Home décor, Original fern) need the
              shops_w scope. Authorize once more when you want those Etsy dropdowns created. Do not
              disconnect the saved keys.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gelato · EU/UK hold</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Gelato stays connected for the United Kingdom and the European Union (GPSR). Leave this
              key saved. Do not rebuild Shopify or the website around Gelato right now — that work stays
              in draft. Printify is the main supplier everywhere else.
            </p>
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
            <CardTitle>Printify</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Printify is the main print supplier except the United Kingdom and the European Union.
              Keep the token and the Etsy-connected Fernora Trends shop. Keep seven catalog products
              (five wall-art mixes plus black-camo men’s and Southern Cross women’s mesh sneakers) and publish them to Etsy,
              Shopify, and fernora.nz. Do not
              migrate leftover External products, and do not republish the old Gelato mix.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep <strong className="font-medium text-foreground">Non-EU</strong> on Printify.
              Wellington 6012 is not a valid GPSR address, so EU/UK orders stay on Gelato. Leave the
              Gelato connection saved. Shopify and website Gelato shipping stay as they are for later.
            </p>
            <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
              <li>
                Printify has two shops named Fernora Trends. In the left store dropdown, open the one
                that is <strong className="font-medium text-foreground">connected to Etsy</strong>{" "}
                (shop 28911689). The seven catalog products with print templates are there. The
                disconnected Fernora Trends shop is not the catalog.
              </li>
              <li>Do not click Migrate product on leftover External products.</li>
              <li>
                Recreate or refresh the seven catalog products on Printify, then publish them to Etsy,
                Shopify, and the website. Print files must match the listing photo — Fern Arc prints
                the open fern on the catalog card, not a different curled frond. Mesh sneakers use
                black camo on the men’s pair and the Southern Cross star-and-fern print on the women’s pair. They land in{" "}
                <strong className="font-medium text-foreground">My products</strong> on the
                Etsy-connected shop.
              </li>
              <li>Save Printify below so this desk refreshes shop names. Do not change the other connections.</li>
            </ol>
            {secretField(
              "printify-key",
              "printify-key",
              "Personal access token",
              printifyToken,
              setPrintifyToken,
              data.printify?.apiTokenSet ? "Saved on this desk" : "Printify token",
              "printifyToken",
              data.printify?.apiTokenSet,
            )}
            {printifyShopsFrom(data).length ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {printifyShopsFrom(data).map((shop) => (
                  <li key={shop.id}>{printifyShopLine(shop, data.connections.etsy.shopName)}</li>
                ))}
              </ul>
            ) : data.printify?.shopTitle ? (
              <p className="text-xs text-muted-foreground">
                Shop {data.printify.shopTitle}
                {data.printify.shopId ? ` · ${data.printify.shopId}` : ""}
                {printifyHeadlineFrom(data) ? ` · ${printifyHeadlineFrom(data)}` : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void savePrintify()} disabled={!printifyToken || busy === "printify"}>
                {busy === "printify" ? <Loader2 className="animate-spin" /> : null}
                Save Printify and check shops
              </Button>
              <Button
                variant="outline"
                onClick={() => void createPrintifyProducts()}
                disabled={!printifyToken || Boolean(busy)}
              >
                {busy === "printify-products" ? <Loader2 className="animate-spin" /> : null}
                Create 6-product catalog · publish to shops
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shopify · Fernora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Shop domain is{" "}
              <code className="rounded bg-muted px-1 text-xs">
                {data.shopify?.shop || FERNORA_SHOPIFY_SHOP}
              </code>
              {data.shopify?.storefrontStatus === "live"
                ? ` · storefront is live at ${FERNORA_SHOPIFY_STOREFRONT}.`
                : data.shopify?.storefrontStatus === "frozen"
                  ? " · storefront is frozen until a plan is paid."
                  : "."}{" "}
              Customers buy on the Shopify Online Store (
              <a className="underline" href="https://fernora.nz" target="_blank" rel="noreferrer">
                fernora.nz
              </a>
              ): native checkout, Shop Pay, accounts, markets, and destination shipping. Leave this
              connection as it is. Do not click Publish catalog to push the old Gelato 9-pack clothing
              mix back onto fernora.nz. Catalog dropdowns already match Printify.{" "}
              <a className="underline" href="/shop">
                /shop
              </a>{" "}
              on this desk is the catalog preview.
            </p>
            <div
              id="shopify-admin-token"
              className="scroll-mt-24 space-y-3 rounded-lg border border-foreground/20 bg-muted/40 p-3"
            >
              <p className="font-medium text-foreground">Admin API access token</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Shopify no longer shows a copyable <code className="rounded bg-muted px-1 text-xs">shpat_</code>{" "}
                token in admin or on the Dev Dashboard. Client ID and secret are already saved here.
                Pressroom fetches the token after the app is installed on this shop.
              </p>
              <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    className="underline"
                    href="https://dev.shopify.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Dev Dashboard
                  </a>{" "}
                  → this app → <strong className="font-medium text-foreground">Home</strong> →{" "}
                  <strong className="font-medium text-foreground">Install app</strong> → choose{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    {data.shopify?.shop || FERNORA_SHOPIFY_SHOP}
                  </code>{" "}
                  → Install. Use a full browser tab. If you see “admin.shopify.com refused to
                  connect”, Shopify was opened inside a frame — close that and install from Home
                  instead.
                </li>
                <li>
                  Come back here and click <strong className="font-medium text-foreground">Get Admin token</strong>.
                </li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://dev.shopify.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Open Dev Dashboard
                </a>
                <Button
                  onClick={() => void fetchAdminToken()}
                  disabled={!data.shopify?.clientIdSet || busy === "shopify-token"}
                >
                  {busy === "shopify-token" ? <Loader2 className="animate-spin" /> : null}
                  Get Admin token
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-50/40 p-3 text-sm leading-6 text-foreground">
              <p className="font-medium">Fernorav1 matching hosts</p>
              <p className="mt-1 text-muted-foreground">
                Authorize Shopify still fails until App URL is this desk host. Skip that and install
                from Dev Dashboard Home, then Get Admin token.
              </p>
            </div>
            <ol className="list-decimal space-y-3 pl-4 text-sm leading-6 text-muted-foreground">
              <li>
                Only if you still want OAuth:{" "}
                <a
                  className="underline"
                  href="https://dev.shopify.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  Dev Dashboard
                </a>{" "}
                → Versions → <strong className="font-medium text-foreground">Fernorav1</strong> →{" "}
                <strong className="font-medium text-foreground">Create version</strong> → URLs.
                Paste both, then <strong className="font-medium text-foreground">Release</strong>.
                {shopifyAppUrl || shopifyCallbackUrl ? (
                  <div className="mt-2 space-y-2">
                    {copyUrlRow(
                      "Fernorav1 App URL (must be this host, not your-app.com)",
                      shopifyAppUrl,
                      "shopify-app",
                      "Shopify App URL copied",
                    )}
                    {copyUrlRow(
                      "Allowed redirection URL (must end with /api/shopify/callback)",
                      shopifyCallbackUrl,
                      "shopify-callback",
                      "Shopify Redirect URL copied",
                    )}
                  </div>
                ) : null}
              </li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="shopify-shop">Shop domain</Label>
              <Input
                id="shopify-shop"
                value={shopifyShop}
                onChange={(event) => setShopifyShop(event.target.value)}
                placeholder={FERNORA_SHOPIFY_SHOP}
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
            {secretField(
              "shopify-token",
              "shopify-token",
              "Legacy Admin token (only if you still have shpat_)",
              shopifyToken,
              setShopifyToken,
              data.shopify?.accessTokenSet ? "Saved on this desk" : "Not shown in Shopify — use Get Admin token",
              "shopifyToken",
              Boolean(data.shopify?.accessTokenSet),
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
                Leave Shopify catalog unchanged
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
            Pull live Etsy listings and receipts. Printify holds seven catalog products.
            Catalog dropdowns match Printify. Etsy shop sections need shops_w — Authorize with Etsy
            once so Quotes, Botanical, Scenic, Home décor, and Original fern can be created.
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
            <DialogTitle>Fernorav1 App URL is still the wrong host</DialogTitle>
            <DialogDescription>
              Shopify only checks matching hosts after you sign in. Releasing Fernorav1 does not
              help if its App URL is still your-app.com, shopify.dev, or a press site. Open
              Fernorav1 → Create version → URLs, paste the App URL below, Release, then continue.
              Or paste an Admin API token on Connections instead.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
            <li>Click the Active version Fernorav1, then Create version.</li>
            <li>Set App URL to the hostname below. Redirect URL must end with /api/shopify/callback.</li>
            <li>Release that new version. Then authorize.</li>
          </ol>
          <div className="space-y-3">
            {copyUrlRow("App URL", shopifyAppUrl, "shopify-app", "Shopify App URL copied")}
            {copyUrlRow(
              "Allowed redirection URL",
              shopifyCallbackUrl,
              "shopify-callback",
              "Shopify Redirect URL copied",
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Both must use {shopifyAppUrl || "this desk’s hostname"}. Do not leave{" "}
              <code className="rounded bg-muted px-1">your-app.com</code> as App URL.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopifyAuthOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                (window.top ?? window).location.assign("/api/shopify/connect");
              }}
              disabled={!data.shopify?.clientIdSet || !callbackIsPublic}
            >
              I released both — Authorize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
