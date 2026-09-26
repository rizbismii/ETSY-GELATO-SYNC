import type { PrintifyShopProduct } from "./printify.ts";

const FERNORA_VENDOR = "Fernora";
const VARIANT_CAP = 100;
const MOCKUP_CAP = 12;
const OPTION_RANK = ["Color", "Size"];

export type PrintifyOptionValue = { optionName: string; name: string };

export type PrintifyShopifyVariantDraft = {
  printifyVariantId: number;
  sku: string;
  price: string;
  optionValues: PrintifyOptionValue[];
  inventoryPolicy: "CONTINUE";
  tracked: false;
  inStock: true;
  mockupUrl?: string;
  alt: string;
};

export type PrintifyShopifyDraft = {
  printifyProductId: string;
  title: string;
  descriptionHtml: string;
  tags: string[];
  productOptions: Array<{ name: string; values: Array<{ name: string }> }>;
  variants: PrintifyShopifyVariantDraft[];
  files: Array<{ originalSource: string; alt: string; contentType: "IMAGE" }>;
  hiddenVariantCount: number;
  stockLine: string;
};

type HiddenReason = "off" | "price" | "duplicate" | "cap" | "options";

type ListedImage = {
  src?: string;
  variant_ids?: number[];
  is_default?: boolean;
  index: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function normalizePrintifyOptionName(name: string) {
  const key = name.trim().toLowerCase();
  if (key === "color" || key === "colors" || key === "colour" || key === "colours") return "Color";
  if (key === "size" || key === "sizes") return "Size";
  return name.trim();
}

function optionRank(name: string) {
  const index = OPTION_RANK.indexOf(name);
  return index === -1 ? OPTION_RANK.length : index;
}

function orderedOptionNames(names: string[]) {
  return [...new Set(names)].sort((a, b) => optionRank(a) - optionRank(b) || a.localeCompare(b));
}

export function printifyCentsToPrice(cents: number) {
  const rounded = Math.round(cents);
  const dollars = Math.trunc(rounded / 100);
  const remainder = Math.abs(rounded % 100);
  return `${dollars}.${String(remainder).padStart(2, "0")}`;
}

function descriptionHtml(description?: string) {
  const text = (description || "").trim();
  const made = "<p>Made to order. In stock while the colour and size are on in Printify.</p>";
  if (!text) return made;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    const cleaned = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    return `${cleaned}${made}`;
  }
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`)
    .join("");
  return `${paragraphs}${made}`;
}

function tagsFor(product: PrintifyShopProduct) {
  const tags = ["Fernora", "Printify", ...(product.tags || [])].map((tag) => tag.trim()).filter(Boolean);
  return [...new Set(tags)].slice(0, 20);
}

function optionLookup(product: PrintifyShopProduct) {
  const lookup = new Map<number, PrintifyOptionValue>();
  for (const option of product.options || []) {
    const optionName = normalizePrintifyOptionName(option.name || "");
    if (!optionName) continue;
    for (const value of option.values || []) {
      if (typeof value.id !== "number") continue;
      const name = (value.title || "").trim();
      if (!name) continue;
      lookup.set(value.id, { optionName, name });
    }
  }
  return lookup;
}

function valuesForVariant(product: PrintifyShopProduct, variant: NonNullable<PrintifyShopProduct["variants"]>[number]) {
  const lookup = optionLookup(product);
  const chosen: PrintifyOptionValue[] = [];
  const seen = new Set<string>();
  for (const id of variant.options || []) {
    const row = lookup.get(id);
    if (!row || seen.has(row.optionName)) continue;
    seen.add(row.optionName);
    chosen.push(row);
  }
  if (chosen.length) {
    return chosen.sort((a, b) => optionRank(a.optionName) - optionRank(b.optionName));
  }
  const title = (variant.title || "").trim();
  if (title) return [{ optionName: "Title", name: title }];
  return null;
}

function httpsImages(product: PrintifyShopProduct): ListedImage[] {
  return (product.images || [])
    .map((image, index) => ({ ...image, index }))
    .filter((image) => typeof image.src === "string" && /^https:\/\//i.test(image.src));
}

function galleryFor(images: ListedImage[], keptIds: Set<number>) {
  const relevant = images.filter((image) => {
    const ids = image.variant_ids || [];
    if (!ids.length) return true;
    return ids.some((id) => keptIds.has(id));
  });
  relevant.sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) || a.index - b.index);
  const seen = new Set<string>();
  const files: ListedImage[] = [];
  for (const image of relevant) {
    if (!image.src || seen.has(image.src)) continue;
    seen.add(image.src);
    files.push(image);
    if (files.length >= MOCKUP_CAP) break;
  }
  return files;
}

function mockupFor(gallery: ListedImage[], variantId: number) {
  const matched = gallery.filter((image) => (image.variant_ids || []).includes(variantId));
  const pool = matched.length ? matched : gallery;
  pool.sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) || a.index - b.index);
  return pool[0]?.src;
}

function stockLine(inStock: number, hidden: number, reasons: Partial<Record<HiddenReason, number>>) {
  const stock = `${inStock} variant${inStock === 1 ? "" : "s"} in stock, made to order`;
  if (!hidden) return `${stock}.`;
  const detail = (Object.entries(reasons) as Array<[HiddenReason, number]>)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => {
      if (reason === "off") return `${count} disabled or unavailable`;
      if (reason === "price") return `${count} missing a price`;
      if (reason === "duplicate") return `${count} duplicate colour and size`;
      if (reason === "cap") return `${count} past the 100 variant limit`;
      return `${count} missing colour or size`;
    });
  return `${stock}. ${hidden} left off (${detail.join("; ")}).`;
}

export function printifyProductToShopifyDraft(product: PrintifyShopProduct): PrintifyShopifyDraft {
  const title = (product.title || "").trim() || `Printify ${product.id}`;
  const reasons: Partial<Record<HiddenReason, number>> = {};
  const bump = (reason: HiddenReason) => {
    reasons[reason] = (reasons[reason] || 0) + 1;
  };
  type Resolved = {
    id: number;
    sku: string;
    price: string;
    isDefault: boolean;
    optionValues: PrintifyOptionValue[];
    sourceIndex: number;
  };
  const resolved: Resolved[] = [];
  for (const [sourceIndex, variant] of (product.variants || []).entries()) {
    if (variant.is_enabled === false || variant.is_available === false) {
      bump("off");
      continue;
    }
    if (typeof variant.id !== "number") {
      bump("options");
      continue;
    }
    if (typeof variant.price !== "number" || !Number.isFinite(variant.price) || variant.price < 0) {
      bump("price");
      continue;
    }
    const optionValues = valuesForVariant(product, variant);
    if (!optionValues?.length) {
      bump("options");
      continue;
    }
    resolved.push({
      id: variant.id,
      sku: (variant.sku || "").trim() || `printify-${product.id}-${variant.id}`,
      price: printifyCentsToPrice(variant.price),
      isDefault: Boolean(variant.is_default),
      optionValues,
      sourceIndex,
    });
  }
  const optionSetKey = (row: { optionValues: PrintifyOptionValue[] }) =>
    orderedOptionNames(row.optionValues.map((value) => value.optionName)).join("\0");
  const optionSetCounts = new Map<string, number>();
  for (const row of resolved) {
    const key = optionSetKey(row);
    optionSetCounts.set(key, (optionSetCounts.get(key) || 0) + 1);
  }
  let requiredKey = "";
  let requiredCount = -1;
  for (const [key, count] of optionSetCounts) {
    if (count > requiredCount) {
      requiredKey = key;
      requiredCount = count;
    }
  }
  const required = requiredKey ? requiredKey.split("\0") : [];
  const complete = resolved.flatMap((row) => {
    if (!required.every((name) => row.optionValues.some((value) => value.optionName === name))) {
      bump("options");
      return [];
    }
    return [
      {
        ...row,
        optionValues: required.map((name) => row.optionValues.find((value) => value.optionName === name)!),
      },
    ];
  });
  complete.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sourceIndex - b.sourceIndex);
  const seenKeys = new Set<string>();
  const unique: Resolved[] = [];
  for (const row of complete) {
    const key = orderedOptionNames(row.optionValues.map((value) => value.optionName))
      .map((name) => `${name}=${row.optionValues.find((value) => value.optionName === name)?.name}`)
      .join("\0");
    if (seenKeys.has(key)) {
      bump("duplicate");
      continue;
    }
    seenKeys.add(key);
    unique.push(row);
  }
  const kept = unique.slice(0, VARIANT_CAP);
  if (unique.length > VARIANT_CAP) reasons.cap = unique.length - VARIANT_CAP;
  const optionNames = orderedOptionNames(kept.flatMap((row) => row.optionValues.map((value) => value.optionName)));
  const productOptions = optionNames.map((name) => ({
    name,
    values: [...new Set(kept.flatMap((row) => row.optionValues.filter((value) => value.optionName === name).map((value) => value.name)))].map(
      (value) => ({ name: value }),
    ),
  }));
  const images = httpsImages(product);
  const gallery = galleryFor(images, new Set(kept.map((row) => row.id)));
  const variants: PrintifyShopifyVariantDraft[] = kept.map((row) => {
    const optionValues = optionNames.map((name) => row.optionValues.find((value) => value.optionName === name)!);
    const label = optionValues.map((value) => value.name).join(" / ");
    return {
      printifyVariantId: row.id,
      sku: row.sku,
      price: row.price,
      optionValues,
      inventoryPolicy: "CONTINUE",
      tracked: false,
      inStock: true,
      mockupUrl: mockupFor(gallery, row.id),
      alt: label ? `${title} · ${label}` : title,
    };
  });
  const hiddenVariantCount = Object.values(reasons).reduce((sum, count) => sum + (count || 0), 0);
  return {
    printifyProductId: product.id,
    title,
    descriptionHtml: descriptionHtml(product.description),
    tags: tagsFor(product),
    productOptions,
    variants,
    files: gallery.map((image) => ({
      originalSource: image.src || "",
      alt: title,
      contentType: "IMAGE" as const,
    })),
    hiddenVariantCount,
    stockLine: stockLine(variants.length, hiddenVariantCount, reasons),
  };
}

export function printifyDraftToProductSetInput(draft: PrintifyShopifyDraft, existingId?: string) {
  const input: Record<string, unknown> = {
    title: draft.title,
    descriptionHtml: draft.descriptionHtml,
    vendor: FERNORA_VENDOR,
    productType: "Printify",
    status: "ACTIVE",
    tags: draft.tags,
    productOptions: draft.productOptions,
    variants: draft.variants.map((variant) => ({
      optionValues: variant.optionValues,
      price: variant.price,
      sku: variant.sku,
      inventoryPolicy: variant.inventoryPolicy,
      inventoryItem: { tracked: variant.tracked, requiresShipping: true, sku: variant.sku },
      ...(variant.mockupUrl
        ? { file: { originalSource: variant.mockupUrl, contentType: "IMAGE", alt: variant.alt } }
        : {}),
    })),
    metafields: [
      {
        namespace: "fernora",
        key: "printify_product_id",
        type: "single_line_text_field",
        value: draft.printifyProductId,
      },
      {
        namespace: "fernora",
        key: "stock",
        type: "single_line_text_field",
        value: "made-to-order",
      },
    ],
  };
  if (existingId) input.id = existingId;
  if (draft.files.length) input.files = draft.files;
  return input;
}
