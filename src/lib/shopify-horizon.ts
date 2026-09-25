import { CATALOG_MENU, CATALOG_SERIES } from "@/lib/catalog-menu";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { shopifyGraphql } from "@/lib/shopify";
import { policyHtml } from "@/lib/shop-policies";
import { getCredentials } from "@/lib/credentials";
import { normalizePixelId, withMetaPixelInTheme } from "@/lib/meta-budget";

const HERO_FILE = "fernora-hero.png";
const COUNTRY_CURRENCY_MARK = "localization.country.name }} · {{ localization.country.currency.iso_code";
const PICKER_CSS_MARK = "/* fernora-country-currency */";
const MOBILE_LAYOUT_MARK = "/* fernora-mobile-layout */";
const STUDIO_LAYOUT_MARK = "/* fernora-studio-layout */";
const PRODUCT_LAYOUT_MARK = "/* fernora-product-layout */";
const GALLERY_LAYOUT_MARK = "/* fernora-product-gallery */";
const COLLECTION_HANDLES = CATALOG_SERIES.map((series) => series.handle);
const SERIES_COLLECTIONS = CATALOG_SERIES.map((series) => ({
  handle: series.handle,
  title: series.label,
}));

const PALETTE = {
  background: "#FBF6EC",
  foreground: "#1C2B24",
  color1: "#2F6A4A",
  color2: "#E3B23C",
};

export async function brandHorizonStorefront(themeId: string, origin?: string) {
  const notes: string[] = [];
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
  notes.push(...(await patchHorizonLocalization(themeId)));
  notes.push(...(await installFernoraMetaPixel(themeId)));
  const heroRef = await uploadFernoraHero(origin).catch((error: Error) => {
    notes.push(`Hero image: ${error.message}`);
    return "";
  });
  notes.push(...(await upsertHorizonJson(themeId, heroRef)));
  notes.push(...(await assignCollectionImages()));
  notes.push(...(await ensureSeriesCollections()));
  notes.push(...(await patchMainCatalogMenu()));
  notes.push(...(await publishGelatoLegalPages()));
  return notes;
}

async function themeFileText(themeId: string, filename: string) {
  const current = await shopifyGraphql<{
    theme: { files: { nodes: Array<{ filename: string; body?: { content?: string } }> } };
  }>(
    `query ($id: ID!, $names: [String!]) {
      theme(id: $id) {
        files(filenames: $names, first: 5) {
          nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
        }
      }
    }`,
    { id: themeId, names: [filename] },
  );
  return current.theme.files.nodes[0]?.body?.content || "";
}

async function upsertThemeText(themeId: string, filename: string, value: string) {
  const upserted = await shopifyGraphql<{
    themeFilesUpsert: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        userErrors { field filename message }
      }
    }`,
    { themeId, files: [{ filename, body: { type: "TEXT", value } }] },
  );
  return upserted.themeFilesUpsert.userErrors.map((row) => row.message);
}

export async function installFernoraMetaPixel(themeId: string) {
  const notes: string[] = [];
  const pixelId = normalizePixelId((await getCredentials()).meta?.pixelId);
  if (!pixelId) return notes;
  const raw = await themeFileText(themeId, "layout/theme.liquid");
  if (!raw) {
    notes.push("Theme layout could not be read for the Meta Pixel.");
    return notes;
  }
  const next = withMetaPixelInTheme(raw, pixelId);
  if (next === raw && raw.includes("fernora-meta-pixel") && raw.includes(pixelId)) {
    notes.push("Meta Pixel is already on fernora.nz.");
    return notes;
  }
  const errors = await upsertThemeText(themeId, "layout/theme.liquid", next);
  notes.push(errors.length ? `Meta Pixel: ${errors.join("; ")}` : "Meta Pixel is on fernora.nz PageView.");
  return notes;
}

function withCountryCurrencyLabel(source: string) {
  if (source.includes(COUNTRY_CURRENCY_MARK)) return source;
  return source.replaceAll(
    "{{- localization.country.currency.iso_code -}}",
    "{{- localization.country.name }} · {{ localization.country.currency.iso_code -}}",
  );
}

function withVisiblePickerCss(header: string) {
  let next = header;
  if (!next.includes(PICKER_CSS_MARK)) {
    const css = `
  ${PICKER_CSS_MARK}
  .dropdown-localization,
  .dropdown-localization__button {
    flex-shrink: 0;
    min-width: max-content;
    overflow: visible;
  }
  .dropdown-localization__button .currency-code,
  .mobile-localization .currency-code {
    white-space: nowrap;
    max-width: none;
    overflow: visible;
    letter-spacing: 0.02em;
  }
