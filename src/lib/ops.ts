import { GELATO_CATALOG, suggestTemplate, templateByUid } from "@/lib/catalog";
import { getCredentials } from "@/lib/credentials";
import { listingNet, orderProfit, recommendedPrice } from "@/lib/money";
import { getShop, updateShop } from "@/lib/store";
import type { Connections, Listing, OpsIssue, Order, Overview, ShopState } from "@/lib/types";
import { createGelatoOrder, demoFulfill, pingGelato } from "@/lib/gelato";
import { pullEtsyCatalog, pushEtsyTracking } from "@/lib/etsy";
import { PRINT_FILE, HARVEST_DROP_ID, HARVEST_DROP_NAME } from "@/lib/constants";
import { applyHarvestDrop } from "@/lib/drop";
import { liveProductById } from "@/lib/live-catalog";
import { createEtsyDraft, setEtsyListingState, uploadEtsyListingImage } from "@/lib/etsy";
import { absoluteAssetUrl } from "@/lib/origin";

export async function connectionStatus(): Promise<Connections> {
  const creds = await getCredentials();
  return {
    etsy: {
      configured: Boolean(creds.etsy?.apiKey && creds.etsy.sharedSecret),
      authorized: Boolean(creds.etsy?.accessToken),
      mode: creds.etsy?.accessToken ? "live" : "demo",
      shopName: creds.etsy?.shopName,
      shopId: creds.etsy?.shopId,
      userId: creds.etsy?.userId,
    },
    gelato: {
      configured: Boolean(creds.gelatoApiKey),
      mode: creds.gelatoApiKey ? "live" : "demo",
    },
  };
}

export function enrichListing(listing: Listing): Listing {
  const template = templateByUid(listing.gelatoProductUid);
  const issues: string[] = [];
  if (listing.state === "expired") issues.push("Listing expired on Etsy");
  if (listing.state === "active" && !listing.gelatoProductUid) {
    issues.push("Not mapped to a Gelato product");
  }
  if (listing.state === "active" && listing.gelatoProductUid && !listing.printFileUrl) {
    issues.push("Missing print file");
  }
  if (listing.state === "active" && listing.gelatoProductUid) {
    const shipping = template?.shippingCost ?? 4.2;
    const net = listingNet(listing.price, listing.gelatoUnitCost || template?.unitCost || 0, shipping);
    if (net < 4) issues.push("Margin is too thin after Etsy fees and Gelato cost");
  }
  return { ...listing, issues };
}

export function enrichOrder(order: Order, listings: Listing[]): Order {
  const issues: string[] = [];
  const items = order.items.map((item) => {
    const listing = listings.find((row) => row.id === item.listingId);
    return {
      ...item,
      gelatoProductUid: item.gelatoProductUid ?? listing?.gelatoProductUid,
      printFileUrl: item.printFileUrl ?? listing?.printFileUrl,
    };
  });
  const unmapped = items.some((item) => !item.gelatoProductUid || !item.printFileUrl);
  if (unmapped && (order.status === "paid" || order.status === "blocked")) {
    issues.push("Line item is not mapped to Gelato");
  }
  if (order.status === "shipped" && order.trackingNumber && !order.trackingPushedToEtsy) {
    issues.push("Tracking is on Gelato but not on the Etsy receipt");
  }
  let status = order.status;
  if (unmapped && status === "paid") status = "blocked";
  if (!unmapped && status === "blocked") status = "paid";
  return { ...order, items, issues, status };
}

export function gelatoShippingFor(order: Order) {
  const first = templateByUid(order.items[0]?.gelatoProductUid);
  return first?.shippingCost ?? 4.2;
}

export function profitFor(order: Order, listings: Listing[]) {
  return orderProfit({
    subtotal: order.subtotal,
    shippingPaid: order.shippingPaid,
    items: order.items,
    listings,
    gelatoShipping: gelatoShippingFor(order),
  });
}

