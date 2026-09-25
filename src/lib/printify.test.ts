import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  formatPrintifySafetyInformation,
  pickPrintifyShop,
  printifyConnectionHeadline,
  printifyGpsrHeadline,
  printifyGpsrIsUnavailable,
  printifyGpsrModeFromProbe,
  printifyGpsrNotes,
  printifyIsFullyConnected,
  printifyShopLine,
  safetyInformationNeedsGpsr,
} from "./printify-gpsr.ts";
import {
  buildPrintifyProductPayload,
  existingPrintifyProductId,
  FERNORA_PRINTIFY_STARTERS,
  matchPrintifyColorSizes,
  mergePrintAreaVariantIds,
  printAreasForExistingVariants,
  printifyEnabledVariantIds,
  printifyImageFileName,
} from "./printify-products.ts";
import { CLOTHING_COLORS, TEE_COLORS, defaultClothingVariant, teeVariants, zipHoodieVariants } from "./clothing.ts";
import { apparelColorDesk, printTemplateDesk } from "./print-templates.ts";

test("Printify GPSR blocks flatten into safety_information", () => {
  const text = formatPrintifySafetyInformation([
    { title: "GPSR information", text: "Affiliate, eu@example.com, 1 Rue, Paris, 75001, FR" },
    { title: "Care instructions", text: "Machine wash warm" },
  ]);
  assert.match(text, /GPSR information:/);
  assert.match(text, /Care instructions: Machine wash warm/);
  assert.doesNotMatch(text, /Gelato/);
});

test("empty GPSR text needs a stamp; existing GPSR does not", () => {
  assert.equal(safetyInformationNeedsGpsr(""), true);
  assert.equal(safetyInformationNeedsGpsr("GPSR information: already set"), false);
  assert.equal(safetyInformationNeedsGpsr("Just a description"), true);
});

test("Fernora-titled Printify shop is preferred", () => {
  const shop = pickPrintifyShop([
    { id: 1, title: "My new store" },
    { id: 2, title: "Fernora" },
  ]);
  assert.equal(shop?.id, 2);
});

test("GPSR 404 is treated as Non-EU, not a per-product failure", () => {
  assert.equal(printifyGpsrIsUnavailable("Not found"), true);
  assert.equal(printifyGpsrIsUnavailable("Printify API 404"), false);
  assert.equal(
    printifyGpsrModeFromProbe({
      shopId: 28911657,
      productCount: 5,
      updated: 0,
      gpsrUnavailable: true,
    }),
    "non-eu",
  );
  const notes = printifyGpsrNotes("non-eu", 5, 0);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /Printify is the main print supplier except/);
  assert.match(notes[0], /United Kingdom and the European Union/);
  assert.match(notes[0], /will not accept Wellington 6012/);
  assert.doesNotMatch(notes[0], /default affiliate/);
  assert.doesNotMatch(notes[0], /cannot replace Gelato as the live print platform/);
  assert.equal(printifyGpsrHeadline("non-eu"), "Non-EU hold · Printify is main except EU/UK");
});

test("Fernora Trends Etsy shop is preferred over the disconnected store", () => {
  const shop = pickPrintifyShop([
    { id: 28911657, title: "Fernora Trends", sales_channel: "disconnected" },
    { id: 28911689, title: "Fernora Trends", sales_channel: "etsy" },
  ]);
  assert.equal(shop?.id, 28911689);
});

test("Printify is fully connected only with products on a sales channel", () => {
  const placeholder = [
    { id: 28911657, title: "Fernora", salesChannel: "disconnected", productCount: 5 },
    { id: 28911689, title: "My Etsy Store", salesChannel: "etsy", productCount: 0 },
  ];
  assert.equal(printifyIsFullyConnected(placeholder), false);
  assert.match(
    printifyConnectionHeadline({
      shops: placeholder,
      fullyConnected: false,
      gpsrStatus: "non-eu",
      etsyShopName: "FERNORATRENDS",
    }),
    /Printify does not show FERNORATRENDS/,
  );
  assert.equal(
    printifyShopLine(placeholder[1], "FERNORATRENDS"),
    "My Etsy Store · 28911689 · Etsy channel · 0 products · not FERNORATRENDS",
  );

  const connected = [
    { id: 28911657, title: "Fernora Trends", salesChannel: "disconnected", productCount: 5 },
    { id: 28911689, title: "Fernora Trends", salesChannel: "etsy", productCount: 0 },
  ];
  assert.match(
    printifyConnectionHeadline({
      shops: connected,
      fullyConnected: false,
      gpsrStatus: "non-eu",
      etsyShopName: "FERNORATRENDS",
    }),
    /Etsy connected as Fernora Trends/,
  );
  assert.match(printifyShopLine(connected[1], "FERNORATRENDS"), /Etsy connected/);
  assert.match(printifyShopLine(connected[1], "FERNORATRENDS"), /open this store in Printify My products/);
  assert.match(printifyShopLine(connected[0], "FERNORATRENDS"), /leftover store, not the catalog/);
  assert.doesNotMatch(printifyShopLine(connected[1], "FERNORATRENDS"), /not FERNORATRENDS/);
  assert.equal(printifyIsFullyConnected([{ id: 1, title: "Etsy", salesChannel: "etsy", productCount: 2 }]), true);
});