`;
    next = next.includes("{% endstylesheet %}")
      ? next.replace("{% endstylesheet %}", `${css}{% endstylesheet %}`)
      : `${next}\n{% stylesheet %}${css}{% endstylesheet %}\n`;
  }
  if (!next.includes(MOBILE_LAYOUT_MARK)) {
    const mobile = `
  ${MOBILE_LAYOUT_MARK}
  @media screen and (max-width: 749px) {
    .dropdown-localization,
    .mobile-localization {
      max-width: min(52vw, 14rem);
    }
    .dropdown-localization__button,
    .mobile-localization .currency-code {
      font-size: 0.75rem;
    }
    .header__column--right {
      gap: 0.35rem;
    }
  }
`;
    next = next.includes("{% endstylesheet %}")
      ? next.replace("{% endstylesheet %}", `${mobile}{% endstylesheet %}`)
      : `${next}\n{% stylesheet %}${mobile}{% endstylesheet %}\n`;
  }
  if (next.includes(STUDIO_LAYOUT_MARK)) {
    next = next.replace(
      `#MainContent .section--page-width,
  #MainContent .section-content-wrapper {
    width: 100%;
    max-width: 100%;
  }`,
      `body.template-index #MainContent .section--page-width,
  #MainContent [id$="__story_fernora"] .section-content-wrapper {
    width: 100%;
    max-width: 100%;
  }`,
    );
  } else {
    const studio = `
  ${STUDIO_LAYOUT_MARK}
  body.template-index #MainContent .section--page-width,
  #MainContent [id$="__story_fernora"] .section-content-wrapper {
    width: 100%;
    max-width: 100%;
  }
  [id$="__story_fernora"] .section-content-wrapper {
    width: 100%;
  }
  @media screen and (min-width: 750px) {
    [id$="__story_fernora"] .section-content-wrapper {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
      align-items: center;
      gap: 2.5rem;
      width: 100%;
    }
    [id$="__story_fernora"] .image-block,
    [id$="__story_fernora"] .group-block {
      min-width: 0;
      max-width: none;
      width: auto;
      height: auto;
    }
    [id$="__story_fernora"] .image-block__image {
      width: 100%;
      height: auto;
      max-height: 32rem;
      object-fit: cover;
      aspect-ratio: 4 / 5;
    }
    [id$="__story_fernora"] .text-block {
      max-width: 36rem;
    }
  }
  @media screen and (max-width: 749px) {
    [id$="__story_fernora"] .section-content-wrapper {
      display: flex;
      flex-direction: column;
    }
    [id$="__story_fernora"] .image-block,
    [id$="__story_fernora"] .group-block {
      width: 100%;
      max-width: 100%;
    }
  }
`;
    next = next.includes("{% endstylesheet %}")
      ? next.replace("{% endstylesheet %}", `${studio}{% endstylesheet %}`)
      : `${next}\n{% stylesheet %}${studio}{% endstylesheet %}\n`;
  }
  if (!next.includes(PRODUCT_LAYOUT_MARK)) {
    const product = `
  ${PRODUCT_LAYOUT_MARK}
  html {
    overflow-x: clip;
  }
  .product-information.section--page-width {
    max-width: var(--page-width, 75rem);
    margin-inline: auto;
    width: 100%;
    padding-inline: clamp(1rem, 4vw, 2.5rem);
    box-sizing: border-box;
  }
  .product-information__grid {
    align-items: start;
    min-width: 0;
  }
  .product-information__media,
  .product-details {
    min-width: 0;
    max-width: 100%;
  }
  @media screen and (min-width: 750px) {
    .product-details.sticky-content--desktop,
    .product-details.sticky-content {
      top: calc(var(--header-height, 7.5rem) + 1rem);
    }
  }
`;
    next = next.includes("{% endstylesheet %}")
      ? next.replace("{% endstylesheet %}", `${product}{% endstylesheet %}`)
      : `${next}\n{% stylesheet %}${product}{% endstylesheet %}\n`;
  }
  if (!next.includes(GALLERY_LAYOUT_MARK)) {
    const gallery = `
  ${GALLERY_LAYOUT_MARK}
  .product-information .media-gallery {
    min-width: 0;
  }
  .product-information .media-gallery__grid,
  .product-information .thumbnail-list,
  .product-information .resource-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .product-information .media-gallery__grid > :first-child,
  .product-information .media-gallery__grid .media-gallery__featured {
    grid-column: 1 / -1;
  }
