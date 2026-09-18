import { GELATO_CATALOG, suggestTemplate, templateByUid } from "@/lib/catalog";
import { getCredentials } from "@/lib/credentials";
import { listingNet, orderProfit, recommendedPrice, destinationEconomics, OFFSITE_ADS_RATE, TARGET_AFTER_ADS_MARGIN } from "@/lib/money";
import { getShop, updateShop } from "@/lib/store";
import type { Address, Connections, Listing, OpsIssue, Order, Overview, ShopState } from "@/lib/types";
import { existsSync } from "node:fs";
import { createGelatoOrder, demoFulfill, pingGelato } from "@/lib/gelato";
import {
  createEtsyDraft,
  pullEtsyCatalog,
  pushEtsyTracking,
  setEtsyListingState,
  updateEtsyListingFields,
  updateEtsyListingInventory,
  updateEtsyListingPrice,
  uploadEtsyListingImage,
} from "@/lib/etsy";
import { PRINT_FILE, HARVEST_DROP_ID, HARVEST_DROP_NAME } from "@/lib/constants";
import { applyHarvestDrop } from "@/lib/drop";
import { ETSY_KNOWN_LISTINGS, etsyListingUrl, liveProductById, resolveLiveSku, READINESS_STATE_ID } from "@/lib/live-catalog";
import { absoluteAssetUrl } from "@/lib/origin";
import { etsyClothingInventory, isClothingCategory, resolveListingFulfillment } from "@/lib/clothing";
import {
  connectListingToGelatoStore,
  deleteGelatoStoreProduct,
  findStoreProductForListing,
  getGelatoEtsyStore,
  listGelatoStoreProducts,
  syncGelatoStore,
} from "@/lib/gelato-store";
import { rememberDeletedListing } from "@/lib/tombstones";
import { FERNORA_SHOPIFY_SHOP } from "@/lib/shopify-shop";
import { createShopifyDraftInvoice, deleteShopifyProduct } from "@/lib/shopify";
import { isGelatoCountry } from "@/lib/gelato-countries";
import { checkoutToOrder, quoteFernoraCart, type CartLine } from "@/lib/shop";

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
    shopify: {
      configured: Boolean(creds.shopify?.clientId && creds.shopify.clientSecret),
      authorized: Boolean(creds.shopify?.accessToken),
      mode: creds.shopify?.accessToken ? "live" : "demo",
      shop: creds.shopify?.shop,
      storefrontStatus: creds.shopify?.storefrontStatus,
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
    const resolved = listing
      ? resolveListingFulfillment(listing, item.variation, undefined)
      : undefined;
    return {
      ...item,
      gelatoProductUid: item.gelatoProductUid ?? resolved?.gelatoProductUid ?? listing?.gelatoProductUid,
      printFileUrl: item.printFileUrl ?? resolved?.printFileUrl ?? listing?.printFileUrl,
      variation: item.variation ?? resolved?.variation,
    };
  });
  const unmapped = items.some((item) => !item.gelatoProductUid || !item.printFileUrl);
  if (unmapped && (order.status === "paid" || order.status === "blocked")) {
    issues.push("Line item is not mapped to Gelato");
  }
  if (order.status === "pending") {
    issues.push("Awaiting payment before Gelato print");
  }
  if (order.status === "shipped" && order.trackingNumber && !order.trackingPushedToEtsy) {
    issues.push("Tracking is on Gelato but not on the Etsy receipt");
  }
  let status = order.status;
  if (status !== "pending") {
    if (unmapped && status === "paid") status = "blocked";
    if (!unmapped && status === "blocked") status = "paid";
  }
  return { ...order, items, issues, status };
}

