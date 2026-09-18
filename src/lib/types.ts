export type ConnectionMode = "demo" | "live";

export type EtsyConnection = {
  configured: boolean;
  authorized: boolean;
  mode: ConnectionMode;
  shopName?: string;
  shopId?: string;
  userId?: string;
  error?: string;
};

export type GelatoConnection = {
  configured: boolean;
  mode: ConnectionMode;
  error?: string;
};

export type ShopifyConnection = {
  configured: boolean;
  authorized: boolean;
  mode: ConnectionMode;
  shop?: string;
  storefrontStatus?: "live" | "frozen" | "missing" | "unknown";
  error?: string;
};

export type MetaConnection = {
  configured: boolean;
  authorized: boolean;
  mode: ConnectionMode;
  adAccountId?: string;
  pixelId?: string;
  error?: string;
};

export type Connections = {
  etsy: EtsyConnection;
  gelato: GelatoConnection;
  shopify: ShopifyConnection;
  meta: MetaConnection;
};

export type ListingState = "active" | "inactive" | "expired" | "sold_out";

export type ClothingVariant = {
  id: string;
  color: string;
  colorUid: string;
  size: string;
  sizeUid: string;
  sku: string;
  gelatoProductUid: string;
};

export type Listing = {
  id: string;
  etsyListingId: string;
  title: string;
  state: ListingState;
  price: number;
  currency: string;
  quantity: number;
  views: number;
  favorites: number;
  tags: string[];
  category: string;
  gelatoProductUid?: string;
  gelatoProductName?: string;
  printFileUrl?: string;
  imageUrl?: string;
  gelatoUnitCost: number;
  drop?: string;
  issues: string[];
  description?: string;
  taxonomyId?: number;
  shippingProfileId?: number;
  returnPolicyId?: number;
  publishState?: "ready" | "draft" | "live";
  etsyUrl?: string;
  collection?: "original" | "quote" | "botanical" | "scenic" | "home";
  quote?: string;
  variants?: ClothingVariant[];
  gelatoStoreProductId?: string;
  gelatoConnectedCount?: number;
  gelatoVariantCount?: number;
};

export type Address = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  country: string;
  email?: string;
  phone?: string;
};

export type OrderChannel = "etsy" | "shopify" | "fernora";

export type OrderStatus =
  | "pending"
  | "paid"
  | "blocked"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  id: string;
  listingId: string;
  title: string;
  quantity: number;
  price: number;
  variation?: string;
  gelatoProductUid?: string;
  printFileUrl?: string;
};

export type Order = {
  id: string;
  etsyReceiptId: string;
  buyerName: string;
  createdAt: string;
  paidAt?: string;
  status: OrderStatus;
  channel?: OrderChannel;
  subtotal: number;
  shippingPaid: number;
  currency: string;
  items: OrderItem[];
  shippingAddress: Address;
  gelatoOrderId?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingPushedToEtsy: boolean;
  gelatoStatus?: string;
  shopifyOrderId?: string;
  shopifyDraftOrderId?: string;
  invoiceUrl?: string;
  issues: string[];
};

export type ProductTemplate = {
  uid: string;
  name: string;
  category: string;
  unitCost: number;
  shippingCost: number;
  keywords: string[];
};

export type DailyRevenue = {
  date: string;
  gross: number;
  fees: number;
  cogs: number;
  net: number;
  orders: number;
};

export type ShopifyCatalogEntry = {
  productId: string;
  variantId: string;
  handle?: string;
  /** Shopify variant GID keyed by Fernora SKU (`live_hoodie-black-m`). */
  variants?: Record<string, string>;
};

export type ShopifyCatalogMap = Record<string, ShopifyCatalogEntry>;

export type MetaAdsCampaign = {
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  creativeId?: string;
  dailyBudget: number;
  currency?: string;
  landingUrl: string;
  status: "draft" | "paused" | "active";
  pixelInstalled?: boolean;
  lastError?: string;
  updatedAt?: string;
};

export type ShopState = {
  shopName: string;
  currency: string;
  listings: Listing[];
  orders: Order[];
  lastSyncAt?: string;
  shopifyCatalog?: ShopifyCatalogMap;
  shopifySyncedAt?: string;
  deletedListingIds?: string[];
  metaAds?: MetaAdsCampaign;
};

export type OpsIssue = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  action?: {
    label: string;
    href?: string;
    kind:
      | "connect"
      | "map_listings"
      | "fulfill"
      | "push_tracking"
      | "price"
      | "repair";
  };
};

export type Overview = {
  connections: Connections;
  shopName: string;
  currency: string;
  kpis: {
    gross30d: number;
    net30d: number;
    fees30d: number;
    cogs30d: number;
    orders30d: number;
    awaitingFulfillment: number;
    inProduction: number;
    unmappedListings: number;
    opsScore: number;
  };
  issues: OpsIssue[];
  revenue: DailyRevenue[];
  recentOrders: Order[];
  topListings: Array<Listing & { units30d: number; net30d: number }>;
  drop: {
    id: string;
    name: string;
    gross30d: number;
    net30d: number;
    units30d: number;
    listings: Array<Listing & { units30d: number; net30d: number }>;
  };
};