`;
    next = next.includes("{% endstylesheet %}")
      ? next.replace("{% endstylesheet %}", `${gallery}{% endstylesheet %}`)
      : `${next}\n{% stylesheet %}${gallery}{% endstylesheet %}\n`;
  }
  return next;
}

async function patchHorizonLocalization(themeId: string) {
  const notes: string[] = [];
  const header = withVisiblePickerCss(withCountryCurrencyLabel(await themeFileText(themeId, "sections/header.liquid")));
  if (!header.includes(COUNTRY_CURRENCY_MARK) && !header.includes("localization.country.currency.iso_code")) {
    notes.push("Header localization markup was not found.");
  } else {
    const errors = await upsertThemeText(themeId, "sections/header.liquid", header);
    notes.push(errors.length ? `Header: ${errors.join("; ")}` : "Header picker shows country · currency.");
  }

  const drawer = withCountryCurrencyLabel(await themeFileText(themeId, "snippets/header-drawer.liquid"));
  if (drawer.includes(COUNTRY_CURRENCY_MARK) || drawer.includes("localization.country.currency.iso_code")) {
    const errors = await upsertThemeText(themeId, "snippets/header-drawer.liquid", drawer);
    notes.push(errors.length ? `Drawer: ${errors.join("; ")}` : "Mobile picker shows country · currency.");
  }

  const form = await themeFileText(themeId, "snippets/localization-form.liquid");
  let nextForm = form;
  if (form.includes("assign show_currencies = false")) {
    nextForm = nextForm.replace(
      `  assign show_currencies = false
  if currencies.size > 1
    assign show_currencies = true
  endif`,
      `  assign show_currencies = true`,
    );
  }
  if (!nextForm.includes("assign show_currencies = true")) {
    nextForm = nextForm.replace("assign show_currencies = false", "assign show_currencies = true");
  }
  if (nextForm !== form) {
    const errors = await upsertThemeText(themeId, "snippets/localization-form.liquid", nextForm);
    if (errors.length) notes.push(`Country list: ${errors.join("; ")}`);
    else notes.push("Country list always shows the currency code beside the country name.");
  }
  return notes;
}

async function uploadFernoraHero(origin?: string) {
  const existing = await shopifyGraphql<{
    files: { nodes: Array<{ fileStatus?: string | null }> };
  }>(`{ files(first: 20, query: "filename:${HERO_FILE}") { nodes { fileStatus } } }`);
  if (existing.files.nodes.some((row) => row.fileStatus === "READY" || row.fileStatus === "UPLOADED")) {
    return `shopify://shop_images/fernora-hero.jpg`;
  }
  const bytes = await readFile(path.join(process.cwd(), "public/catalog", HERO_FILE));
  const staged = await shopifyGraphql<{
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl?: string | null;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `mutation ($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename: HERO_FILE,
          mimeType: "image/png",
          resource: "FILE",
          httpMethod: "POST",
          fileSize: String(bytes.byteLength),
        },
      ],
    },
  );
  if (staged.stagedUploadsCreate.userErrors.length) {
    throw new Error(staged.stagedUploadsCreate.userErrors.map((row) => row.message).join("; "));
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const source = origin ? `${origin.replace(/\/$/, "")}/catalog/${HERO_FILE}` : "";
  if (!target) {
    if (!source) throw new Error("Shopify did not return a staged upload");
    await createShopifyFile(source);
    return `shopify://shop_images/fernora-hero.jpg`;
  }
  const form = new FormData();
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  form.append("file", new Blob([bytes], { type: "image/png" }), HERO_FILE);
  const uploaded = await fetch(target.url, { method: "POST", body: form });
  if (!uploaded.ok) throw new Error(`Hero upload failed (${uploaded.status})`);
  await createShopifyFile(target.resourceUrl || source);
  return `shopify://shop_images/fernora-hero.jpg`;
}

