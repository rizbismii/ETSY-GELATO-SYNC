import { fernoraCatalog, FERNORA_NAME, FERNORA_SHIP_BLURB } from "@/lib/shop";
import { gelatoCodesForLane, SHIP_LANES } from "@/lib/gelato-countries";
import {
  onlineStorePublicationId,
  publishableToOnlineStore,
  shopifyGraphql,
} from "@/lib/shopify";
import { brandHorizonStorefront } from "@/lib/shopify-horizon";

const HORIZON_THEME = "gid://shopify/OnlineStoreTheme/189823058216";
const FRONTPAGE = "gid://shopify/Collection/515726311720";

const MARKET_LANES: Array<{
  name: string;
  handle: string;
  aliases: string[];
  lane: (typeof SHIP_LANES)[number];
  currency: string;
}> = [
  { name: "New Zealand", handle: "nz", aliases: ["new zealand", "new-zealand"], lane: "NZ", currency: "NZD" },
  { name: "Australia", handle: "australia", aliases: ["australia"], lane: "AU", currency: "AUD" },
  { name: "United States & Americas", handle: "americas", aliases: ["united states", "americas"], lane: "US", currency: "USD" },
  { name: "United Kingdom & Ireland", handle: "united-kingdom", aliases: ["united kingdom", "uk"], lane: "GB", currency: "GBP" },
  { name: "Europe", handle: "europe", aliases: ["europe", "european union"], lane: "EU", currency: "EUR" },
];

export async function publishFernoraToOnlineStore() {
  const notes: string[] = [];
  const publicationId = await onlineStorePublicationId();
  const data = await shopifyGraphql<{ products: { nodes: Array<{ id: string; title: string }> } }>(
    `{ products(first: 50, query: "vendor:${FERNORA_NAME}") { nodes { id title } } }`,
  );
  let published = 0;
  for (const product of data.products.nodes) {
    try {
      await publishableToOnlineStore(product.id, publicationId);
      published += 1;
    } catch (error) {
      notes.push(`${product.title}: ${(error as Error).message}`);
    }
  }
  notes.unshift(`Published ${published} Fernora products to the Online Store sales channel.`);
  return notes;
}

export async function configureShopifyMarkets() {
  const notes: string[] = [];
  const existing = await shopifyGraphql<{
    markets: { nodes: Array<{ id: string; name: string; handle?: string }> };
  }>(`{ markets(first: 25) { nodes { id name handle } } }`);
  const byName = new Map(existing.markets.nodes.map((row) => [row.name.toLowerCase(), row]));
  const byHandle = new Map(
    existing.markets.nodes.filter((row) => row.handle).map((row) => [row.handle!.toLowerCase(), row]),
  );
  const resolved: Array<{ id: string; lane: (typeof MARKET_LANES)[number] }> = [];
  for (const market of MARKET_LANES) {
    const already =
      byName.get(market.name.toLowerCase()) ||
      byHandle.get(market.handle) ||
      market.aliases.map((alias) => byName.get(alias) || byHandle.get(alias)).find(Boolean);
    if (already) {
      notes.push(`Market already exists: ${market.name}`);
      resolved.push({ id: already.id, lane: market });
      continue;
    }
    const created = await shopifyGraphql<{
      marketCreate: { userErrors: Array<{ message: string }>; market?: { id: string; name: string } };
    }>(
      `mutation ($input: MarketCreateInput!) {
        marketCreate(input: $input) {
          market { id name status }
          userErrors { field message code }
        }
      }`,
      {
        input: {
          name: market.name,
          handle: market.handle,
          status: "ACTIVE",
          conditions: {
            regionsCondition: {
              regions: gelatoCodesForLane(market.lane).map((code) => ({ countryCode: code })),
            },
          },
        },
      },
    );
    if (created.marketCreate.userErrors.length) {
      notes.push(`${market.name}: ${created.marketCreate.userErrors.map((row) => row.message).join("; ")}`);
    } else if (created.marketCreate.market?.id) {
      notes.push(`Created market ${created.marketCreate.market.name || market.name}.`);
      resolved.push({ id: created.marketCreate.market.id, lane: market });
    }
  }
  notes.push(...(await configureMarketCurrencies(resolved)));
  return notes;
}

