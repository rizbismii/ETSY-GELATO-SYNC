import { brandHorizonStorefront } from "../src/lib/shopify-horizon.ts";
import { shopifyGraphql, syncShopifyPolicies } from "../src/lib/shopify.ts";

const theme = await shopifyGraphql<{ themes: { nodes: Array<{ id: string; role: string }> } }>(
  `{ themes(first: 10) { nodes { id role } } }`,
);
const themeId = theme.themes.nodes.find((row) => row.role === "MAIN")?.id;
if (!themeId) throw new Error("No MAIN theme");
const branding = await brandHorizonStorefront(themeId, "https://fernora.nz");
const policies = await syncShopifyPolicies();
for (const note of [...branding, ...policies]) console.log(note);