async function createShopifyFile(originalSource: string) {
  const created = await shopifyGraphql<{
    fileCreate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($files: [FileCreateInput!]!) {
      fileCreate(files: $files) { userErrors { field message } }
    }`,
    {
      files: [
        {
          alt: "Fernora — botanical print in a considered home",
          contentType: "IMAGE",
          originalSource,
          filename: HERO_FILE,
        },
      ],
    },
  );
  if (created.fileCreate.userErrors.length) {
    throw new Error(created.fileCreate.userErrors.map((row) => row.message).join("; "));
  }
}

type ThemeSection = {
  type?: string;
  blocks?: Record<string, ThemeBlock>;
  block_order?: string[];
  settings?: Record<string, unknown>;
};
type ThemeBlock = {
  type?: string;
  name?: string;
  static?: boolean;
  settings?: Record<string, unknown>;
  blocks?: Record<string, ThemeBlock>;
  block_order?: string[];
};

async function assignCollectionImages() {
  const notes: string[] = [];
  const listed = await shopifyGraphql<{
    collections: {
      nodes: Array<{
        id: string;
        handle: string;
        image?: { url?: string | null } | null;
        products: { nodes: Array<{ featuredImage?: { url?: string | null } | null }> };
      }>;
    };
  }>(
    `{ collections(first: 30) {
        nodes {
          id handle
          image { url }
          products(first: 1) { nodes { featuredImage { url } } }
        }
      } }`,
  );
  for (const collection of listed.collections.nodes) {
    if (!SERIES_COLLECTIONS.some((series) => series.handle === collection.handle)) continue;
    if (collection.image?.url) continue;
    const src = collection.products.nodes[0]?.featuredImage?.url;
    if (!src) {
      notes.push(`${collection.handle}: no product image to use as the series cover.`);
      continue;
    }
    const updated = await shopifyGraphql<{
      collectionUpdate: { userErrors: Array<{ message: string }> };
    }>(
      `mutation ($input: CollectionInput!) {
        collectionUpdate(input: $input) { userErrors { field message } }
      }`,
      { input: { id: collection.id, image: { src, altText: collection.handle } } },
    );
    if (updated.collectionUpdate.userErrors.length) {
      notes.push(`${collection.handle} image: ${updated.collectionUpdate.userErrors.map((row) => row.message).join("; ")}`);
    } else {
      notes.push(`${collection.handle} uses a catalog photograph as the series cover.`);
    }
  }
  return notes;
}

function textBlock(text: string, extra: Record<string, unknown> = {}): ThemeBlock {
  return {
    type: "text",
    settings: {
      text,
      width: extra.width || "fit-content",
      max_width: extra.max_width || "normal",
      alignment: extra.alignment || "left",
      type_preset: extra.type_preset || "rte",
      font: extra.font || "var(--font-body--family)",
      font_size: extra.font_size || "1rem",
      line_height: extra.line_height || "normal",
      letter_spacing: extra.letter_spacing || "normal",
      case: "none",
      wrap: extra.wrap || "pretty",
      background: false,
      background_color: "#00000026",
      corner_radius: 0,
      "padding-block-start": extra["padding-block-start"] ?? 0,
      "padding-block-end": extra["padding-block-end"] ?? 0,
      "padding-inline-start": extra["padding-inline-start"] ?? 0,
      "padding-inline-end": extra["padding-inline-end"] ?? 0,
      ...(extra.text_color ? { text_color: extra.text_color } : {}),
    },
  };
}

function imageBlock(image: string): ThemeBlock {
  return {
    type: "image",
    settings: {
      image,
      image_ratio: "adapt",
      width: "custom",
      custom_width: 48,
      width_mobile: "fill",
      custom_width_mobile: 100,
      height: "fit",
      border: "none",
      border_radius: 8,
      "padding-block-start": 0,
      "padding-block-end": 0,
      "padding-inline-start": 0,
      "padding-inline-end": 0,
    },
  };
}

async function upsertHorizonJson(themeId: string, heroRef: string) {
  const notes: string[] = [];
  const indexRaw = await themeFileText(themeId, "templates/index.json");
  const indexStart = indexRaw.indexOf("{");
  if (indexStart < 0) {
    notes.push("Horizon index.json could not be read.");
    return notes;
  }
  const template = JSON.parse(indexRaw.slice(indexStart)) as {
    sections: Record<string, ThemeSection>;
    order?: string[];
  };

  for (const section of Object.values(template.sections || {})) {
    if (section.type === "hero") {
      if (section.settings) {
        if (heroRef) {
          section.settings.image_1 = heroRef;
          section.settings.image_2 = "shopify://shop_images/catalog-kowhai-botanical.png";
        }
        section.settings.media_type_1 = "image";
        section.settings.media_type_2 = "image";
        section.settings.section_height = "large";
        section.settings.section_width = "full-width";
        section.settings.overlay_color = "#1C2B2488";
        section.settings.toggle_overlay = true;
        section.settings.horizontal_alignment_flex_direction_column = "center";
        section.settings.vertical_alignment_flex_direction_column = "flex-end";
      }
      for (const block of Object.values(section.blocks || {})) {
        if (block.type === "text" && block.settings) {
          block.settings.text = "<p>Original botanicals for considered homes.</p>";
          block.settings.type_preset = "h2";
        }
        if (block.type === "button" && block.settings) {
          block.settings.label = "Explore the collection";
          block.settings.link = "shopify://collections/all";
        }
      }
      if (section.blocks && !Object.values(section.blocks).some((block) => String(block.settings?.text || "").includes("Prints, apparel"))) {
        section.blocks.caption_fernora = textBlock("<p>Prints, apparel, and objects — priced in your currency.</p>", {
          type_preset: "rte",
          text_color: PALETTE.background,
          alignment: "center",
        });
        const order = section.block_order || Object.keys(section.blocks);
        const textId = order.find((id) => section.blocks?.[id]?.type === "text") || order[0];
        section.block_order = order.includes("caption_fernora")
          ? order
          : order.flatMap((id) => (id === textId ? [id, "caption_fernora"] : [id]));
      }
    }
    if (section.type === "product-list") {
      if (section.settings) {
        section.settings.collection = "all";
        section.settings.max_products = 16;
        section.settings.columns = 4;
        section.settings.background_color = PALETTE.background;
        section.settings["padding-block-start"] = 56;
        section.settings["padding-block-end"] = 72;
      }
      for (const block of Object.values(section.blocks || {})) {
        for (const nested of Object.values(block.blocks || {})) {
          if (nested.type === "_product-list-text" && nested.settings) {
            nested.settings.text = "<h3>The collection</h3>";
          }
          if (nested.type === "_product-list-button" && nested.settings) {
            nested.settings.label = "View the catalog";
          }
        }
      }
    }
  }

  template.sections.marquee_fernora = {
    type: "marquee",
    blocks: {
      line_studio: textBlock("<p>Original botanicals</p>", {
        type_preset: "custom",
        font_size: "var(--font-size--h4)",
        wrap: "nowrap",
        text_color: PALETTE.background,
      }),
      line_currency: textBlock("<p>Prices follow your country and currency</p>", {
        type_preset: "custom",
        font_size: "var(--font-size--h4)",
        wrap: "nowrap",
        text_color: PALETTE.background,
      }),
      line_quality: textBlock("<p>Quality guarantee on every print</p>", {
        type_preset: "custom",
        font_size: "var(--font-size--h4)",
        wrap: "nowrap",
        text_color: PALETTE.background,
      }),
    },
    block_order: ["line_studio", "line_currency", "line_quality"],
    settings: {
      movement_direction: "left",
      background_color: PALETTE.color1,
      "padding-block-start": 8,
      "padding-block-end": 8,
      gap_between_elements: 48,
    },
  };

  template.sections.collections_fernora = {
    type: "collection-list",
    blocks: {
      header_group: {
        type: "group",
        name: "Header",
        settings: {
          content_direction: "column",
          vertical_on_mobile: true,
          horizontal_alignment: "flex-start",
          gap: 8,
          width: "fill",
          "padding-block-start": 0,
          "padding-block-end": 0,
        },
        blocks: {
          title: textBlock("<h3>Shop by series</h3>", { type_preset: "h3" }),
          intro: textBlock(
            "<p>Botanicals, harbour light, quiet quotes, and objects for the house — each piece made after you order.</p>",
            { type_preset: "rte", width: "100%", max_width: "normal" },
          ),
        },
        block_order: ["title", "intro"],
      },
      "static-collection-card": {
        type: "_collection-card",
        name: "Collection card",
        static: true,
        settings: {
          horizontal_alignment: "flex-start",
          vertical_alignment: "flex-end",
          placement: "on_image",
          border: "none",
          border_width: 1,
          border_opacity: 100,
          border_radius: 8,
        },
        blocks: {
          "collection-card-image": {
            type: "_collection-card-image",
            name: "Collection image",
            static: true,
            settings: { image_ratio: "adapt" },
          },
          "collection-title": {
            type: "collection-title",
            settings: {
              type_preset: "h5",
              background: true,
              background_color: PALETTE.background,
              "padding-block-start": 4,
              "padding-block-end": 4,
              "padding-inline-start": 8,
              "padding-inline-end": 8,
            },
          },
        },
        block_order: ["collection-title"],
      },
    },
    block_order: ["header_group"],
    settings: {
      collection_list: [...COLLECTION_HANDLES],
      layout_type: "grid",
      columns: 5,
      mobile_columns: "2",
      columns_gap: 12,
      rows_gap: 16,
      max_collections: 5,
      section_width: "page-width",
      background_color: "#F3E7C8",
      "padding-block-start": 48,
      "padding-block-end": 48,
    },
  };

  template.sections.story_fernora = {
    type: "section",
    blocks: {
      image: imageBlock(heroRef || "shopify://shop_images/fernora-hero.jpg"),
      copy: {
        type: "group",
        settings: {
          content_direction: "column",
          vertical_on_mobile: true,
          horizontal_alignment_flex_direction_column: "flex-start",
          vertical_alignment_flex_direction_column: "center",
          gap: 20,
          width: "custom",
          custom_width: 48,
          width_mobile: "fill",
          custom_width_mobile: 100,
          height: "fit",
          "padding-block-start": 12,
          "padding-block-end": 12,
          "padding-inline-start": 8,
          "padding-inline-end": 8,
        },
        blocks: {
          caption: textBlock("<p>The studio</p>", { type_preset: "h6" }),
          heading: textBlock("<h3>Made to order.<br>Never warehoused.</h3>", { type_preset: "h3", width: "100%" }),
          print: textBlock(
            "<p>Every piece is printed in your region after you pay. Nothing is stored in a warehouse.</p>",
            { type_preset: "rte", width: "100%", max_width: "normal" },
          ),
          price: textBlock(
            "<p>Choose your country in the header. Catalog prices show in that currency.</p>",
            { type_preset: "rte", width: "100%", max_width: "normal" },
          ),
          returns: textBlock(
            "<p>Change of mind cannot be returned. If a print arrives damaged, we reprint it.</p>",
            { type_preset: "rte", width: "100%", max_width: "normal" },
          ),
          button: {
            type: "button",
            settings: {
              label: "Read returns and refunds",
              link: "shopify://policies/refund-policy",
              style_class: "button",
              width: "fit-content",
            },
          },
        },
        block_order: ["caption", "heading", "print", "price", "returns", "button"],
      },
    },
    block_order: ["image", "copy"],
    settings: {
      content_direction: "row",
      vertical_on_mobile: true,
      horizontal_alignment: "space-between",
      vertical_alignment: "center",
      gap: 40,
      section_width: "page-width",
      background_media: "none",
      background_color: PALETTE.background,
      "padding-block-start": 48,
      "padding-block-end": 56,
    },
  };

  const heroId = Object.entries(template.sections).find(([, section]) => section.type === "hero")?.[0] || "hero_jVaWmY";
  const productsId =
    Object.entries(template.sections).find(([, section]) => section.type === "product-list")?.[0] ||
    "product_list_fa6P9H";
  template.order = [heroId, "marquee_fernora", "collections_fernora", productsId, "story_fernora"];

  const indexErrors = await upsertThemeText(themeId, "templates/index.json", JSON.stringify(template, null, 2));
  notes.push(
    indexErrors.length
      ? `Homepage: ${indexErrors.join("; ")}`
      : "Homepage uses the Fernora hero, series grid, and studio story.",
  );

  const settingsRaw = await themeFileText(themeId, "config/settings_data.json");
  const settingsStart = settingsRaw.indexOf("{");
  if (settingsStart >= 0) {
    const settings = JSON.parse(settingsRaw.slice(settingsStart)) as {
      current?: Record<string, unknown> & { color_palette?: Record<string, string> };
    };
    if (settings.current) {
      settings.current.page_width = "normal";
      settings.current.card_hover_effect = "lift";
      settings.current.color_palette = PALETTE;
    }
    const settingErrors = await upsertThemeText(themeId, "config/settings_data.json", JSON.stringify(settings, null, 2));
    notes.push(settingErrors.length ? `Palette: ${settingErrors.join("; ")}` : "Theme palette is linen, fern, and kōwhai.");
  }

  const headerRaw = await themeFileText(themeId, "sections/header-group.json");
  const headerStart = headerRaw.indexOf("{");
  if (headerStart >= 0) {
    const header = JSON.parse(headerRaw.slice(headerStart)) as { sections?: Record<string, ThemeSection> };
    for (const section of Object.values(header.sections || {})) {
      if (section.type === "header-announcements") {
        if (section.settings) {
          section.settings.background_color = PALETTE.color1;
        }
        for (const block of Object.values(section.blocks || {})) {
          if (block.settings && "text" in block.settings) {
            block.settings.text = "Quality guarantee · Prices in your local currency";
          }
        }
      }
      if (section.type === "header" && section.settings) {
        section.settings.show_country = true;
        section.settings.country_selector_style = true;
        section.settings.show_language = false;
      }
      if (section.blocks) {
        for (const block of Object.values(section.blocks)) {
          if (block.type === "_header-menu" && block.settings) {
            block.settings.menu_style = "text";
            block.settings.drawer_accordion = true;
          }
        }
      }
    }
    const headerErrors = await upsertThemeText(themeId, "sections/header-group.json", JSON.stringify(header, null, 2));
    notes.push(headerErrors.length ? `Announcement: ${headerErrors.join("; ")}` : "Announcement, country flag, and Catalog text dropdown enabled.");
  }

  notes.push(...(await patchCollectionTemplate(themeId)));
  notes.push(...(await patchProductTemplate(themeId)));
  notes.push(...(await patchFooterCopy(themeId)));
  return notes;
}

async function patchCollectionTemplate(themeId: string) {
  const notes: string[] = [];
  const raw = await themeFileText(themeId, "templates/collection.json");
  const start = raw.indexOf("{");
  if (start < 0) {
    notes.push("Collection template could not be read.");
    return notes;
  }
  const template = JSON.parse(raw.slice(start)) as { sections?: Record<string, ThemeSection> };
  const heading = template.sections?.section;
  if (heading?.settings) heading.settings.section_width = "page-width";
  const main = template.sections?.main;
  if (main?.settings) {
    main.settings.product_grid_width = "full-width";
    main.settings.full_width_on_mobile = true;
  }
  const filters = main?.blocks?.filters;
  if (filters?.settings) {
    filters.settings.filter_style = "horizontal";
    filters.settings.filter_width = "full-width";
  }
  const errors = await upsertThemeText(themeId, "templates/collection.json", JSON.stringify(template, null, 2));
  notes.push(errors.length ? `Catalog grid: ${errors.join("; ")}` : "Catalog product grid uses the full page width.");
  return notes;
}

async function patchProductTemplate(themeId: string) {
  const notes: string[] = [];
  const raw = await themeFileText(themeId, "templates/product.json");
  const start = raw.indexOf("{");
  if (start < 0) {
    notes.push("Product template could not be read.");
    return notes;
  }
  const template = JSON.parse(raw.slice(start)) as { sections?: Record<string, ThemeSection> };
  const main = template.sections?.main;
  if (main?.settings) {
    main.settings.limit_details_width = true;
    main.settings["padding-block-start"] = 40;
    main.settings["padding-block-end"] = 40;
  }
  const details = main?.blocks?.["product-details"];
  if (details?.settings) {
    details.settings.sticky_details_desktop = false;
    details.settings.width = "fill";
    details.settings["padding-inline-start"] = 8;
  }
  const gallery = main?.blocks?.["media-gallery"];
  if (gallery?.settings) {
    gallery.settings.media_presentation = "grid";
    gallery.settings.thumbnail_position = "below";
    gallery.settings.large_first_image = true;
    gallery.settings.extend_media = false;
    gallery.settings.constrain_to_viewport = true;
    gallery.settings.zoom = true;
    gallery.settings.image_zoom = true;
  }
  const errors = await upsertThemeText(themeId, "templates/product.json", JSON.stringify(template, null, 2));
  notes.push(
    errors.length
      ? `Product page: ${errors.join("; ")}`
      : "Product page keeps title, sizes, and mockups in the column instead of sliding left under the header.",
  );
  return notes;
}

async function patchMainCatalogMenu() {
  const notes: string[] = [];
  const data = await shopifyGraphql<{
    menus: { nodes: Array<{ id: string; handle: string }> };
    collections: { nodes: Array<{ id: string; handle: string }> };
    pages: { nodes: Array<{ id: string; handle: string }> };
  }>(
    `{
      menus(first: 10) { nodes { id handle } }
      collections(first: 30) { nodes { id handle } }
      pages(first: 50) { nodes { id handle } }
    }`,
  );
  const menu = data.menus.nodes.find((row) => row.handle === "main-menu");
  if (!menu) {
    notes.push("Main menu was not found.");
    return notes;
  }
  const collections = new Map(data.collections.nodes.map((row) => [row.handle, row.id]));
  const contact = data.pages.nodes.find((row) => row.handle === "contact")?.id;
  const catalogItems = CATALOG_MENU.map((item) => {
    if (item.id === "all") return { title: item.label, type: "CATALOG" };
    const resourceId = collections.get(item.handle);
    return resourceId ? { title: item.label, type: "COLLECTION", resourceId } : undefined;
  }).filter(Boolean) as Array<{ title: string; type: string; resourceId?: string }>;
  const items: Array<{ title: string; type: string; resourceId?: string; items?: typeof catalogItems }> = [
    { title: "Home", type: "FRONTPAGE" },
    { title: "Catalog", type: "CATALOG", items: catalogItems },
  ];
  if (contact) items.push({ title: "Contact", type: "PAGE", resourceId: contact });
  const updated = await shopifyGraphql<{
    menuUpdate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, items: $items) { userErrors { field message } }
    }`,
    { id: menu.id, title: "Main menu", items },
  );
  if (updated.menuUpdate.userErrors.length) {
    notes.push(`Catalog menu: ${updated.menuUpdate.userErrors.map((row) => row.message).join("; ")}`);
  } else {
    notes.push("Catalog is a dropdown of All, Quotes, Botanical, Scenic, Home décor, and Original fern.");
  }
  return notes;
}