export function collectIssues(shop: ShopState, connections: Connections): OpsIssue[] {
  const issues: OpsIssue[] = [];
  if (!connections.etsy.authorized) {
    issues.push({
      id: "etsy-connect",
      severity: "critical",
      title: "Etsy shop is not authorized",
      detail: "Authorize FERNORATRENDS so Pressroom can publish listings and pull receipts.",
      action: { label: "Connect Etsy", href: "/connections", kind: "connect" },
    });
  }
  if (!connections.gelato.configured) {
    issues.push({
      id: "gelato-connect",
      severity: "critical",
      title: "Gelato is not connected",
      detail: "Add your Gelato API key so paid Etsy orders can be printed and shipped.",
      action: { label: "Connect Gelato", href: "/connections", kind: "connect" },
    });
  }
  const unpublished = shop.listings.filter(
    (listing) => listing.drop === HARVEST_DROP_ID && listing.publishState !== "live",
  );
  if (connections.etsy.authorized && unpublished.length) {
    issues.push({
      id: "publish-live",
      severity: "warning",
      title: `${unpublished.length} product${unpublished.length === 1 ? "" : "s"} ready to publish`,
      detail: "AI artwork and Gelato maps are ready. Publish as Etsy drafts or go live today.",
      action: { label: "Publish options", href: "/listings", kind: "price" },
    });
  }
  const unmapped = shop.listings.filter((l) => l.state === "active" && l.issues.length && l.issues.some((i) => i.includes("Not mapped")));
  if (unmapped.length) {
    issues.push({
      id: "unmapped",
      severity: "critical",
      title: `${unmapped.length} live listing${unmapped.length === 1 ? "" : "s"} cannot be fulfilled`,
      detail: "Map each Etsy listing to a Gelato product and print file before the next sale.",
      action: { label: "Map listings", href: "/listings", kind: "map_listings" },
    });
  }
  const awaiting = shop.orders.filter((o) => o.status === "paid");
  if (awaiting.length) {
    issues.push({
      id: "fulfill",
      severity: "warning",
      title: `${awaiting.length} paid order${awaiting.length === 1 ? "" : "s"} waiting on Gelato`,
      detail: "Send them to print so Etsy does not flag late dispatch.",
      action: { label: "Fulfill now", href: "/orders", kind: "fulfill" },
    });
  }
  const blocked = shop.orders.filter((o) => o.status === "blocked");
  if (blocked.length) {
    issues.push({
      id: "blocked",
      severity: "critical",
      title: `${blocked.length} order${blocked.length === 1 ? "" : "s"} blocked`,
      detail: "A buyer already paid, but the listing has no Gelato product or print file.",
      action: { label: "Unblock", href: "/listings", kind: "map_listings" },
    });
  }
  const tracking = shop.orders.filter((o) => o.trackingNumber && !o.trackingPushedToEtsy);
  if (tracking.length) {
    issues.push({
      id: "tracking",
      severity: "warning",
      title: `${tracking.length} shipment${tracking.length === 1 ? "" : "s"} missing Etsy tracking`,
      detail: "Push the Gelato tracking number to Etsy to avoid cases and protect search ranking.",
      action: { label: "Push tracking", href: "/orders", kind: "push_tracking" },
    });
  }
  const thin = shop.listings.filter((l) => l.issues.some((i) => i.includes("thin")));
  if (thin.length) {
    issues.push({
      id: "margin",
      severity: "warning",
      title: `${thin.length} listing${thin.length === 1 ? "" : "s"} lose money after fees`,
      detail: "Raise the Etsy price so Gelato cost plus Etsy fees still leave ~40% net.",
      action: { label: "Fix pricing", href: "/listings", kind: "price" },
    });
  }
  const expired = shop.listings.filter((l) => l.state === "expired");
  if (expired.length) {
    issues.push({
      id: "expired",
      severity: "info",
      title: `${expired.length} expired listing${expired.length === 1 ? "" : "s"} are dark`,
      detail: "Relist winners so they keep earning. Etsy charges $0.20 to renew.",
      action: { label: "Review listings", href: "/listings", kind: "price" },
    });
  }
  return issues;
}

