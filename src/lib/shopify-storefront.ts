import { CATALOG_SERIES } from "@/lib/catalog-menu";
import { fernoraCatalog, FERNORA_NAME } from "@/lib/shop";
import { gelatoCodesForLane, SHIP_LANES } from "@/lib/gelato-countries";
import { retailPriceInCurrency, SHOP_CURRENCY } from "@/lib/shop-currency";
import {
  onlineStorePublicationId,
  publishableToOnlineStore,
  shopifyGraphql,
} from "@/lib/shopify";
import { brandHorizonStorefront } from "@/lib/shopify-horizon";

const HORIZON_THEME = "gid://shopify/OnlineStoreTheme/189823058216";
const FRONTPAGE = "gid://shopify/Collection/515726311720";

/** Local currencies Shopify cannot present on this NZ shop — they fall back to shop NZD unless pinned to USD. */
export const USD_FALLBACK_COUNTRIES = ["AR", "BR", "MX", "CL", "CO", "ZA", "NO"] as const;

type MarketSpec = {
  name: string;
  handle: string;
  aliases: string[];
  currency: string;
  localCurrencies: boolean;
  countries: string[];
};

type MarketNode = {
  id: string;
  name: string;
  handle?: string | null;
  conditions?: {
    regionsCondition?: {
      regions?: { nodes: Array<{ id: string; code?: string | null }> };
    };
  } | null;
};

function laneCountries(lane: (typeof SHIP_LANES)[number]) {
  return gelatoCodesForLane(lane).filter((code) => !(USD_FALLBACK_COUNTRIES as readonly string[]).includes(code));
}