async function configureMarketCurrencies(markets: Array<{ id: string; lane: (typeof MARKET_LANES)[number] }>) {
  const notes: string[] = [];
  for (const row of markets) {
    const updated = await shopifyGraphql<{
      marketUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation ($id: ID!, $input: MarketUpdateInput!) {
        marketUpdate(id: $id, input: $input) { userErrors { field message } }
      }`,
      {
        id: row.id,
        input: {
          currencySettings: {
            baseCurrency: row.lane.currency,
            localCurrencies: true,
            roundingEnabled: true,
          },
        },
      },
    );
    if (updated.marketUpdate.userErrors.length) {
      notes.push(
        `${row.lane.name} currency: ${updated.marketUpdate.userErrors.map((err) => err.message).join("; ")}`,
      );
    } else {
      notes.push(`${row.lane.name} prices display in ${row.lane.currency} (and local currencies in that market).`);
    }
  }
  return notes;
}

export async function fillShopifyCollections() {
  const notes: string[] = [];
  const products = await shopifyGraphql<{
    products: { nodes: Array<{ id: string; title: string; tags: string[]; productType: string }> };
  }>(
    `{ products(first: 50, query: "vendor:${FERNORA_NAME}") { nodes { id title tags productType } } }`,
  );
  const ids = products.products.nodes.map((row) => row.id);
  if (!ids.length) {
    notes.push("No Fernora products to add to collections.");
    return notes;
  }
  const catalog = fernoraCatalog();
  const groups: Record<string, string[]> = {
    original: [],
    quote: [],
    botanical: [],
    scenic: [],
    home: [],
  };
  for (const product of products.products.nodes) {
    const meta = catalog.find((row) => product.title.includes(row.title.split("·")[0].trim()) || row.title === product.title);
    const mix = meta?.collection || "original";
    groups[mix]?.push(product.id);
  }
  try {
    const added = await shopifyGraphql<{
      collectionAddProducts: { userErrors: Array<{ message: string }> };
    }>(
      `mutation ($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }`,
      { id: FRONTPAGE, productIds: ids },
    );
    if (added.collectionAddProducts.userErrors.length) {
      notes.push("Homepage: " + added.collectionAddProducts.userErrors.map((row) => row.message).join("; "));
    } else {
      notes.push(`Added ${ids.length} products to the homepage collection.`);
    }
  } catch (error) {
    notes.push(`Homepage collection: ${(error as Error).message}`);
  }

  const publicationId = await onlineStorePublicationId();
  const mixTitles: Array<{ handle: string; title: string; ids: string[] }> = [
    { handle: "quotes", title: "Quotes", ids: groups.quote },
    { handle: "botanical", title: "Botanical", ids: groups.botanical },
    { handle: "scenic", title: "Scenic", ids: groups.scenic },
    { handle: "home-decor", title: "Home décor", ids: groups.home },
    { handle: "original-fern", title: "Original fern", ids: groups.original },
  ];
  const listed = await shopifyGraphql<{
    collections: { nodes: Array<{ id: string; handle: string }> };
  }>(`{ collections(first: 30) { nodes { id handle } } }`);
  const existing = new Map(listed.collections.nodes.map((row) => [row.handle, row.id]));
  for (const mix of mixTitles) {
    if (!mix.ids.length) continue;
    let id = existing.get(mix.handle);
    if (!id) {
      const created = await shopifyGraphql<{
        collectionCreate: {
          collection?: { id: string };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation ($input: CollectionInput!) {
          collectionCreate(input: $input) {
            collection { id handle }
            userErrors { field message }
          }
        }`,
        { input: { title: mix.title, handle: mix.handle, products: mix.ids } },
      );
      if (created.collectionCreate.userErrors.length) {
        notes.push(`${mix.title}: ${created.collectionCreate.userErrors.map((row) => row.message).join("; ")}`);
        continue;
      }
      id = created.collectionCreate.collection?.id;
      notes.push(`Created collection ${mix.title}.`);
    } else {
      await shopifyGraphql(
        `mutation ($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } }
        }`,
        { id, productIds: mix.ids },
      );
    }
    if (id) {
      try {
        await publishableToOnlineStore(id, publicationId);
      } catch (error) {
        notes.push(`${mix.title} channel: ${(error as Error).message}`);
      }
    }
  }
  return notes;
}

export async function brandHorizonTheme(origin?: string) {
  const notes = await brandHorizonStorefront(await mainThemeId(), origin);
  return notes;
}

async function mainThemeId() {
  const data = await shopifyGraphql<{ themes: { nodes: Array<{ id: string; role: string }> } }>(
    `{ themes(first: 10) { nodes { id role } } }`,
  );
  return data.themes.nodes.find((row) => row.role === "MAIN")?.id || HORIZON_THEME;
}

export async function registerGelatoCarrierService(origin: string) {
  const notes: string[] = [];
  const callbackUrl = `${origin.replace(/\/$/, "")}/api/shopify/shipping-rates`;
  const existing = await shopifyGraphql<{
    carrierServices: { nodes: Array<{ id: string; name: string; callbackUrl?: string | null }> };
  }>(`{ carrierServices(first: 10) { nodes { id name active callbackUrl } } }`);
  const found = existing.carrierServices.nodes.find((row) => row.name === "Gelato");
  if (found) {
    const updated = await shopifyGraphql<{
      carrierServiceUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation ($input: DeliveryCarrierServiceUpdateInput!) {
        carrierServiceUpdate(input: $input) { userErrors { field message } }
      }`,
      { input: { id: found.id, name: "Gelato", callbackUrl, active: true, supportsServiceDiscovery: true } },
    );
    if (updated.carrierServiceUpdate.userErrors.length) {
      notes.push("Carrier: " + updated.carrierServiceUpdate.userErrors.map((row) => row.message).join("; "));
    } else {
      notes.push(`Gelato shipping callback updated: ${callbackUrl}`);
    }
    return notes;
  }
  const created = await shopifyGraphql<{
    carrierServiceCreate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($input: DeliveryCarrierServiceCreateInput!) {
      carrierServiceCreate(input: $input) { userErrors { field message } }
    }`,
    { input: { name: "Gelato", callbackUrl, active: true, supportsServiceDiscovery: true } },
  );
  if (created.carrierServiceCreate.userErrors.length) {
    notes.push("Carrier: " + created.carrierServiceCreate.userErrors.map((row) => row.message).join("; "));
  } else {
    notes.push(`Gelato carrier service registered. Checkout shipping uses destination print rates (${FERNORA_SHIP_BLURB})`);
  }
  return notes;
}

export async function prepareShopifyCustomerStore(origin: string) {
  const notes: string[] = [];
  notes.push(...(await publishFernoraToOnlineStore()));
  notes.push(...(await configureShopifyMarkets()));
  notes.push(...(await fillShopifyCollections()));
  notes.push(...(await brandHorizonTheme(origin)));
  notes.push(...(await registerGelatoCarrierService(origin)));
  return notes;
}