export function gelatoShippingFor(order: Order) {
  if (order.channel === "fernora" || order.channel === "shopify") return order.shippingPaid;
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
    channel: order.channel || "etsy",
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
  if (!connections.shopify.authorized) {
    issues.push({
      id: "shopify-connect",
      severity: connections.shopify.storefrontStatus === "frozen" ? "warning" : "info",
      title:
        connections.shopify.storefrontStatus === "frozen"
          ? "Shopify store fernora is frozen"
          : "Shopify Fernora is not authorized",
      detail:
        connections.shopify.storefrontStatus === "frozen"
          ? `${connections.shopify.shop || FERNORA_SHOPIFY_SHOP} exists but Shopify has paused the storefront (unpaid plan). Unfreeze it, then authorize the app. The Fernora website at /shop still sells Gelato destinations (AU, NZ, and other print countries) and prints through Gelato.`
          : "Authorize the Fernora Shopify shop so Pressroom can push the catalog and pull paid checkouts.",
      action: { label: "Connect Shopify", href: "/connections", kind: "connect" },
    });
  }
  const pending = shop.orders.filter((o) => o.status === "pending");
  if (pending.length) {
    issues.push({
      id: "pending-pay",
      severity: "warning",
      title: `${pending.length} Fernora order${pending.length === 1 ? "" : "s"} awaiting payment`,
      detail:
        "These rows are unpaid website checkouts. Cancel test / unpaid ones. Only Mark paid & print if money actually arrived — that submits a real Gelato print.",
      action: { label: "Review orders", href: "/orders", kind: "fulfill" },
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
  if (connections.etsy.authorized) score += 12;
  else score += 6;
  if (connections.gelato.configured) score += 15;
  else score += 8;
  if (connections.shopify.authorized) score += 8;
  else score += 4;
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
      const product = liveProductById(listing.id);
      const worst = (product?.lanes ?? []).reduce(
        (acc, lane) => {
          const advertised = destinationEconomics(
            listing.price,
            lane.printCost,
            lane.shipping,
            OFFSITE_ADS_RATE,
          );
          if (!acc || advertised.margin < acc.margin) {
            return { margin: advertised.margin, print: lane.printCost, shipping: lane.shipping };
          }
          return acc;
        },
        null as { margin: number; print: number; shipping: number } | null,
      );
      const shipping = worst?.shipping ?? templateByUid(listing.gelatoProductUid)?.shippingCost ?? 4.2;
      const printCost = worst?.print ?? listing.gelatoUnitCost;
      const advertised = destinationEconomics(listing.price, printCost, shipping, OFFSITE_ADS_RATE);
      if (advertised.margin + 1e-9 >= TARGET_AFTER_ADS_MARGIN) continue;
      const next = recommendedPrice(printCost, shipping, TARGET_AFTER_ADS_MARGIN, OFFSITE_ADS_RATE);
      if (next <= listing.price) continue;
      changed.push({ id: listing.id, from: listing.price, to: next });
      listing.price = next;
    }
    state.listings = state.listings.map(enrichListing);
  });
  return changed;
}

export async function pushLivePricesToEtsy() {
  const connections = await connectionStatus();
  if (!connections.etsy.authorized) {
    return { updated: 0, errors: ["Etsy is not authorized"] as string[] };
  }
  const shop = await getShop();
  const updated: string[] = [];
  const errors: string[] = [];
  for (const listing of shop.listings) {
    const product = liveProductById(listing.id);
    const listingId = listing.etsyListingId || ETSY_KNOWN_LISTINGS[listing.id]?.id;
    if (!product || !listingId) continue;
    try {
      await updateEtsyListingPrice(listingId, product.price);
      updated.push(listing.title);
    } catch (error) {
      errors.push(`${listing.title}: ${(error as Error).message}`);
    }
  }
  return { updated: updated.length, titles: updated, errors };
}

