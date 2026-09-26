import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePrintifyOptionName,
  printifyCentsToPrice,
  printifyDraftToProductSetInput,
  printifyProductToShopifyDraft,
} from "./printify-shopify.ts";

const crewneck = {
  id: "6ab6faac7ef5daa9950bcb7b",
  title: "Unisex Heavy Blend Crewneck",
  description: "Grow through what you go through.\n\nBotanical print.",
  tags: ["botanical", "Fernora"],
  options: [
    {
      name: "Colors",
      type: "color",
      values: [
        { id: 11, title: "White" },
        { id: 12, title: "Black" },
      ],
    },
    {
      name: "Sizes",
      type: "size",
      values: [
        { id: 21, title: "S" },
        { id: 22, title: "M" },
      ],
    },
  ],
  variants: [
    { id: 1, sku: "SKU-W-S", price: 2999, is_enabled: true, is_default: true, is_available: true, options: [11, 21] },
    { id: 2, sku: "SKU-W-M", price: 2999, is_enabled: true, is_available: true, options: [11, 22] },
    { id: 3, sku: "SKU-B-S", price: 2999, is_enabled: false, is_available: true, options: [12, 21] },
    { id: 4, sku: "SKU-B-M", price: 2999, is_enabled: true, is_available: false, options: [12, 22] },
  ],
  images: [
    { src: "https://images.printify.com/black.jpg", variant_ids: [3, 4], is_default: false },
    { src: "https://images.printify.com/white.jpg", variant_ids: [1, 2], is_default: true },
    { src: "http://images.printify.com/insecure.jpg", variant_ids: [1], is_default: false },
  ],
};

test("Printify option names match Shopify Color and Size", () => {
  assert.equal(normalizePrintifyOptionName("Colors"), "Color");
  assert.equal(normalizePrintifyOptionName("Colours"), "Color");
  assert.equal(normalizePrintifyOptionName("Sizes"), "Size");
  assert.equal(printifyCentsToPrice(2999), "29.99");
  assert.equal(printifyCentsToPrice(1000), "10.00");
});

test("enabled Printify variants become Shopify name, description, mockups, and made-to-order stock", () => {
  const draft = printifyProductToShopifyDraft(crewneck);
  assert.equal(draft.title, "Unisex Heavy Blend Crewneck");
  assert.match(draft.descriptionHtml, /Grow through what you go through\./);
  assert.match(draft.descriptionHtml, /Botanical print\./);
  assert.match(draft.descriptionHtml, /Made to order/);
  assert.deepEqual(
    draft.productOptions.map((option) => option.name),
    ["Color", "Size"],
  );
  assert.deepEqual(draft.productOptions[0].values.map((value) => value.name), ["White"]);
  assert.deepEqual(draft.productOptions[1].values.map((value) => value.name), ["S", "M"]);
  assert.equal(draft.variants.length, 2);
  assert.equal(draft.variants[0].sku, "SKU-W-S");
  assert.equal(draft.variants[0].price, "29.99");
  assert.equal(draft.variants[0].inventoryPolicy, "CONTINUE");
  assert.equal(draft.variants[0].tracked, false);
  assert.equal(draft.variants[0].inStock, true);
  assert.equal(draft.variants[0].mockupUrl, "https://images.printify.com/white.jpg");
  assert.equal(draft.variants[1].mockupUrl, "https://images.printify.com/white.jpg");
  assert.equal(draft.files[0].originalSource, "https://images.printify.com/white.jpg");
  assert.equal(draft.files.some((file) => file.originalSource.includes("black.jpg")), false);
  assert.equal(draft.files.some((file) => file.originalSource.startsWith("http://")), false);
  assert.match(draft.stockLine, /2 variants in stock, made to order/);
  assert.match(draft.stockLine, /2 left off/);
  assert.equal(draft.hiddenVariantCount, 2);
  assert.deepEqual(draft.tags.slice(0, 2), ["Fernora", "Printify"]);
});

test("Shopify input keeps made-to-order inventory and the Printify id", () => {
  const draft = printifyProductToShopifyDraft(crewneck);
  const input = printifyDraftToProductSetInput(draft, "gid://shopify/Product/1");
  assert.equal(input.id, "gid://shopify/Product/1");
  assert.equal(input.vendor, "Fernora");
  assert.equal(input.status, "ACTIVE");
  const variants = input.variants as Array<{ inventoryPolicy: string; inventoryItem: { tracked: boolean } }>;
  assert.equal(variants[0].inventoryPolicy, "CONTINUE");
  assert.equal(variants[0].inventoryItem.tracked, false);
  const metafields = input.metafields as Array<{ key: string; value: string }>;
  assert.equal(metafields.find((row) => row.key === "printify_product_id")?.value, crewneck.id);
  assert.equal(metafields.find((row) => row.key === "stock")?.value, "made-to-order");
  assert.equal("etsy" in input, false);
  assert.equal(Array.isArray(input.files), true);
});

test("a variant title is the only option when Printify sends no colour or size list", () => {
  const draft = printifyProductToShopifyDraft({
    id: "poster-1",
    title: "Fern print",
    description: "<p>Ready.</p><script>alert(1)</script>",
    variants: [{ id: 9, price: 1500, is_enabled: true, title: "12×16 in" }],
    images: [{ src: "https://images.printify.com/poster.jpg", is_default: true, variant_ids: [9] }],
  });
  assert.equal(draft.productOptions[0].name, "Title");
  assert.equal(draft.variants[0].optionValues[0].name, "12×16 in");
  assert.equal(draft.variants[0].price, "15.00");
  assert.equal(draft.variants[0].sku, "printify-poster-1-9");
  assert.match(draft.descriptionHtml, /<p>Ready\.<\/p>/);
  assert.doesNotMatch(draft.descriptionHtml, /script/i);
  assert.equal(draft.files[0].originalSource, "https://images.printify.com/poster.jpg");
});

test("duplicate colour and size keeps the default, and the rest stop at 100 variants", () => {
  const variants = [
    { id: 1, price: 1000, is_enabled: true, is_default: false, options: [11, 21], sku: "a" },
    { id: 2, price: 1000, is_enabled: true, is_default: true, options: [11, 21], sku: "default" },
  ];
  for (let index = 0; index < 100; index += 1) {
    variants.push({
      id: 100 + index,
      price: 1000,
      is_enabled: true,
      is_default: false,
      options: [11, 30 + index],
      sku: `s-${index}`,
    });
  }
  const sizes = variants
    .flatMap((row) => row.options)
    .filter((id) => id !== 11)
    .map((id) => ({ id, title: `Size ${id}` }));
  const draft = printifyProductToShopifyDraft({
    id: "many",
    title: "Many sizes",
    options: [
      { name: "Colors", values: [{ id: 11, title: "White" }] },
      { name: "Sizes", values: sizes },
    ],
    variants,
  });
  assert.equal(draft.variants.length, 100);
  assert.equal(draft.variants[0].sku, "default");
  assert.match(draft.stockLine, /past the 100 variant limit/);
  assert.equal(draft.variants.filter((row) => row.sku === "a").length, 0);
});
