import assert from "node:assert/strict";
import { test } from "node:test";
import { printifyProductToShopifyDraft } from "./printify-shopify.ts";
import { sizeChartFor, storefrontChartFor, withSizeChart, withSizeChartInTheme } from "./size-chart.ts";

const CATALOG = [
  { id: "live_poster", title: "Fern Arc Poster · A3 Semi-Gloss", category: "poster" },
  { id: "live_quote_breathe", title: "Breathe You Are Here · A3 Quote Poster", category: "poster" },
  { id: "live_botanical_kowhai", title: "Kowhai Bells · 18×24 Botanical Print", category: "print" },
  { id: "live_canvas_harbour", title: "Harbour Morning Canvas · 12×12", category: "canvas" },
  { id: "live_frame_kind", title: "Home Is a Kind Light · 12×16 Oak Frame", category: "frame" },
  { id: "live_sneaker_star", title: "Black Camo · Men’s Mesh Sneakers", category: "sneakers" },
  { id: "live_sneaker_star_w", title: "Southern Cross Star · Women’s Mesh Sneakers", category: "sneakers" },
  { id: "live_hoodie_bloom", title: "Grow With Purpose · Embroidered Zip Hoodie", category: "hoodie" },
  { id: "live_tee_bloom", title: "Grow With Purpose · Embroidered Heavy Cotton Tee", category: "tee" },
];

test("every live catalog item has a size chart", () => {
  for (const product of CATALOG) {
    const chart = sizeChartFor(product);
    assert.ok(chart, `${product.id} is missing a size chart`);
    assert.ok(chart.columns.length > 0);
    assert.ok(chart.rows.length > 0);
  }
  assert.equal(sizeChartFor(CATALOG[2])?.rows[0]?.values[0], "18 in");
  assert.equal(
    sizeChartFor({
      title: "Fern Arc Poster · A3 Semi-Gloss",
      category: "poster",
      description: "Printed on A3 paper. Unframed.",
    })?.rows[0]?.values[0],
    "11.7 in (297 mm)",
  );
  assert.equal(sizeChartFor(CATALOG[5])?.rows[0]?.label, "US 5");
  assert.equal(sizeChartFor(CATALOG[6])?.rows[0]?.label, "US 5.5");
});

test("a Printify size table becomes a closed dropdown and stays out of the shipping table", () => {
  const html = withSizeChart(
    `<table id="size-guide"><tr><td>Width, in</td><td>20.00</td></tr></table><p>Soft crewneck.</p>`,
    { title: "Floral sweatshirt" },
  );
  assert.match(html, /<details class="fernora-size-chart"><summary>Size chart<\/summary>/);
  assert.match(html, /Width, in/);
  assert.ok(html.indexOf("<details") < html.indexOf("<table"));
  const shipping = withSizeChart(`<table><tr><th>Ships to</th><td>New Zealand</td></tr></table>`, {
    title: "Fern Arc Poster A3",
  });
  assert.match(shipping, /<summary>Size chart<\/summary>/);
  assert.match(shipping, /11\.7 in/);
  assert.equal(shipping.match(/<table/g)?.length, 2);
});

test("Printify crewneck HTML keeps the measured chart inside the dropdown", () => {
  const draft = printifyProductToShopifyDraft({
    id: "crew",
    title: "Grow Through What You Go Through Sweatshirt",
    description: `<table id="size-guide"><tr><td>Width, in</td><td>20.00</td></tr></table><p>A warm crewneck.</p>`,
    variants: [{ id: 1, price: 4800, is_enabled: true, title: "S" }],
    images: [{ src: "https://images.printify.com/crew.jpg", is_default: true, variant_ids: [1] }],
  });
  assert.match(draft.descriptionHtml, /<summary>Size chart<\/summary>/);
  assert.match(draft.descriptionHtml, /20\.00/);
  assert.match(draft.descriptionHtml, /Made to order/);
  const tee = sizeChartFor({ title: "Haunted house tee", category: "tee" });
  assert.equal(tee?.rows[0]?.values[0], "18");
});

test("fernora.nz theme closes every product size chart into a dropdown", () => {
  const sweat = storefrontChartFor("Grow Through What You Go Through floral illustration Sweatshirt");
  assert.match(sweat, /<summary>Size chart<\/summary>/);
  assert.match(sweat, /20\.00/);
  assert.match(storefrontChartFor("T-Shirt Gildan 5000"), /<td>18<\/td>/);
  assert.match(storefrontChartFor("Grow With Purpose Embroidered Zip Hoodie"), /19\.25/);
  assert.match(storefrontChartFor("Black Camo Men’s Mesh Sneakers"), /US 5/);
  assert.doesNotMatch(storefrontChartFor("Black Camo Men’s Mesh Sneakers"), /US 5\.5/);
  assert.match(storefrontChartFor("Southern Cross Star Women’s Mesh Sneakers"), /US 5\.5/);
  assert.match(storefrontChartFor("Kowhai Bells 18×24 Botanical Print"), /18 in/);
  assert.match(storefrontChartFor("Harbour Morning Canvas 12×12"), /12 in/);
  assert.doesNotMatch(storefrontChartFor("Harbour Morning Canvas 12×12"), /11\.7 in/);
  assert.match(storefrontChartFor("Home Is a Kind Light 12×16 Oak Frame"), /12 in/);
  assert.match(storefrontChartFor("Fern Arc Poster A3"), /11\.7 in/);
  const theme = withSizeChartInTheme("<html><body><p>Shop</p></body></html>");
  assert.match(theme, /fernora-size-chart/);
  assert.match(theme, /table\.id === "size-guide"/);
  assert.ok(theme.indexOf("fernora-size-chart") < theme.indexOf("</body>"));
  assert.equal(withSizeChartInTheme(theme), theme);
});
