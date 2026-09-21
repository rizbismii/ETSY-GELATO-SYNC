import { listingAdsRate, recommendedPrice, TARGET_AFTER_ADS_MARGIN } from "./money.ts";

export type PrintSupplier = "printify" | "gelato";

export type CostLane = {
  region: string;
  label: string;
  country: string;
  shipping: number;
  printCost: number;
  days: string;
  printer: PrintSupplier;
};

/** Printify catalog shipping is USD. Convert to shop NZD for the cost table. */
export const PRINTIFY_USD_TO_NZD = 1.67;

/**
 * Live Printify variant.cost in shop NZD (cents / 100).
 * Fernora Trends Etsy shop 28911689, 21 September 2026.
 */
export const PRINTIFY_PRINT_NZD = {
  live_poster: 9.28,
  live_quote_breathe: 9.23,
  live_botanical_kowhai: 10.62,
  live_canvas_harbour: 19.97,
  live_frame_kind: 38.53,
  /** Catalog “from USD 37.77” × 1.67 until the live Printify variant.cost is read. */
  live_sneaker_star: 63.08,
} as const;

export type PrintifyCostKey = keyof typeof PRINTIFY_PRINT_NZD;

type PrintifyShipUsd = {
  US: number;
  AU?: number;
  CA?: number;
  ROTW: number;
};

/** Printify first-item shipping (USD) for the enabled catalog variants. */
export const PRINTIFY_SHIP_USD: Record<"poster" | "canvas" | "frame" | "sneaker", PrintifyShipUsd> = {
  poster: { US: 5.99, CA: 12.09, ROTW: 12.19 },
  canvas: { US: 8.19, AU: 18.29, CA: 15.69, ROTW: 165.39 },
  frame: { US: 12.49, CA: 49.19, ROTW: 57.19 },
  sneaker: { US: 18.69, AU: 25.69, ROTW: 25.69 },
};

/** Gelato print + ship for the UK/EU compliance lanes only. */
export const GELATO_LANE_COSTS = {
  poster: { print: { GB: 15.17, EU: 16.14 }, ship: { GB: 10.47, EU: 11.57 } },
  largePoster: { print: { GB: 19.09, EU: 19.73 }, ship: { GB: 11.38, EU: 13.9 } },
  canvas: { print: { GB: 28.07, EU: 31.1 }, ship: { GB: 9.32, EU: 15.05 } },
  frame: { print: { GB: 48.55, EU: 46.54 }, ship: { GB: 11.38, EU: 15.05 } },
} as const;

export function usdToNzd(usd: number) {
  return Math.round(usd * PRINTIFY_USD_TO_NZD * 100) / 100;
}

/**
 * NZ is not always a named Printify zone.
 * Use AU when Printify prices Oceania, otherwise REST_OF_THE_WORLD unless that rate is a penalty.
 */
export function printifyShipUsd(family: keyof typeof PRINTIFY_SHIP_USD, region: "NZ" | "AU" | "US") {
  const row = PRINTIFY_SHIP_USD[family];
  if (region === "US") return row.US;
  if (region === "AU") return row.AU ?? row.ROTW;
  if (row.AU) return row.AU;
  if (row.ROTW <= 80) return row.ROTW;
  return row.AU ?? row.US;
}

export function printifyListCents(priceNzd: number) {
  return Math.round(priceNzd * 100);
}

function gelatoFamily(key: PrintifyCostKey): keyof typeof GELATO_LANE_COSTS {
  if (key === "live_botanical_kowhai") return "largePoster";
  if (key === "live_canvas_harbour") return "canvas";
  if (key === "live_frame_kind") return "frame";
  return "poster";
}

function printifyFamily(key: PrintifyCostKey): keyof typeof PRINTIFY_SHIP_USD {
  if (key === "live_canvas_harbour") return "canvas";
  if (key === "live_frame_kind") return "frame";
  if (key === "live_sneaker_star") return "sneaker";
  return "poster";
}

function sneakerShipUsd(region: "NZ" | "AU" | "US" | "GB" | "EU") {
  if (region === "US") return 18.69;
  if (region === "GB") return 20.59;
  if (region === "EU") return 23.29;
  return 25.69;
}

export function catalogLanes(key: PrintifyCostKey): CostLane[] {
  const printNzd = PRINTIFY_PRINT_NZD[key];
  const family = printifyFamily(key);
  const gelato = GELATO_LANE_COSTS[gelatoFamily(key)];
  const rows: Array<{ region: "NZ" | "AU" | "US" | "GB" | "EU"; label: string; country: string }> = [
    { region: "NZ", label: "New Zealand", country: "NZ" },
    { region: "AU", label: "Australia", country: "AU" },
    { region: "US", label: "United States", country: "US" },
    { region: "GB", label: "United Kingdom", country: "GB" },
    { region: "EU", label: "European Union", country: "DE" },
  ];
  return rows.map((row) => {
    if (key === "live_sneaker_star") {
      return {
        ...row,
        printer: "printify",
        printCost: printNzd,
        shipping: usdToNzd(sneakerShipUsd(row.region)),
        days: "12–22 days",
      };
    }
    const printer: PrintSupplier = row.region === "GB" || row.region === "EU" ? "gelato" : "printify";
    if (printer === "printify") {
      return {
        ...row,
        printer,
        printCost: printNzd,
        shipping: usdToNzd(printifyShipUsd(family, row.region as "NZ" | "AU" | "US")),
        days: "6–16 days",
      };
    }
    return {
      ...row,
      printer,
      printCost: gelato.print[row.region as "GB" | "EU"],
      shipping: gelato.ship[row.region as "GB" | "EU"],
      days: "4–12 days",
    };
  });
}

export function catalogPrice(key: PrintifyCostKey) {
  const adsRate = listingAdsRate();
  return Math.max(
    ...catalogLanes(key).map((lane) =>
      recommendedPrice(lane.printCost, lane.shipping, TARGET_AFTER_ADS_MARGIN, adsRate),
    ),
  );
}

export function catalogUnitCost(key: PrintifyCostKey) {
  return Math.max(...catalogLanes(key).map((lane) => lane.printCost));
}