const MARKET_LANES: MarketSpec[] = [
  { name: "New Zealand", handle: "nz", aliases: ["new zealand", "new-zealand"], currency: "NZD", localCurrencies: true, countries: laneCountries("NZ") },
  { name: "Australia", handle: "australia", aliases: ["australia"], currency: "AUD", localCurrencies: true, countries: laneCountries("AU") },
  { name: "United States & Americas", handle: "americas", aliases: ["united states", "americas"], currency: "USD", localCurrencies: true, countries: laneCountries("US") },
  { name: "United Kingdom & Ireland", handle: "united-kingdom", aliases: ["united kingdom", "uk"], currency: "GBP", localCurrencies: true, countries: laneCountries("GB") },
  { name: "Europe", handle: "europe", aliases: ["europe", "european union"], currency: "EUR", localCurrencies: true, countries: laneCountries("EU") },
  {
    name: "International (USD)",
    handle: "international-usd",
    aliases: ["international usd", "international"],
    currency: "USD",
    localCurrencies: false,
    countries: [...USD_FALLBACK_COUNTRIES],
  },
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

const MARKETS_QUERY = `{
  markets(first: 25) {
    nodes {
      id name handle
      conditions {
        regionsCondition {
          regions(first: 100) {
            nodes { ... on MarketRegionCountry { id code } }
          }
        }
      }
    }
  }
}`;

async function listShopifyMarkets() {
  const data = await shopifyGraphql<{ markets: { nodes: MarketNode[] } }>(MARKETS_QUERY);
  return data.markets.nodes;
}

function matchMarket(existing: MarketNode[], spec: MarketSpec) {
  return (
    existing.find((row) => row.handle?.toLowerCase() === spec.handle) ||
    existing.find((row) => row.name.toLowerCase() === spec.name.toLowerCase()) ||
    existing.find((row) => spec.aliases.includes(row.name.toLowerCase()) || spec.aliases.includes(row.handle?.toLowerCase() || ""))
  );
}

async function updateMarket(id: string, input: Record<string, unknown>) {
  return shopifyGraphql<{ marketUpdate: { userErrors: Array<{ message: string }> } }>(
    `mutation ($id: ID!, $input: MarketUpdateInput!) {
      marketUpdate(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id, input },
  );
}

export async function configureShopifyMarkets() {
  const notes: string[] = [];
  let existing = await listShopifyMarkets();
  const fallback = new Set<string>(USD_FALLBACK_COUNTRIES);
  const international = MARKET_LANES.find((row) => row.handle === "international-usd");

  for (const market of existing) {
    if (market.handle === international?.handle || market.name.toLowerCase() === international?.name.toLowerCase()) {
      continue;
    }
    const regions = market.conditions?.regionsCondition?.regions?.nodes || [];
    const regionIds = regions.filter((row) => row.code && fallback.has(row.code)).map((row) => row.id);
    if (!regionIds.length) continue;
    const removed = await updateMarket(market.id, {
      conditions: { conditionsToDelete: { regionsCondition: { regionIds } } },
    });
    if (removed.marketUpdate.userErrors.length) {
      notes.push(`${market.name} region move: ${removed.marketUpdate.userErrors.map((row) => row.message).join("; ")}`);
    }
  }

  existing = await listShopifyMarkets();
  const resolved: Array<{ id: string; spec: MarketSpec }> = [];
  for (const spec of MARKET_LANES) {
    const already = matchMarket(existing, spec);
    if (already) {
      notes.push(`Market already exists: ${spec.name}`);
      const have = new Set(
        (already.conditions?.regionsCondition?.regions?.nodes || []).map((row) => row.code).filter(Boolean) as string[],
      );
      const missing = spec.countries.filter((code) => !have.has(code));
      const extraIds = (already.conditions?.regionsCondition?.regions?.nodes || [])
        .filter((row) => row.code && !spec.countries.includes(row.code))
        .map((row) => row.id);
      if (missing.length) {
        const added = await updateMarket(already.id, {
          conditions: {
            conditionsToAdd: { regionsCondition: { regions: missing.map((countryCode) => ({ countryCode })) } },
          },
        });
        if (added.marketUpdate.userErrors.length) {
          notes.push(`${spec.name} regions: ${added.marketUpdate.userErrors.map((row) => row.message).join("; ")}`);
        }
      }
      if (extraIds.length) {
        const removedExtras = await updateMarket(already.id, {
          conditions: { conditionsToDelete: { regionsCondition: { regionIds: extraIds } } },
        });
        if (removedExtras.marketUpdate.userErrors.length) {
          notes.push(
            `${spec.name} drop: ${removedExtras.marketUpdate.userErrors.map((row) => row.message).join("; ")}`,
          );
        } else {
          notes.push(`${spec.name}: removed ${extraIds.length} country${extraIds.length === 1 ? "" : "ies"} no longer on the shop.`);
        }
      }
      resolved.push({ id: already.id, spec });
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
          name: spec.name,
          handle: spec.handle,
          status: "ACTIVE",
          conditions: {
            regionsCondition: {
              regions: spec.countries.map((countryCode) => ({ countryCode })),
            },
          },
        },
      },
    );
    if (created.marketCreate.userErrors.length) {
      notes.push(`${spec.name}: ${created.marketCreate.userErrors.map((row) => row.message).join("; ")}`);
    } else if (created.marketCreate.market?.id) {
      notes.push(`Created market ${created.marketCreate.market.name || spec.name}.`);
      resolved.push({ id: created.marketCreate.market.id, spec });
    }
  }
  notes.push(...(await configureMarketCurrencies(resolved)));
  notes.push(...(await ensureMarketPriceLists(resolved)));
  return notes;
}

async function configureMarketCurrencies(markets: Array<{ id: string; spec: MarketSpec }>) {
  const notes: string[] = [];
  for (const row of markets) {
    const updated = await updateMarket(row.id, {
      currencySettings: {
        baseCurrency: row.spec.currency,
        localCurrencies: row.spec.localCurrencies,
        roundingEnabled: true,
      },
    });
    if (updated.marketUpdate.userErrors.length) {
      notes.push(`${row.spec.name} currency: ${updated.marketUpdate.userErrors.map((err) => err.message).join("; ")}`);
    } else if (row.spec.localCurrencies) {
      notes.push(`${row.spec.name} prices display in ${row.spec.currency} (and local currencies in that market).`);
    } else {
      notes.push(
        `${row.spec.name} prices display in ${row.spec.currency} so countries without a presentment currency do not fall back to shop NZD.`,
      );
    }
  }
  return notes;
}

type MarketPriceList = { id: string; spec: MarketSpec; priceListId: string; currency: string };

async function listMarketCatalogs(marketId: string) {
  const data = await shopifyGraphql<{
    market?: {
      catalogs: { nodes: Array<{ id: string; title?: string; priceList?: { id: string; currency?: string } | null }> };
    } | null;
  }>(
    `query ($id: ID!) {
      market(id: $id) {
        catalogs(first: 10) {
          nodes { id title priceList { id name currency } }
        }
      }
    }`,
    { id: marketId },
  );
  return data.market?.catalogs.nodes || [];
}

export async function ensureMarketPriceLists(markets?: Array<{ id: string; spec: MarketSpec }>) {
  const notes: string[] = [];
  const rows = markets || (await listMarketsForPricing());
  const ready: MarketPriceList[] = [];
  for (const row of rows) {
    if (row.spec.currency === SHOP_CURRENCY) continue;
    const existing = (await listMarketCatalogs(row.id)).find((catalog) => catalog.priceList?.id);
    if (existing?.priceList?.id) {
      ready.push({ ...row, priceListId: existing.priceList.id, currency: existing.priceList.currency || row.spec.currency });
      continue;
    }
    const createdCatalog = await shopifyGraphql<{
      catalogCreate: { catalog?: { id: string }; userErrors: Array<{ message: string }> };
    }>(
      `mutation ($input: CatalogCreateInput!) {
        catalogCreate(input: $input) {
          catalog { id }
          userErrors { field message }
        }
      }`,
      {
        input: {
          title: `${row.spec.name} prices`,
          status: "ACTIVE",
          context: { marketIds: [row.id] },
        },
      },
    );
    if (createdCatalog.catalogCreate.userErrors.length || !createdCatalog.catalogCreate.catalog?.id) {
      notes.push(
        `${row.spec.name} catalog: ${createdCatalog.catalogCreate.userErrors.map((err) => err.message).join("; ") || "no catalog"}`,
      );
      continue;
    }
    const createdList = await shopifyGraphql<{
      priceListCreate: { priceList?: { id: string; currency?: string }; userErrors: Array<{ message: string }> };
    }>(
      `mutation ($input: PriceListCreateInput!) {
        priceListCreate(input: $input) {
          priceList { id currency }
          userErrors { field message }
        }
      }`,
      {
        input: {
          name: `${row.spec.name} ${row.spec.currency}`,
          currency: row.spec.currency,
          catalogId: createdCatalog.catalogCreate.catalog.id,
          parent: { adjustment: { type: "PERCENTAGE_DECREASE", value: 0 } },
        },
      },
    );
    if (createdList.priceListCreate.userErrors.length || !createdList.priceListCreate.priceList?.id) {
      notes.push(
        `${row.spec.name} price list: ${createdList.priceListCreate.userErrors.map((err) => err.message).join("; ") || "no list"}`,
      );
      continue;
    }
    ready.push({
      ...row,
      priceListId: createdList.priceListCreate.priceList.id,
      currency: createdList.priceListCreate.priceList.currency || row.spec.currency,
    });
    notes.push(`Locked ${row.spec.name} list prices in ${row.spec.currency}.`);
  }
  return notes;
}

async function listMarketsForPricing() {
  const existing = await listShopifyMarkets();
  return MARKET_LANES.map((spec) => {
    const already = matchMarket(existing, spec);
    return already ? { id: already.id, spec } : undefined;
  }).filter((row): row is { id: string; spec: MarketSpec } => Boolean(row));
}

export async function syncShopifyPresentmentPrices() {
  const notes = [...(await ensureMarketPriceLists())];
  const products = fernoraCatalog();
  const listed = await shopifyGraphql<{
    products: {
      nodes: Array<{
        title: string;
        variants: { nodes: Array<{ id: string; sku?: string | null }> };
      }>;
    };
  }>(
    `{ products(first: 50, query: "vendor:${FERNORA_NAME}") {
        nodes { title variants(first: 50) { nodes { id sku } } }
      } }`,
  );
  const pricesByList = new Map<string, Array<{ variantId: string; price: { amount: string; currencyCode: string } }>>();
  const markets = await listMarketsForPricing();
  const lists = new Map<string, { priceListId: string; currency: string; name: string }>();
  for (const row of markets) {
    if (row.spec.currency === SHOP_CURRENCY) continue;
    const catalog = (await listMarketCatalogs(row.id)).find((item) => item.priceList?.id);
    if (!catalog?.priceList?.id) continue;
    lists.set(row.id, {
      priceListId: catalog.priceList.id,
      currency: catalog.priceList.currency || row.spec.currency,
      name: row.spec.name,
    });
  }
  for (const product of products) {
    const node = listed.products.nodes.find((row) =>
      row.variants.nodes.some((variant) => (variant.sku || "").startsWith(product.id)),
    );
    if (!node) continue;
    for (const list of lists.values()) {
      const amount = retailPriceInCurrency(product.price, list.currency).toFixed(2);
      const rows = pricesByList.get(list.priceListId) || [];
      for (const variant of node.variants.nodes) {
        rows.push({ variantId: variant.id, price: { amount, currencyCode: list.currency } });
      }
      pricesByList.set(list.priceListId, rows);
    }
  }
  for (const [priceListId, prices] of pricesByList) {
    const chunk = 50;
    for (let index = 0; index < prices.length; index += chunk) {
      const updated = await shopifyGraphql<{
        priceListFixedPricesAdd: { userErrors: Array<{ message: string }> };
      }>(
        `mutation ($priceListId: ID!, $prices: [PriceListPriceInput!]!) {
          priceListFixedPricesAdd(priceListId: $priceListId, prices: $prices) {
            userErrors { field message }
          }
        }`,
        { priceListId, prices: prices.slice(index, index + chunk) },
      );
      if (updated.priceListFixedPricesAdd.userErrors.length) {
        notes.push(updated.priceListFixedPricesAdd.userErrors.map((err) => err.message).join("; "));
      }
    }
  }
  notes.unshift(
    `Set presentment prices from shop ${SHOP_CURRENCY} for ${products.length} catalog product${products.length === 1 ? "" : "s"}.`,
  );
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
  const mixTitles = CATALOG_SERIES.map((series) => ({
    handle: series.handle,
    title: series.label,
    ids: groups[series.id] || [],
  }));
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

const FERNORA_CARRIER_NAME = "Fernora";

export async function registerGelatoCarrierService(origin?: string) {
  const notes: string[] = [];
  const callbackUrl = origin ? `${origin.replace(/\/$/, "")}/api/shopify/shipping-rates` : undefined;
  const existing = await shopifyGraphql<{
    carrierServices: { nodes: Array<{ id: string; name: string; callbackUrl?: string | null }> };
  }>(`{ carrierServices(first: 10) { nodes { id name active callbackUrl } } }`);
  const found = existing.carrierServices.nodes.find(
    (row) => row.name === "Gelato" || row.name === FERNORA_CARRIER_NAME,
  );
  if (found) {
    const nextCallback = callbackUrl || found.callbackUrl || undefined;
    const updated = await shopifyGraphql<{
      carrierServiceUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation ($input: DeliveryCarrierServiceUpdateInput!) {
        carrierServiceUpdate(input: $input) { userErrors { field message } }
      }`,
      {
        input: {
          id: found.id,
          name: FERNORA_CARRIER_NAME,
          ...(nextCallback ? { callbackUrl: nextCallback } : {}),
          active: true,
          supportsServiceDiscovery: true,
        },
      },
    );
    if (updated.carrierServiceUpdate.userErrors.length) {
      notes.push("Carrier: " + updated.carrierServiceUpdate.userErrors.map((row) => row.message).join("; "));
    } else if (found.name !== FERNORA_CARRIER_NAME) {
      notes.push("Checkout shipping carrier renamed to Fernora.");
    } else {
      notes.push(
        nextCallback
          ? `Fernora shipping callback updated: ${nextCallback}`
          : "Fernora shipping carrier is active.",
      );
    }
    return notes;
  }
  if (!callbackUrl) {
    notes.push("No Fernora carrier service to rename yet.");
    return notes;
  }
  const created = await shopifyGraphql<{
    carrierServiceCreate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($input: DeliveryCarrierServiceCreateInput!) {
      carrierServiceCreate(input: $input) { userErrors { field message } }
    }`,
    { input: { name: FERNORA_CARRIER_NAME, callbackUrl, active: true, supportsServiceDiscovery: true } },
  );
  if (created.carrierServiceCreate.userErrors.length) {
    notes.push("Carrier: " + created.carrierServiceCreate.userErrors.map((row) => row.message).join("; "));
  } else {
    notes.push(`Fernora carrier service registered. Checkout shipping uses destination print rates.`);
  }
  return notes;
}

export async function prepareShopifyCustomerStore(origin: string) {
  const notes: string[] = [];
  notes.push(...(await publishFernoraToOnlineStore()));
  notes.push(...(await configureShopifyMarkets()));
  notes.push(...(await syncShopifyPresentmentPrices()));
  notes.push(...(await fillShopifyCollections()));
  notes.push(...(await brandHorizonTheme(origin)));
  notes.push(...(await registerGelatoCarrierService(origin)));
  return notes;
}
