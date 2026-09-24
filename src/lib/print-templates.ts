import { CLOTHING_COLOR_LINE, CLOTHING_COLORS, ZIP_HOODIE_COLOR_IMAGE } from "./clothing.ts";
import { CATALOG_ART_PAIRS, isEmbroideryListing, printTemplateLabel } from "./print-file.ts";
import { FERNORA_PRINTIFY_STARTERS } from "./printify-products.ts";

export function printTemplateDesk() {
  return CATALOG_ART_PAIRS.map((row) => {
    const spec = FERNORA_PRINTIFY_STARTERS.find((item) => item.key === row.key);
    return {
      id: row.key,
      title: spec?.title || row.key,
      print: row.print,
      mockup: row.mockup,
      fileName: spec?.printFile || row.print.split("/").pop() || "",
      label: printTemplateLabel(isEmbroideryListing(spec?.key) ? (spec?.key === "live_tee_bloom" ? "tee" : "hoodie") : "poster", row.key),
    };
  });
}

export function apparelColorDesk() {
  return {
    line: CLOTHING_COLOR_LINE,
    colors: CLOTHING_COLORS.map((color) => ({
      ...color,
      imageUrl: ZIP_HOODIE_COLOR_IMAGE[color.uid],
    })),
  };
}
