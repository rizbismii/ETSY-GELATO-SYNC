"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import type { Connections } from "@/lib/types";

type Payload = {
  connections: Connections;
  etsy: { apiKeySet: boolean; sharedSecretSet: boolean; shopName?: string; shopId?: string };
  gelato: { apiKeySet: boolean };
};

export function ConnectionsClient() {
  const search = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [etsyKey, setEtsyKey] = useState("");
  const [etsySecret, setEtsySecret] = useState("");
  const [gelatoKey, setGelatoKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await api<Payload>("/api/connections"));
  }, []);

  useEffect(() => {
    void load().catch((err: Error) => toast.error(err.message));
  }, [load]);

  useEffect(() => {
    const etsy = search.get("etsy");
    if (etsy === "connected") toast.success("Etsy shop authorized");
    if (etsy === "denied") toast.error("Etsy authorization was cancelled");
    if (etsy === "invalid") toast.error("Etsy OAuth state did not match — try again");
    if (etsy === "error") toast.error(search.get("reason") || "Etsy connect failed");
  }, [search]);

  async function saveEtsy() {
    setBusy("etsy");
    try {
      await api("/api/connections", {
        method: "POST",
        body: JSON.stringify({ etsyApiKey: etsyKey, etsySharedSecret: etsySecret }),
      });
      toast.success("Etsy keys saved. Authorize the shop next.");
      setEtsyKey("");
      setEtsySecret("");
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
      toast.success("Sample shop restored");
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
          Pressroom talks to Etsy Open API v3 and Gelato Order API v4. Until keys are
          saved, the desk runs a full sample shop so you can practice fulfillment.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={data.connections.etsy.authorized ? "live" : "demo"} />
        <span className="text-sm text-muted-foreground">
          Etsy {data.connections.etsy.shopName || "not authorized"}
        </span>
        <StatusPill value={data.connections.gelato.configured ? "live" : "demo"} />
        <span className="text-sm text-muted-foreground">
          Gelato {data.gelato.apiKeySet ? "key on file" : "not configured"}
        </span>
      </div>

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
            <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
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
                while signed in, or{" "}
                <a
                  className="underline"
                  href="https://www.etsy.com/developers/register"
                  target="_blank"
                  rel="noreferrer"
                >
                  register a seller app
                </a>{" "}
                for your own shop.
              </li>
              <li>
                After approval, click the visibility icon and copy the{" "}
                <strong>keystring</strong> and <strong>shared secret</strong>.
              </li>
              <li>
                Set the callback URL to{" "}
                <code className="rounded bg-muted px-1">http://127.0.0.1:43127/api/etsy/callback</code>{" "}
                (or your deployed origin +{" "}
                <code className="rounded bg-muted px-1">/api/etsy/callback</code>).
              </li>
              <li>Paste both below, save, then authorize the shop.</li>
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
              <Button nativeButton={false} render={<a href="/api/etsy/connect" />}>
                Authorize with Etsy
              </Button>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync & sample data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-muted-foreground">
            Pull live Etsy listings and receipts when authorized. Restore the Hearth & Line
            sample shop if you want to rehearse fulfillment without touching production.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void resetDemo()} disabled={Boolean(busy)}>
              Restore sample shop
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