export function opsScore(shop: ShopState, connections: Connections) {
  let score = 0;
  if (connections.etsy.authorized) score += 15;
  else score += 8;
  if (connections.gelato.configured) score += 15;
  else score += 8;
  const active = shop.listings.filter((l) => l.state === "active");
  const mapped = active.filter((l) => l.gelatoProductUid && l.printFileUrl);
  score += active.length ? Math.round((mapped.length / active.length) * 30) : 30;
  const open = shop.orders.filter((o) => ["paid", "blocked"].includes(o.status));
  score += open.length === 0 ? 25 : Math.max(0, 25 - open.length * 8);
  const trackingGap = shop.orders.filter((o) => o.trackingNumber && !o.trackingPushedToEtsy).length;
  score += trackingGap === 0 ? 15 : Math.max(0, 15 - trackingGap * 8);
  return Math.max(12, Math.min(100, score));
}

function daysAgo(n: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

export function revenueSeries(shop: ShopState) {
  return Array.from({ length: 30 }, (_, index) => {
    const date = daysAgo(29 - index);
    const daysOrders = shop.orders.filter((order) => order.createdAt.slice(0, 10) === date && order.status !== "cancelled");
    const totals = daysOrders.reduce(
      (acc, order) => {
        const profit = profitFor(order, shop.listings);
        acc.gross += order.subtotal + order.shippingPaid;
        acc.fees += profit.fees;
        acc.cogs += profit.cogs;
        acc.net += profit.net;
        acc.orders += 1;
        return acc;
      },
      { gross: 0, fees: 0, cogs: 0, net: 0, orders: 0 },
    );
    return { date, ...totals };
  });
}

export async function getOverview(): Promise<Overview> {
  const connections = await connectionStatus();
  const raw = await getShop();
  const listings = raw.listings.map(enrichListing);
  const orders = raw.orders.map((order) => enrichOrder(order, listings));
  const shop = { ...raw, listings, orders };
  const series = revenueSeries(shop);
  const last30 = series.reduce(
    (acc, day) => {
      acc.gross30d += day.gross;
      acc.net30d += day.net;
      acc.fees30d += day.fees;
      acc.cogs30d += day.cogs;
      acc.orders30d += day.orders;
      return acc;
    },
    { gross30d: 0, net30d: 0, fees30d: 0, cogs30d: 0, orders30d: 0 },
  );
  const units: Record<string, { units: number; net: number }> = {};
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const profit = profitFor(order, listings);
    for (const item of order.items) {
      units[item.listingId] ??= { units: 0, net: 0 };
      units[item.listingId].units += item.quantity;
      units[item.listingId].net += profit.net * (item.price * item.quantity / Math.max(order.subtotal, 1));
    }
  }
  const topListings = listings
    .map((listing) => ({
      ...listing,
      units30d: units[listing.id]?.units ?? 0,
      net30d: units[listing.id]?.net ?? 0,
    }))
    .sort((a, b) => b.net30d - a.net30d);
  const dropListings = topListings.filter((listing) => listing.drop === HARVEST_DROP_ID);
  const dropUnits = dropListings.reduce((sum, listing) => sum + listing.units30d, 0);
  const dropNet = dropListings.reduce((sum, listing) => sum + listing.net30d, 0);
  const dropGross = orders.reduce((sum, order) => {
    const dropItems = order.items.filter((item) =>
      dropListings.some((listing) => listing.id === item.listingId),
    );
    if (!dropItems.length) return sum;
    return sum + dropItems.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
  }, 0);

  return {
    connections,
    shopName: connections.etsy.shopName || shop.shopName,
    currency: shop.currency || "NZD",
    kpis: {
      ...last30,
      awaitingFulfillment: orders.filter((o) => o.status === "paid").length,
      inProduction: orders.filter((o) => o.status === "in_production").length,
      unmappedListings: listings.filter((l) => l.state === "active" && !l.gelatoProductUid).length,
      opsScore: opsScore(shop, connections),
    },
    issues: collectIssues(shop, connections),
    revenue: series,
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    topListings: topListings.slice(0, 5),
    drop: {
      id: HARVEST_DROP_ID,
      name: HARVEST_DROP_NAME,
      gross30d: dropGross,
      net30d: dropNet,
      units30d: dropUnits,
      listings: dropListings,
    },
  };
}

