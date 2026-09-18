import { brandHorizonStorefront } from "../src/lib/shopify-horizon.ts";
import { configureShopifyMarkets, registerGelatoCarrierService } from "../src/lib/shopify-storefront.ts";
import {
  hideGelatoFromCheckoutShipping,
  refreshShopifyProductCopy,
  shopifyGraphql,
  syncShopifyPolicies,
} from "../src/lib/shopify.ts";

const theme = await shopifyGraphql<{ themes: { nodes: Array<{ id: string; role: string }> } }>(
  `{ themes(first: 10) { nodes { id role } } }`,
);
const themeId = theme.themes.nodes.find((row) => row.role === "MAIN")?.id;
if (!themeId) throw new Error("No MAIN theme");
const markets = await configureShopifyMarkets();
const branding = await brandHorizonStorefront(themeId, "https://fernora.nz");
const policies = await syncShopifyPolicies();
const carrier = await registerGelatoCarrierService();
const shipping = await hideGelatoFromCheckoutShipping();
const products = await refreshShopifyProductCopy();
for (const note of [...markets, ...branding, ...policies, ...carrier, ...shipping, ...products]) console.log(note);