test("EU GPSR probe without stamps is available; stamps mark applied", () => {
  assert.equal(
    printifyGpsrModeFromProbe({ shopId: 1, productCount: 3, updated: 2, gpsrUnavailable: false }),
    "stamped",
  );
  assert.equal(
    printifyGpsrModeFromProbe({
      shopId: 1,
      productCount: 3,
      updated: 0,
      gpsrUnavailable: false,
      alreadyStamped: 3,
    }),
    "stamped",
  );
  assert.equal(
    printifyGpsrModeFromProbe({ shopId: 1, productCount: 3, updated: 0, gpsrUnavailable: false }),
    "available",
  );
  assert.equal(printifyGpsrModeFromProbe({ productCount: 0, updated: 0, gpsrUnavailable: false }), "no-shop");
  assert.equal(
    printifyGpsrModeFromProbe({ shopId: 1, productCount: 0, updated: 0, gpsrUnavailable: false }),
    "empty",
  );
});

test("Fernora Printify catalog is nine products including the embroidered zip hoodie and tee", () => {
  assert.equal(FERNORA_PRINTIFY_STARTERS.length, 9);
  const keys = FERNORA_PRINTIFY_STARTERS.map((row) => row.key);
  assert.equal(new Set(keys).size, 9);
  assert.deepEqual(keys, [
    "live_poster",
    "live_quote_breathe",
    "live_botanical_kowhai",
    "live_canvas_harbour",
    "live_frame_kind",
    "live_sneaker_star",
    "live_sneaker_star_w",
    "live_hoodie_bloom",
    "live_tee_bloom",
  ]);
  const catalog = readFileSync(new URL("./live-catalog.ts", import.meta.url), "utf8");
  const liveIds = [...catalog.matchAll(/^\s+id: "(live_[^"]+)"/gm)].map((row) => row[1]);
  assert.deepEqual([...keys].sort(), [...new Set(liveIds)].sort());
  for (const spec of FERNORA_PRINTIFY_STARTERS) {
    const enabled = spec.variants.filter((row) => row.is_enabled);
    if (spec.key.startsWith("live_sneaker_")) {
      assert.equal(enabled.length, 9);
      assert.equal(spec.printProviderId, 90);
      assert.deepEqual(spec.positions, ["left_shoe", "right_shoe"]);
      assert.equal(spec.blueprintId, spec.key === "live_sneaker_star_w" ? 1219 : 1072);
    } else if (spec.key === "live_hoodie_bloom") {
      assert.equal(enabled.length, CLOTHING_COLORS.length * 5);
      assert.equal(enabled.filter((row) => row.id).length, CLOTHING_COLORS.length * 5);
      assert.equal(spec.printProviderId, 217);
      assert.deepEqual(spec.positions, ["front_left_chest"]);
      assert.equal(spec.blueprintId, 66);
      assert.match(spec.description, /beneath the leaf/);
      assert.match(spec.description, /White, Ash, Black/);
      assert.match(spec.description, /Dark Heather Grey/);
    } else if (spec.key === "live_tee_bloom") {
      assert.equal(enabled.length, TEE_COLORS.length * 5);
      assert.equal(enabled.filter((row) => row.id).length, TEE_COLORS.length * 5);
      assert.equal(spec.printProviderId, 410);
      assert.deepEqual(spec.positions, ["large_center_embroidery", "neck"]);
      assert.equal(spec.blueprintId, 6);
      assert.equal(spec.printFiles?.neck, "print-tee-bloom-neck.png");
      assert.match(spec.description, /large-center/);
      assert.match(spec.description, /neck label/);
      assert.match(spec.description, /White, Ash, Black, Sport Grey, Navy/);
      assert.doesNotMatch(spec.description, /Light Pink/);
    } else {
      assert.equal(enabled.length, 1);
    }
    assert.equal(enabled.filter((row) => row.is_default).length, 1);
    assert.equal(spec.tags.length, 13);
    assert.ok(spec.printFile.startsWith("print-"));
    assert.ok(spec.mockupFile.startsWith("catalog-"));
    assert.notEqual(spec.printFile, spec.mockupFile);
  }
  const poster = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_poster");
  const breathe = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_quote_breathe");
  assert.equal(poster?.blueprintId, 282);
  assert.equal(poster?.printProviderId, 99);
  assert.deepEqual(
    poster?.variants.map((row) => row.id),
    [43138],
  );
  assert.equal(breathe?.blueprintId, 284);
  assert.equal(breathe?.printProviderId, 99);
  assert.deepEqual(
    breathe?.variants.map((row) => row.id),
    [43166],
  );
  const sneaker = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_sneaker_star");
  const sneakerPayload = buildPrintifyProductPayload(sneaker!, "img_sneaker");
  assert.equal(sneaker?.title, "Black Camo · Men’s Mesh Sneakers");
  assert.equal(sneaker?.printFile, "print-camo-sneakers.png");
  assert.deepEqual(
    sneakerPayload.print_areas[0].placeholders.map((row: { position: string }) => row.position),
    ["left_shoe", "right_shoe"],
  );
  assert.equal(sneakerPayload.print_areas[0].variant_ids.length, 9);
  assert.deepEqual(mergePrintAreaVariantIds([80915, 80917], [80914, 80915], [undefined, 80916]), [
    80915,
    80917,
    80914,
    80916,
  ]);
  const hoodie = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_hoodie_bloom")!;
  const hoodiePayload = buildPrintifyProductPayload(hoodie, "img_hoodie");
  assert.equal(hoodiePayload.variants.length, CLOTHING_COLORS.length * 5);
  assert.equal(hoodiePayload.print_areas[0].variant_ids.length, CLOTHING_COLORS.length * 5);
  const matched = matchPrintifyColorSizes(hoodie.variants, [
    { id: 31929, options: { color: "White", size: "S" } },
    { id: 31939, title: "White / M" },
    { id: 31949, options: { color: "White", size: "L" } },
    { id: 31959, options: { color: "White", size: "XL" } },
    { id: 31969, options: { color: "White", size: "2XL" } },
    { id: 41001, options: { color: "Black", size: "S" } },
    { id: 41002, options: { color: "Black", size: "M" } },
    { id: 41003, title: "Black / L" },
    { id: 41004, options: { color: "Black", size: "XL" } },
    { id: 41005, options: { color: "Black", size: "XXL" } },
    { id: 42001, options: { color: "Navy Blue", size: "S" } },
    { id: 42002, options: { color: "Navy", size: "M" } },
    { id: 42003, options: { color: "Navy", size: "L" } },
    { id: 42004, options: { color: "Navy", size: "XL" } },
    { id: 42005, title: "Navy / 2XL" },
  ]);
  assert.equal(matched.length, CLOTHING_COLORS.length * 5);
  assert.equal(matched.find((row) => row.color === "Black" && row.size === "M")?.id, 41002);
  assert.equal(matched.find((row) => row.color === "Navy" && row.size === "S")?.id, 42001);
  assert.equal(matched.find((row) => row.color === "Black" && row.size === "2XL")?.id, 41005);
  assert.equal(matched.find((row) => row.is_default)?.id, 31939);
  const shopHoodie = zipHoodieVariants("live_hoodie_bloom");
  assert.equal(shopHoodie.length, CLOTHING_COLORS.length * 5);
  assert.deepEqual(
    [...new Set(shopHoodie.map((row) => row.color))].sort(),
    CLOTHING_COLORS.map((row) => row.name).sort(),
  );
  assert.equal(defaultClothingVariant(shopHoodie)?.sku, "live_hoodie_bloom-white-m");
  assert.equal(shopHoodie.find((row) => row.colorUid === "white")?.imageUrl, "/catalog/catalog-hoodie-bloom.jpg");
  assert.equal(shopHoodie.find((row) => row.colorUid === "black")?.imageUrl, "/catalog/catalog-hoodie-bloom-black.jpg");
  assert.equal(shopHoodie.find((row) => row.colorUid === "navy")?.imageUrl, "/catalog/catalog-hoodie-bloom-navy.jpg");
  assert.equal(shopHoodie.find((row) => row.colorUid === "ash")?.imageUrl, "/catalog/catalog-hoodie-bloom-ash.jpg");
  assert.equal(shopHoodie.find((row) => row.colorUid === "light-pink")?.imageUrl, "/catalog/catalog-hoodie-bloom-light-pink.jpg");
  const tee = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_tee_bloom")!;
  const teePayload = buildPrintifyProductPayload(tee, {
    large_center_embroidery: "img_tee",
    neck: "img_neck",
  });
  assert.equal(teePayload.variants.length, TEE_COLORS.length * 5);
  assert.equal(teePayload.print_areas[0].placeholders[0].images[0].id, "img_tee");
  assert.equal(teePayload.print_areas[0].placeholders[1].images[0].id, "img_neck");
  const shopTee = teeVariants("live_tee_bloom");
  assert.equal(shopTee.length, TEE_COLORS.length * 5);
  assert.deepEqual(
    [...new Set(shopTee.map((row) => row.color))].sort(),
    TEE_COLORS.map((row) => row.name).sort(),
  );
  assert.equal(defaultClothingVariant(shopTee)?.sku, "live_tee_bloom-white-m");
  assert.equal(shopTee.find((row) => row.colorUid === "white")?.imageUrl, "/catalog/catalog-tee-bloom.jpg");
  assert.equal(shopTee.find((row) => row.colorUid === "navy")?.imageUrl, "/catalog/catalog-tee-bloom-navy.jpg");
  assert.equal(CLOTHING_COLORS.length, 8);
  assert.equal(TEE_COLORS.length, 5);
  assert.equal(printTemplateDesk().length, 9);
  assert.equal(apparelColorDesk().colors.length, 8);
  assert.match(apparelColorDesk().line, /Light Pink/);
  const womens = FERNORA_PRINTIFY_STARTERS.find((row) => row.key === "live_sneaker_star_w");
  assert.equal(womens?.title, "Southern Cross Star · Women’s Mesh Sneakers");
  assert.equal(womens?.blueprintId, 1219);
  assert.equal(womens?.variants.find((row) => row.is_default)?.id, 92346);
  const payload = buildPrintifyProductPayload(poster!, "img_poster");
  assert.equal(payload.visible, true);
  assert.equal("publish_details" in payload, false);
  assert.equal(payload.print_areas[0].placeholders[0].position, "front");
  assert.equal(payload.print_areas[0].placeholders[0].images[0].id, "img_poster");
  assert.deepEqual(payload.print_areas[0].variant_ids, [43138]);
  assert.deepEqual(printAreasForExistingVariants(poster!, "img_poster", [43138, 43139])[0].variant_ids, [
    43138,
    43139,
  ]);
  assert.equal(
    existingPrintifyProductId([{ id: "abc", title: "Fern Arc Poster" }], "Fern Arc Poster · A3 Semi-Gloss", [
      "Fern Arc Poster",
    ]),
    "abc",
  );
  assert.equal(existingPrintifyProductId([{ id: "abc", title: "Other" }], "Fern Arc Poster"), undefined);
  assert.deepEqual(printifyEnabledVariantIds({ variants: [{ id: 1, is_enabled: true }, { id: 2, is_enabled: false }] }), [
    1,
  ]);
  const printify = readFileSync(new URL("./printify.ts", import.meta.url), "utf8");
  assert.match(printify, /syncCustomerDesignPhotos/);
  assert.match(printify, /live_sneaker_star: "4579508879"/);
  assert.match(printify, /live_sneaker_star_w: "4579558164"/);
  assert.match(printify, /customerListingGallery\(key\)/);
  assert.match(printify, /deleteEtsyListingImage/);
  assert.match(printify, /ghostCamera: 92577/);
  assert.match(printify, /ghostCamera: 108337/);
  assert.doesNotMatch(printify.slice(printify.indexOf("pushOfficialPhotosToEtsy")), /\.slice\(0, 9\)/);
  const pairs = readFileSync(new URL("./print-file.ts", import.meta.url), "utf8");
  for (const spec of FERNORA_PRINTIFY_STARTERS) {
    assert.match(pairs, new RegExp(`key: "${spec.key}"[\\s\\S]*print: "/catalog/${spec.printFile}"`));
    assert.match(pairs, new RegExp(`mockup: "/catalog/${spec.mockupFile}"`));
    assert.match(catalog, new RegExp(`id: "${spec.key}"[\\s\\S]*printFileUrl: "/catalog/${spec.printFile}"`));
    assert.match(catalog, new RegExp(`id: "${spec.key}"[\\s\\S]*imageUrl: "/catalog/${spec.mockupFile}"`));
  }
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(printifyImageFileName("print-poster-fern-arc.png", jpeg), "print-poster-fern-arc.jpg");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  assert.equal(printifyImageFileName("print-tote-fern-spray.png", png), "print-tote-fern-spray.png");
});