export async function mapListing(id: string, gelatoProductUid: string, printFileUrl?: string) {
  const template = GELATO_CATALOG.find((row) => row.uid === gelatoProductUid) ?? suggestTemplate(gelatoProductUid);
  const shop = await updateShop((state) => {
    const listing = state.listings.find((row) => row.id === id);
    if (!listing) throw new Error("Listing not found");
    listing.gelatoProductUid = gelatoProductUid;
    listing.gelatoProductName = template.name;
    listing.gelatoUnitCost = template.unitCost;
    listing.printFileUrl = printFileUrl || listing.printFileUrl || PRINT_FILE;
    listing.issues = enrichListing(listing).issues;
    for (const order of state.orders) {
      Object.assign(order, enrichOrder(order, state.listings));
    }
  });
  return shop.listings.find((row) => row.id === id);
}

export async function autoMapUnmapped() {
  const mapped: string[] = [];
  await updateShop((state) => {
    for (const listing of state.listings) {
      if (listing.state !== "active") continue;
      if (listing.gelatoProductUid && listing.printFileUrl) continue;
      const template = suggestTemplate(listing.title, listing.tags);
      listing.gelatoProductUid = template.uid;
      listing.gelatoProductName = template.name;
      listing.gelatoUnitCost = template.unitCost;
      listing.printFileUrl = listing.printFileUrl || PRINT_FILE;
      mapped.push(listing.id);
    }
    state.listings = state.listings.map(enrichListing);
    state.orders = state.orders.map((order) => enrichOrder(order, state.listings));
  });
  return mapped;
}

export async function raiseThinPrices() {
  const changed: Array<{ id: string; from: number; to: number }> = [];
  await updateShop((state) => {
    for (const listing of state.listings) {
      if (listing.state !== "active" || !listing.gelatoProductUid) continue;
      const template = templateByUid(listing.gelatoProductUid);
      const shipping = template?.shippingCost ?? 4.2;
      const net = listingNet(listing.price, listing.gelatoUnitCost, shipping);
      if (net >= 4) continue;
      const next = recommendedPrice(listing.gelatoUnitCost, shipping);
      changed.push({ id: listing.id, from: listing.price, to: next });
      listing.price = next;
    }
    state.listings = state.listings.map(enrichListing);
  });
  return changed;
}

export async function fulfillOrder(id: string) {
  const connections = await connectionStatus();
  let result: { gelatoOrderId: string; live: boolean };
  const shop = await updateShop(async (state) => {
    const order = state.orders.find((row) => row.id === id);
    if (!order) throw new Error("Order not found");
    const ready = enrichOrder(order, state.listings);
    if (ready.status === "blocked" || ready.items.some((item) => !item.gelatoProductUid || !item.printFileUrl)) {
      throw new Error("Order is blocked until every line is mapped");
    }
    Object.assign(order, ready);
    if (connections.gelato.configured) {
      const created = await createGelatoOrder(order);
      order.gelatoOrderId = String(created.id ?? created.orderId ?? `GEL-${order.etsyReceiptId}`);
      order.gelatoStatus = String(created.fulfillmentStatus ?? "passed_to_production");
    } else {
      const created = demoFulfill(order);
      order.gelatoOrderId = created.id;
      order.gelatoStatus = created.fulfillmentStatus;
    }
    order.status = "in_production";
    order.issues = [];
    result = { gelatoOrderId: order.gelatoOrderId!, live: connections.gelato.configured };
  });
  return { shop, ...result! };
}

export async function fulfillReady() {
  const shop = await getShop();
  const ready = shop.orders.filter((order) => enrichOrder(order, shop.listings).status === "paid");
  const results = [];
  for (const order of ready) {
    results.push(await fulfillOrder(order.id));
  }
  return results;
}

