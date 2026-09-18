/** Gelato in-region destinations Fernora sells to, grouped onto catalog rate lanes. */

export const SHIP_LANES = ["NZ", "AU", "US", "GB", "EU"] as const;
export type ShipLaneCode = (typeof SHIP_LANES)[number];

export type GelatoDestination = {
  code: string;
  name: string;
  lane: ShipLaneCode;
  group: "Oceania" | "Americas" | "Europe" | "United Kingdom" | "Asia & Middle East" | "Africa";
};

const row = (
  code: string,
  name: string,
  lane: ShipLaneCode,
  group: GelatoDestination["group"],
): GelatoDestination => ({ code, name, lane, group });

/** Countries Gelato prints near and ships to — same set the shop country field offers. */
export const GELATO_DESTINATIONS: GelatoDestination[] = [
  row("NZ", "New Zealand", "NZ", "Oceania"),
  row("AU", "Australia", "AU", "Oceania"),

  row("US", "United States", "US", "Americas"),
  row("CA", "Canada", "US", "Americas"),
  row("MX", "Mexico", "US", "Americas"),
  row("BR", "Brazil", "US", "Americas"),
  row("AR", "Argentina", "US", "Americas"),
  row("CL", "Chile", "US", "Americas"),
  row("CO", "Colombia", "US", "Americas"),
  row("PE", "Peru", "US", "Americas"),

  row("GB", "United Kingdom", "GB", "United Kingdom"),
  row("IE", "Ireland", "GB", "United Kingdom"),

  row("AT", "Austria", "EU", "Europe"),
  row("BE", "Belgium", "EU", "Europe"),
  row("BG", "Bulgaria", "EU", "Europe"),
  row("HR", "Croatia", "EU", "Europe"),
  row("CY", "Cyprus", "EU", "Europe"),
  row("CZ", "Czechia", "EU", "Europe"),
  row("DK", "Denmark", "EU", "Europe"),
  row("EE", "Estonia", "EU", "Europe"),
  row("FI", "Finland", "EU", "Europe"),
  row("FR", "France", "EU", "Europe"),
  row("DE", "Germany", "EU", "Europe"),
  row("GR", "Greece", "EU", "Europe"),
  row("HU", "Hungary", "EU", "Europe"),
  row("IT", "Italy", "EU", "Europe"),
  row("LV", "Latvia", "EU", "Europe"),
  row("LT", "Lithuania", "EU", "Europe"),
  row("LU", "Luxembourg", "EU", "Europe"),
  row("MT", "Malta", "EU", "Europe"),
  row("NL", "Netherlands", "EU", "Europe"),
  row("PL", "Poland", "EU", "Europe"),
  row("PT", "Portugal", "EU", "Europe"),
  row("RO", "Romania", "EU", "Europe"),
  row("SK", "Slovakia", "EU", "Europe"),
  row("SI", "Slovenia", "EU", "Europe"),
  row("ES", "Spain", "EU", "Europe"),
  row("SE", "Sweden", "EU", "Europe"),
  row("CH", "Switzerland", "EU", "Europe"),
  row("NO", "Norway", "EU", "Europe"),
  row("IS", "Iceland", "EU", "Europe"),
  row("LI", "Liechtenstein", "EU", "Europe"),

  row("JP", "Japan", "US", "Asia & Middle East"),
  row("SG", "Singapore", "US", "Asia & Middle East"),
  row("HK", "Hong Kong", "US", "Asia & Middle East"),
  row("KR", "South Korea", "US", "Asia & Middle East"),
  row("MY", "Malaysia", "US", "Asia & Middle East"),
  row("TH", "Thailand", "US", "Asia & Middle East"),
  row("PH", "Philippines", "US", "Asia & Middle East"),
  row("IN", "India", "US", "Asia & Middle East"),
  row("ID", "Indonesia", "US", "Asia & Middle East"),
  row("VN", "Vietnam", "US", "Asia & Middle East"),
  row("AE", "United Arab Emirates", "US", "Asia & Middle East"),
  row("IL", "Israel", "US", "Asia & Middle East"),
  row("ZA", "South Africa", "US", "Africa"),
];

const BY_CODE = new Map(GELATO_DESTINATIONS.map((row) => [row.code, row]));

export const GELATO_COUNTRY_CODES = GELATO_DESTINATIONS.map((row) => row.code);

export function gelatoDestination(code: string | undefined | null) {
  if (!code) return undefined;
  const normalized = code.trim().toUpperCase();
  if (normalized === "AUS") return BY_CODE.get("AU");
  if (normalized === "NZL") return BY_CODE.get("NZ");
  if (normalized === "GBR" || normalized === "UK") return BY_CODE.get("GB");
  if (normalized === "USA") return BY_CODE.get("US");
  if (normalized === "EU") return BY_CODE.get("DE");
  return BY_CODE.get(normalized);
}

export function isGelatoCountry(code: string | undefined | null): boolean {
  return Boolean(gelatoDestination(code));
}

export function shipLaneForCountry(code: string | undefined | null): ShipLaneCode | undefined {
  return gelatoDestination(code)?.lane;
}

export function gelatoCountryName(code: string | undefined | null) {
  return gelatoDestination(code)?.name || code || "";
}

export function gelatoCountriesByGroup() {
  const groups: Array<{ group: GelatoDestination["group"]; countries: GelatoDestination[] }> = [];
  for (const country of GELATO_DESTINATIONS) {
    const last = groups[groups.length - 1];
    if (last?.group === country.group) last.countries.push(country);
    else groups.push({ group: country.group, countries: [country] });
  }
  return groups;
}

export function gelatoCodesForLane(lane: ShipLaneCode) {
  return GELATO_DESTINATIONS.filter((row) => row.lane === lane).map((row) => row.code);
}

export const GELATO_SHIP_BLURB =
  "Ships to New Zealand, Australia, the United States, the United Kingdom, the European Union and other countries Gelato delivers to. Printed near the buyer by Gelato. Checkout shipping is the destination rate — Wellington 6012 is the studio address, not the parcel origin.";