export async function fulfillOrder(id: string) {
  const connections = await connectionStatus();
  let result: { gelatoOrderId: string; live: boolean };
  const shop = await updateShop(async (state) => {
    const order = state.orders.find((row) => row.id === id);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Order is cancelled");
    if (order.status === "pending") throw new Error("Collect payment before sending this order to Gelato");
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
      notes.push("Etsy is not authorized — live catalog stays local until you connect");
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
  try {
    const prices = await pushLivePricesToEtsy();
    if (prices.updated) notes.push(`Pushed ${prices.updated} catalog prices to Etsy (40% after ads)`);
    if (prices.errors.length) notes.push(...prices.errors.slice(0, 3));
  } catch (error) {
    notes.push(`Etsy price push failed: ${(error as Error).message}`);
  }
  if (connections.gelato.configured) {
    try {
      const gelato = await connectGelatoDesigns();
      notes.push(`Gelato templates attached on ${gelato.connected} variants across ${gelato.products} products`);
      if (gelato.notes.length) notes.push(...gelato.notes.slice(0, 5));
    } catch (error) {
      notes.push(`Gelato templates: ${(error as Error).message}`);
    }
  }
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
  const printPath = meta.printFileUrl || listing.printFileUrl || "";
  const printUrl = await absoluteAssetUrl(printPath);
  let listingId = listing.etsyListingId;
  let url = listing.etsyUrl;
  if (!listingId) {
    const known = ETSY_KNOWN_LISTINGS;
    if (known[id]) {
      listingId = known[id].id;
      url = known[id].url;
    }
  }
  if (!listingId) {
    const created = await createEtsyDraft({
      title: listing.title,
      description: meta.description,
      price: listing.price,
      taxonomyId: meta.taxonomyId,
      shippingProfileId: meta.shippingProfileId,
      returnPolicyId: meta.returnPolicyId,
      readinessStateId: READINESS_STATE_ID,
      tags: listing.tags,
      sku: listing.gelatoProductUid,
    });
    listingId = String(created.listing_id);
    url = etsyListingUrl(listingId) || created.url;
  }

  const imagePath = `${process.cwd()}/public${meta.imageUrl}`;
  if (!existsSync(imagePath)) {
    throw new Error(`Catalog image missing for ${listing.title}`);
  }
  try {
    await uploadEtsyListingImage(listingId, imagePath, 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exists|limit/i.test(message)) throw error;
  }

  await updateShop((current) => {
    const row = current.listings.find((item) => item.id === id);
    if (!row) return;
    row.etsyListingId = listingId;
    row.etsyUrl = url;
    row.publishState = "draft";
    row.printFileUrl = printPath || printUrl;
    row.imageUrl = meta.imageUrl;
  });

  let state: "draft" | "live" = "draft";
  if (mode === "live") {
    try {
      const updated = await setEtsyListingState(listingId, "active");
      url = etsyListingUrl(listingId) || updated.url || url;
      state = "live";
    } catch (error) {
      await updateShop((current) => {
        const row = current.listings.find((item) => item.id === id);
        if (!row) return;
        row.etsyListingId = listingId;
        row.etsyUrl = url;
        row.publishState = "draft";
      });
      throw error;
    }
  }
  await updateShop((current) => {
    const row = current.listings.find((item) => item.id === id);
    if (!row) return;
    row.etsyListingId = listingId;
    row.etsyUrl = url;
    row.publishState = state;
    row.printFileUrl = printPath || printUrl;
    row.imageUrl = meta.imageUrl;
    row.state = state === "live" ? "active" : "inactive";
  });
  if (isClothingCategory(meta.category) && (meta.variants?.length || listing.variants?.length)) {
    await updateEtsyListingInventory(listingId, etsyClothingInventory(meta));
  }
  try {
    await attachGelatoTemplatesForListing({
      ...listing,
      ...meta,
      id: listing.id,
      etsyListingId: listingId,
      printFileUrl: printPath || listing.printFileUrl || meta.printFileUrl,
    });
  } catch {
    /* Etsy publish still stands; Gelato templates attach on Connect or the next sync */
  }
  return { id, listingId, url, state };
}

function listingEtsyId(listing: Listing) {
  return listing.etsyListingId || ETSY_KNOWN_LISTINGS[listing.id]?.id;
}

async function attachGelatoTemplatesForListing(listing: Listing) {
  const store = await getGelatoEtsyStore();
  try {
    await syncGelatoStore(store.id);
  } catch {
    /* use whatever is already in the store */
  }
  let products = await listGelatoStoreProducts(store.id);
  let storeProduct = findStoreProductForListing(products, listing);
  for (let attempt = 0; attempt < 4 && !storeProduct; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await syncGelatoStore(store.id);
    } catch {
      /* keep polling */
    }
    products = await listGelatoStoreProducts(store.id);
    storeProduct = findStoreProductForListing(products, listing);
  }
  if (!storeProduct) {
    throw new Error(`${listing.title}: not in the Gelato Etsy store yet`);
  }
  const result = await connectListingToGelatoStore(store.id, listing, storeProduct);
  await updateShop((state) => {
    const row = state.listings.find((item) => item.id === listing.id);
    if (!row) return;
    row.gelatoStoreProductId = result.storeProductId;
    row.gelatoConnectedCount = result.connected;
    row.gelatoVariantCount = result.total;
  });
  return result;
}

export async function pushClothingVariantsToEtsy(id?: string) {
  const shop = await getShop();
  const targets = shop.listings.filter(
    (row) => isClothingCategory(row.category) && (!id || row.id === id),
  );
  const notes: string[] = [];
  const updated: string[] = [];
  for (const listing of targets) {
    const meta = liveProductById(listing.id);
    const listingId = listingEtsyId(listing);
    if (!meta || !listingId) {
      notes.push(`${listing.title}: not on Etsy yet`);
      continue;
    }
    try {
      await updateEtsyListingFields(listingId, {
        title: meta.title.slice(0, 140),
        description: meta.description.slice(0, 5000),
        price: meta.price.toFixed(2),
      });
      await updateEtsyListingInventory(listingId, etsyClothingInventory(meta));
      updated.push(listing.title);
    } catch (error) {
      notes.push(`${listing.title}: ${(error as Error).message}`);
    }
  }
  return { updated, notes };
}

export async function connectGelatoDesigns() {
  const connections = await connectionStatus();
  if (!connections.gelato.configured) throw new Error("Gelato is not connected");
  const clothing = await pushClothingVariantsToEtsy();
  const store = await getGelatoEtsyStore();
  const notes = [...clothing.notes];
  try {
    await syncGelatoStore(store.id);
  } catch (error) {
    notes.push(`Gelato store sync: ${(error as Error).message}`);
  }
  const shop = await getShop();
  let products = await listGelatoStoreProducts(store.id);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const waiting = shop.listings.filter((listing) => {
      if (!isClothingCategory(listing.category)) return false;
      const wanted = listing.variants?.length || liveProductById(listing.id)?.variants?.length || 9;
      const found = findStoreProductForListing(products, listing);
      return (found?.variants?.length || 0) < wanted;
    });
    if (!waiting.length) break;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    try {
      await syncGelatoStore(store.id);
    } catch {
      /* keep polling */
    }
    products = await listGelatoStoreProducts(store.id);
  }
  const results: Array<{ id: string; title: string; connected: number; total: number }> = [];
  for (const listing of shop.listings) {
    const meta = liveProductById(listing.id);
    const merged: Listing = {
      ...listing,
      ...(meta || {}),
      id: listing.id,
      etsyListingId: listing.etsyListingId || ETSY_KNOWN_LISTINGS[listing.id]?.id || listing.etsyListingId,
      variants: meta?.variants || listing.variants,
      printFileUrl: meta?.printFileUrl || listing.printFileUrl,
      gelatoProductUid: meta?.gelatoProductUid || listing.gelatoProductUid,
    };
    const storeProduct = findStoreProductForListing(products, merged);
    if (!storeProduct) {
      notes.push(`${listing.title}: not in the Gelato Etsy store yet`);
      continue;
    }
    try {
      const result = await connectListingToGelatoStore(store.id, merged, storeProduct);
      notes.push(...result.notes);
      results.push({
        id: listing.id,
        title: listing.title,
        connected: result.connected,
        total: result.total,
      });
      await updateShop((state) => {
        const row = state.listings.find((item) => item.id === listing.id);
        if (!row) return;
        row.gelatoStoreProductId = result.storeProductId;
        row.gelatoConnectedCount = result.connected;
        row.gelatoVariantCount = result.total;
      });
    } catch (error) {
      notes.push(`${listing.title}: ${(error as Error).message}`);
    }
  }
  return {
    storeId: store.id,
    clothingUpdated: clothing.updated,
    connected: results.reduce((sum, row) => sum + row.connected, 0),
    products: results.length,
    results,
    notes,
  };
}

