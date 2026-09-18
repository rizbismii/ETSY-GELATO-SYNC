import { fernoraCatalog, FERNORA_NAME, FERNORA_SHIP_BLURB } from "@/lib/shop";
import { gelatoCodesForLane, SHIP_LANES } from "@/lib/gelato-countries";
import {
  onlineStorePublicationId,
  publishableToOnlineStore,
  shopifyGraphql,
} from "@/lib/shopify";

const HORIZON_THEME = "gid://shopify/OnlineStoreTheme/189823058216";
const FRONTPAGE = "gid://shopify/Collection/515726311720";

const MARKET_LANES: Array<{ name: string; handle: string; aliases: string[]; lane: (typeof SHIP_LANES)[number] }> = [
  { name: "New Zealand", handle: "nz", aliases: ["new zealand", "new-zealand"], lane: "NZ" },
  { name: "Australia", handle: "australia", aliases: ["australia"], lane: "AU" },
  { name: "United States & Americas", handle: "americas", aliases: ["united states", "americas"], lane: "US" },
  { name: "United Kingdom & Ireland", handle: "united-kingdom", aliases: ["united kingdom", "uk"], lane: "GB" },
  { name: "Europe", handle: "europe", aliases: ["europe", "european union"], lane: "EU" },
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
  for (const market of MARKET_LANES) {
    const already =
      byName.has(market.name.toLowerCase()) ||
      byHandle.has(market.handle) ||
      market.aliases.some((alias) => byName.has(alias) || byHandle.has(alias));
    if (already) {
      notes.push(`Market already exists: ${market.name}`);
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
    } else {
      notes.push(`Created market ${created.marketCreate.market?.name || market.name}.`);
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

export async function brandHorizonTheme() {
  const notes: string[] = [];
  const themeId = await mainThemeId();
  try {
    await shopifyGraphql(
      `mutation ($id: ID!, $input: OnlineStoreThemeInput!) {
        themeUpdate(id: $id, input: $input) { userErrors { field message } }
      }`,
      { id: themeId, input: { name: "Fernora" } },
    );
  } catch (error) {
    notes.push(`Theme rename: ${(error as Error).message}`);
  }
  const current = await shopifyGraphql<{
    theme: {
      files: { nodes: Array<{ filename: string; body?: { content?: string } }> };
    };
  }>(
    `query ($id: ID!) {
      theme(id: $id) {
        files(filenames: ["templates/index.json"], first: 1) {
          nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
        }
      }
    }`,
    { id: themeId },
  );
  const raw = current.theme.files.nodes[0]?.body?.content || "";
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) {
    notes.push("Horizon index.json could not be read.");
    return notes;
  }
  const template = JSON.parse(raw.slice(jsonStart)) as {
    sections: Record<
      string,
      {
        type?: string;
        blocks?: Record<string, { type?: string; settings?: Record<string, unknown> }>;
        settings?: Record<string, unknown>;
      }
    >;
    order?: string[];
  };
  for (const section of Object.values(template.sections || {})) {
    if (section.type === "hero") {
      for (const block of Object.values(section.blocks || {})) {
        if (block.type === "text" && block.settings) {
          block.settings.text = "<p>Quiet work for the house.</p>";
          block.settings.type_preset = "h2";
        }
        if (block.type === "button" && block.settings) {
          block.settings.label = "Shop the catalog";
          block.settings.link = "shopify://collections/all";
        }
      }
    }
    if (section.type === "product-list" && section.settings) {
      section.settings.collection = "all";
      section.settings.max_products = 16;
      section.settings.columns = 4;
    }
  }
  const upserted = await shopifyGraphql<{
    themeFilesUpsert: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        userErrors { field filename message }
      }
    }`,
    {
      themeId,
      files: [
        {
          filename: "templates/index.json",
          body: { type: "TEXT", value: JSON.stringify(template, null, 2) },
        },
      ],
    },
  );
  if (upserted.themeFilesUpsert.userErrors.length) {
    notes.push("Theme: " + upserted.themeFilesUpsert.userErrors.map((row) => row.message).join("; "));
  } else {
    notes.push("Horizon homepage now says Quiet work for the house and lists the live catalog.");
  }
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
  notes.push(...(await brandHorizonTheme()));
  notes.push(...(await registerGelatoCarrierService(origin)));
  return notes;
}