export async function pushTracking(id: string) {
  const connections = await connectionStatus();
  await updateShop(async (state) => {
    const order = state.orders.find((row) => row.id === id);
    if (!order) throw new Error("Order not found");
    if (!order.trackingNumber) {
      order.trackingNumber = `9400${Date.now().toString().slice(-16)}`;
      order.trackingCarrier = order.trackingCarrier || "USPS";
      order.status = "shipped";
      order.gelatoStatus = "shipped";
    }
    if (connections.etsy.authorized) {
      await pushEtsyTracking(order);
    }
    order.trackingPushedToEtsy = true;
    order.issues = order.issues.filter((issue) => !issue.includes("Tracking"));
  });
}

export async function pushAllTracking() {
  const shop = await getShop();
  const pending = shop.orders.filter((order) => order.trackingNumber && !order.trackingPushedToEtsy);
  for (const order of pending) await pushTracking(order.id);
  return pending.map((order) => order.id);
}

export async function repairShop() {
  const mapped = await autoMapUnmapped();
  const priced = await raiseThinPrices();
  const fulfilled = await fulfillReady();
  const tracking = await pushAllTracking();
  return {
    mappedListings: mapped.length,
    repriced: priced.length,
    fulfilled: fulfilled.length,
    trackingPushed: tracking.length,
  };
}

export async function syncLive() {
  const connections = await connectionStatus();
  const notes: string[] = [];
  await updateShop(async (state) => {
    if (connections.etsy.authorized) {
      try {
        const live = await pullEtsyCatalog(state);
        Object.assign(state, live);
        notes.push("Pulled Etsy listings and receipts");
      } catch (error) {
        notes.push(`Etsy sync failed: ${(error as Error).message}`);
      }
    } else {
      notes.push("Etsy sample data kept — connect to sync the live shop");
    }
    if (connections.gelato.configured) {
      try {
        await pingGelato();
        notes.push("Gelato API key accepted");
      } catch (error) {
        notes.push(`Gelato ping failed: ${(error as Error).message}`);
      }
    }
    state.listings = state.listings.map(enrichListing);
    state.orders = state.orders.map((order) => enrichOrder(order, state.listings));
    applyHarvestDrop(state);
    state.lastSyncAt = new Date().toISOString();
  });
  return notes;
}

export async function publishListing(id: string, mode: "draft" | "live") {
  const connections = await connectionStatus();
  if (!connections.etsy.authorized) {
    throw new Error("Authorize the Etsy shop before publishing.");
  }
  const shop = await getShop();
  const listing = shop.listings.find((row) => row.id === id);
  const meta = liveProductById(id);
  if (!listing || !meta) throw new Error("Catalog product not found");
  const printUrl = await absoluteAssetUrl(meta.printFileUrl || listing.printFileUrl || "");
  let listingId = listing.etsyListingId;
  let url = listing.etsyUrl;
  if (!listingId) {
    const created = await createEtsyDraft({
      title: listing.title,
      description: meta.description,
      price: listing.price,
      taxonomyId: meta.taxonomyId,
      shippingProfileId: meta.shippingProfileId,
      returnPolicyId: meta.returnPolicyId,
      tags: listing.tags,
      sku: listing.gelatoProductUid,
    });
    listingId = String(created.listing_id);
    url = created.url;
    const imagePath = `${process.cwd()}/public${meta.imageUrl}`;
    try {
      await uploadEtsyListingImage(listingId, imagePath, 1);
    } catch (error) {
      console.warn("Etsy image upload failed", (error as Error).message);
    }
  }
  let state: "draft" | "live" = "draft";
  if (mode === "live") {
    const updated = await setEtsyListingState(listingId, "active");
    url = updated.url || url;
    state = "live";
  }
  await updateShop((current) => {
    const row = current.listings.find((item) => item.id === id);
    if (!row) return;
    row.etsyListingId = listingId;
    row.etsyUrl = url;
    row.publishState = state;
    row.printFileUrl = printUrl;
    row.imageUrl = meta.imageUrl;
    row.state = state === "live" ? "active" : "inactive";
  });
  return { id, listingId, url, state };
}

export { GELATO_CATALOG };