export async function deleteCatalogProduct(id: string) {
  const shop = await getShop();
  const listing = shop.listings.find((row) => row.id === id);
  if (!listing) throw new Error("Catalog product not found");
  const notes: string[] = [];
  const etsyId = listingEtsyId(listing);

  try {
    const store = await getGelatoEtsyStore();
    const products = await listGelatoStoreProducts(store.id);
    const storeProduct =
      findStoreProductForListing(products, listing) ||
      products.find((row) => row.id === listing.gelatoStoreProductId);
    if (storeProduct) {
      await deleteGelatoStoreProduct(store.id, storeProduct.id);
      notes.push("Removed from Gelato");
    } else {
      notes.push("Not found in Gelato store");
    }
  } catch (error) {
    notes.push(`Gelato: ${(error as Error).message}`);
  }

  if (etsyId) {
    try {
      await setEtsyListingState(etsyId, "inactive");
      notes.push("Etsy listing set to inactive");
    } catch (error) {
      notes.push(`Etsy: ${(error as Error).message}`);
    }
  } else {
    notes.push("No Etsy listing to inactivate");
  }

  try {
    const shopify = await deleteShopifyProduct(id);
    notes.push(shopify.deleted ? "Deleted from Shopify" : shopify.note || "Shopify unchanged");
  } catch (error) {
    notes.push(`Shopify: ${(error as Error).message}`);
  }

  rememberDeletedListing(id);
  await updateShop((state) => {
    state.deletedListingIds = [...new Set([...(state.deletedListingIds || []), id])];
    state.listings = state.listings.filter((row) => row.id !== id);
    if (state.shopifyCatalog) delete state.shopifyCatalog[id];
  });

  return { id, title: listing.title, notes };
}

