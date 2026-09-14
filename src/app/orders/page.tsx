"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Order } from "@/lib/types";

type Payload = {
  orders: Array<Order & { profit: { fees: number; cogs: number; net: number } }>;
};

const filters = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Ready" },
  { id: "blocked", label: "Blocked" },
  { id: "in_production", label: "Printing" },
  { id: "shipped", label: "Shipped" },
  { id: "cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Payload>("/api/orders"));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orders = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.orders.filter((order) => order.status !== "cancelled");
    return data.orders.filter((order) => order.status === filter);
  }, [data, filter]);

  async function fulfill(id: string) {
    setBusy(id);
    try {
      const result = await api<{ gelatoOrderId: string; live: boolean }>(
        `/api/orders/${id}/fulfill`,
        { method: "POST" },
      );
      toast.success(
        result.live
          ? `Sent to Gelato as ${result.gelatoOrderId}`
          : `Queued in sample mode as ${result.gelatoOrderId}`,
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function tracking(id: string) {
    setBusy(id);
    try {
      await api(`/api/orders/${id}/tracking`, { method: "POST" });
      toast.success("Tracking written to the Etsy receipt");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await api(`/api/orders/${id}/cancel`, { method: "POST" });
      toast.success("Cancelled — not sent to Gelato");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function markPaid(id: string) {
    setBusy(id);
    try {
      const result = await api<{ gelatoOrderId?: string }>(`/api/orders/${id}/paid`, {
        method: "POST",
        body: JSON.stringify({ fulfill: true }),
      });
      toast.success(
        result.gelatoOrderId ? `Paid · sent to Gelato as ${result.gelatoOrderId}` : "Marked paid",
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function bulk(action: "fulfill" | "tracking") {
    setBusy(action);
    try {
      const result = await api<{ fulfilled?: number; trackingPushed?: number }>(
        "/api/ops/repair",
        { method: "POST", body: JSON.stringify({ action }) },
      );
      toast.success(
        action === "fulfill"
          ? `Sent ${result.fulfilled ?? 0} orders to Gelato`
          : `Pushed tracking on ${result.trackingPushed ?? 0} receipts`,
      );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading receipts…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pending Fernora rows are unpaid website checkouts (including test orders). Do not
            click Mark paid & print unless money actually arrived — that sends a real Gelato
            print. Cancel test rows. Paid Etsy receipts appear here after Sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void bulk("tracking")} disabled={Boolean(busy)}>
            <Truck />
            Push tracking
          </Button>
          <Button onClick={() => void bulk("fulfill")} disabled={Boolean(busy)}>
            <Send />
            Send ready orders
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(String(value ?? "all"))}>
        <TabsList>
          {filters.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No orders in this view. Unpaid website checkouts stay in Pending until you cancel
            them. Live Etsy sales land here after Sync.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="flex flex-col gap-4 pt-1">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{order.buyerName}</p>
                      <StatusPill value={order.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.channel === "shopify"
                        ? `Shopify ${order.shopifyOrderId || order.etsyReceiptId}`
                        : order.channel === "fernora"
                          ? `Fernora ${order.etsyReceiptId}`
                          : `Etsy #${order.etsyReceiptId}`}
                      {order.gelatoOrderId ? ` · Gelato ${order.gelatoOrderId}` : ""}
                      {" · "}
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatMoney(order.subtotal + order.shippingPaid)}</p>
                    <p className="text-xs text-profit">Net {formatMoney(order.profit.net)}</p>
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.quantity}× {item.title}
                        {item.variation ? ` · ${item.variation}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {item.gelatoProductUid ? "Mapped" : "Needs Gelato product"}
                      </span>
                    </li>
                  ))}
                </ul>
                {order.issues.length ? (
                  <p className="text-xs text-destructive">{order.issues.join(" · ")}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Ships to {order.shippingAddress.city}
                  {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ""},{" "}
                  {order.shippingAddress.country}
                  {order.trackingNumber
                    ? ` · ${order.trackingCarrier} ${order.trackingNumber}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {order.status === "pending" ||
                  (order.status === "paid" && !order.gelatoOrderId) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void cancel(order.id)}
                      disabled={busy === order.id}
                    >
                      {busy === order.id ? <Loader2 className="animate-spin" /> : <X />}
                      Cancel test / unpaid
                    </Button>
                  ) : null}
                  {order.status === "pending" ? (
                    <Button
                      size="sm"
                      onClick={() => void markPaid(order.id)}
                      disabled={busy === order.id}
                    >
                      {busy === order.id ? <Loader2 className="animate-spin" /> : <Send />}
                      Mark paid & print
                    </Button>
                  ) : null}
                  {order.status === "paid" ? (
                    <Button
                      size="sm"
                      onClick={() => void fulfill(order.id)}
                      disabled={busy === order.id}
                    >
                      {busy === order.id ? <Loader2 className="animate-spin" /> : <Send />}
                      Send to Gelato
                    </Button>
                  ) : null}
                  {order.status === "blocked" ? (
                    <Button size="sm" variant="outline" nativeButton={false} render={<a href="/listings" />}>
                      Map listing
                    </Button>
                  ) : null}
                  {(order.status === "shipped" || order.trackingNumber) &&
                  !order.trackingPushedToEtsy ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void tracking(order.id)}
                      disabled={busy === order.id}
                    >
                      <Truck />
                      Push tracking to Etsy
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