async function ensureSeriesCollections() {
  const notes: string[] = [];
  const listed = await shopifyGraphql<{
    collections: { nodes: Array<{ id: string; handle: string }> };
  }>(`{ collections(first: 30) { nodes { id handle } } }`);
  const existing = new Map(listed.collections.nodes.map((row) => [row.handle, row.id]));
  for (const series of SERIES_COLLECTIONS) {
    if (existing.has(series.handle)) continue;
    const created = await shopifyGraphql<{
      collectionCreate: {
        collection?: { id: string; handle?: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation ($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { id handle }
          userErrors { field message }
        }
      }`,
      { input: { title: series.title, handle: series.handle } },
    );
    if (created.collectionCreate.userErrors.length) {
      notes.push(
        `${series.title}: ${created.collectionCreate.userErrors.map((row) => row.message).join("; ")}`,
      );
      continue;
    }
    notes.push(`Created collection ${series.title}.`);
  }
  return notes;
}

export async function syncShopifyCatalogMenu() {
  const notes = await ensureSeriesCollections();
  notes.push(...(await patchMainCatalogMenu()));
  return notes;
}

async function patchFooterCopy(themeId: string) {
  const notes: string[] = [];
  const raw = await themeFileText(themeId, "sections/footer-group.json");
  const start = raw.indexOf("{");
  if (start < 0) return notes;
  const footer = JSON.parse(raw.slice(start)) as { sections?: Record<string, ThemeSection> };
  for (const section of Object.values(footer.sections || {})) {
    for (const block of Object.values(section.blocks || {})) {
      for (const nested of Object.values(block.blocks || {})) {
        if (nested.type === "text" && nested.settings?.text) {
          const current = String(nested.settings.text);
          if (current.includes("email list") || current.includes("Join our")) {
            nested.settings.text = "<h2>Studio notes</h2>";
          }
          if (current.includes("exclusive deals") || current.includes("early access")) {
            nested.settings.text =
              "<p>New collections and print drops, sent rarely. No warehouse remainder — every piece is printed after you order.</p>";
          }
        }
      }
    }
  }
  const errors = await upsertThemeText(themeId, "sections/footer-group.json", JSON.stringify(footer, null, 2));
  notes.push(errors.length ? `Footer: ${errors.join("; ")}` : "Footer copy is professional.");
  return notes;
}

export async function publishGelatoLegalPages() {
  const notes: string[] = [];
  const pages: Array<{ handle: string; title: string; body: string }> = [
    { handle: "privacy", title: "Privacy", body: policyHtml("privacy") },
    { handle: "data-deletion", title: "User data deletion", body: policyHtml("dataDeletion") },
    { handle: "returns", title: "Returns & refunds", body: policyHtml("returns") },
    { handle: "shipping", title: "Shipping", body: policyHtml("shipping") },
  ];
  const existing = await shopifyGraphql<{
    pages: { nodes: Array<{ id: string; handle: string }> };
  }>(`{ pages(first: 50) { nodes { id handle } } }`);
  const byHandle = new Map(existing.pages.nodes.map((row) => [row.handle, row.id]));
  const ids: Record<string, string> = {};
  for (const page of pages) {
    const already = byHandle.get(page.handle);
    if (already) {
      const updated = await shopifyGraphql<{
        pageUpdate: { userErrors: Array<{ message: string }>; page?: { id: string } };
      }>(
        `mutation ($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) { page { id handle } userErrors { field message } }
        }`,
        { id: already, page: { title: page.title, body: page.body, isPublished: true } },
      );
      if (updated.pageUpdate.userErrors.length) {
        notes.push(`${page.handle}: ${updated.pageUpdate.userErrors.map((row) => row.message).join("; ")}`);
      } else {
        ids[page.handle] = already;
      }
      continue;
    }
    const created = await shopifyGraphql<{
      pageCreate: { userErrors: Array<{ message: string }>; page?: { id: string; handle: string } };
    }>(
      `mutation ($page: PageCreateInput!) {
        pageCreate(page: $page) { page { id handle } userErrors { field message } }
      }`,
      { page: { handle: page.handle, title: page.title, body: page.body, isPublished: true } },
    );
    if (created.pageCreate.userErrors.length) {
      notes.push(`${page.handle}: ${created.pageCreate.userErrors.map((row) => row.message).join("; ")}`);
    } else if (created.pageCreate.page?.id) {
      ids[page.handle] = created.pageCreate.page.id;
    }
  }
  const contact = byHandle.get("contact");
  if (contact) {
    await shopifyGraphql(
      `mutation ($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) { userErrors { field message } }
      }`,
      { id: contact, page: { title: "Contact", body: policyHtml("contact"), isPublished: true } },
    );
  }
  const privacyChoices = byHandle.get("data-sharing-opt-out");
  const menuItems: Array<{ title: string; type: string; resourceId?: string }> = [
    { title: "Search", type: "SEARCH" },
    ...(ids.privacy ? [{ title: "Privacy", type: "PAGE", resourceId: ids.privacy }] : []),
    ...(ids["data-deletion"]
      ? [{ title: "Data deletion", type: "PAGE", resourceId: ids["data-deletion"] }]
      : []),
    ...(ids.returns ? [{ title: "Returns & refunds", type: "PAGE", resourceId: ids.returns }] : []),
    ...(ids.shipping ? [{ title: "Shipping", type: "PAGE", resourceId: ids.shipping }] : []),
    ...(contact ? [{ title: "Contact", type: "PAGE", resourceId: contact }] : []),
    ...(privacyChoices ? [{ title: "Your privacy choices", type: "PAGE", resourceId: privacyChoices }] : []),
  ];
  const updatedMenu = await shopifyGraphql<{
    menuUpdate: { userErrors: Array<{ message: string }> };
  }>(
    `mutation ($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, items: $items) { userErrors { field message } }
    }`,
    {
      id: "gid://shopify/Menu/318154211624",
      title: "Footer",
      items: menuItems,
    },
  );
  if (updatedMenu.menuUpdate.userErrors.length) {
    notes.push(`Footer menu: ${updatedMenu.menuUpdate.userErrors.map((row) => row.message).join("; ")}`);
  } else {
    notes.push("Footer menu links to privacy, returns, and shipping pages.");
  }
  return notes;
}