export async function placeFernoraOrder(input: {
  lines: CartLine[];
  country: string;
  address: Address;
}) {
  if (!isGelatoCountry(input.country)) {
    throw new Error("Fernora only ships to countries Gelato delivers to");
  }
  const country = input.country;
  const quote = quoteFernoraCart(input.lines, country);
  const draft = checkoutToOrder({ quote, address: input.address });
  const id = `ord_frn_${Date.now().toString(36)}`;
  const connections = await connectionStatus();
  let invoiceUrl: string | undefined;
  let shopifyDraftOrderId: string | undefined;
  if (connections.shopify.authorized) {
    try {
      const invoice = await createShopifyDraftInvoice({
        email: input.address.email || "",
        note: "Fernora · Gelato print-on-demand",
        country,
        lines: quote.items.map((item) => ({
          listingId: item.product.id,
          sku: item.variantId || item.product.id,
          quantity: item.quantity,
          title: item.variantLabel ? `${item.product.title} · ${item.variantLabel}` : item.product.title,
          price: item.unitPrice,
        })),
        address: {
          firstName: input.address.firstName,
          lastName: input.address.lastName,
          address1: input.address.addressLine1,
          address2: input.address.addressLine2,
          city: input.address.city,
          province: input.address.state,
          zip: input.address.postCode,
          country: input.address.country,
          phone: input.address.phone,
        },
      });
      invoiceUrl = invoice.invoiceUrl || undefined;
      shopifyDraftOrderId = invoice.id;
      draft.channel = "shopify";
      draft.shopifyDraftOrderId = invoice.id;
      draft.invoiceUrl = invoiceUrl;
      draft.etsyReceiptId = invoice.name || draft.etsyReceiptId;
    } catch {
      /* Shopify store may be frozen; keep the local pending order */
    }
  }
  const order: Order = { ...draft, id, invoiceUrl, shopifyDraftOrderId };
  await updateShop((state) => {
    state.orders.unshift(order);
  });
  return { order, quote, invoiceUrl };
}

export async function markOrderPaid(id: string, fulfill = true) {
  await updateShop((state) => {
    const order = state.orders.find((row) => row.id === id);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Order is cancelled");
    if (order.status === "pending" || order.status === "blocked") {
      order.status = "paid";
      order.paidAt = new Date().toISOString();
      order.issues = [];
    }
  });
  let gelatoOrderId: string | undefined;
  let live = false;
  if (fulfill) {
    try {
      const result = await fulfillOrder(id);
      gelatoOrderId = result.gelatoOrderId;
      live = result.live;
    } catch {
      /* stay paid if Gelato rejects; desk can retry */
    }
  }
  const shop = await getShop();
  return { shop, order: shop.orders.find((row) => row.id === id), gelatoOrderId, live };
}

export async function cancelOrder(id: string) {
  await updateShop((state) => {
    const order = state.orders.find((row) => row.id === id);
    if (!order) throw new Error("Order not found");
    if (order.status === "in_production" || order.status === "shipped" || order.status === "delivered") {
      throw new Error("This order is already with Gelato");
    }
    order.status = "cancelled";
    order.issues = ["Cancelled — not sent to Gelato"];
  });
  const shop = await getShop();
  return { shop, order: shop.orders.find((row) => row.id === id) };
}

export async function ingestShopifyPaidOrder(payload: {
  id?: number | string;
  name?: string;
  email?: string;
  created_at?: string;
  shipping_address?: Record<string, string>;
  billing_address?: Record<string, string>;
  line_items?: Array<{ sku?: string; title?: string; quantity?: number; price?: string }>;
  total_price?: string;
  shipping_lines?: Array<{ price?: string }>;
  currency?: string;
}) {
  const shopifyOrderId = String(payload.id || "");
  const shop = await getShop();
  const existing = shop.orders.find(
    (row) => row.shopifyOrderId === shopifyOrderId || row.shopifyDraftOrderId?.includes(shopifyOrderId),
  );
  if (existing) {
    if (existing.status === "pending") return markOrderPaid(existing.id, true);
    return { order: existing, duplicate: true };
  }
  const addressSource = payload.shipping_address || payload.billing_address || {};
  const country = String(addressSource.country_code || addressSource.country || "").toUpperCase();
  if (country && !isGelatoCountry(country)) {
    throw new Error("Fernora Shopify orders only ship to countries Gelato delivers to");
  }
  const lines = (payload.line_items || [])
    .map((item, index) => {
      const resolved = resolveLiveSku(item.sku, item.title);
      const listingId = resolved?.listingId || item.sku || "";
      const listing = shop.listings.find((row) => row.id === listingId) || liveProductById(listingId);
      return {
        id: `shp_${shopifyOrderId}_${index}`,
        listingId: listingId || `unknown_${index}`,
        title: item.title || listing?.title || "Item",
        quantity: item.quantity || 1,
        price: Number(item.price || listing?.price || 0),
        variation: resolved?.variation,
        gelatoProductUid: resolved?.gelatoProductUid || listing?.gelatoProductUid,
        printFileUrl: resolved?.printFileUrl || listing?.printFileUrl,
      };
    })
    .filter((item) => item.quantity > 0);
  const id = `ord_shp_${shopifyOrderId || Date.now().toString(36)}`;
  const order: Order = {
    id,
    etsyReceiptId: payload.name || `SHP-${shopifyOrderId}`,
    buyerName: `${addressSource.first_name || ""} ${addressSource.last_name || ""}`.trim() || "Shopify customer",
    createdAt: payload.created_at || new Date().toISOString(),
    paidAt: new Date().toISOString(),
    status: "paid",
    channel: "shopify",
    subtotal: lines.reduce((sum, item) => sum + item.price * item.quantity, 0),
    shippingPaid: Number(payload.shipping_lines?.[0]?.price || 0),
    currency: payload.currency || "NZD",
    items: lines,
    shippingAddress: {
      firstName: addressSource.first_name || "Customer",
      lastName: addressSource.last_name || "",
      addressLine1: addressSource.address1 || "",
      addressLine2: addressSource.address2,
      city: addressSource.city || "",
      state: addressSource.province,
      postCode: addressSource.zip || "",
      country: country === "AUS" ? "AU" : country === "NZL" ? "NZ" : country || "NZ",
      email: payload.email,
      phone: addressSource.phone,
    },
    shopifyOrderId,
    trackingPushedToEtsy: true,
    issues: [],
  };
  await updateShop((state) => {
    state.orders.unshift(order);
  });
  return markOrderPaid(id, true);
}

export { GELATO_CATALOG };
