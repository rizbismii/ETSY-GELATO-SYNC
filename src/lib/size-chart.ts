import { SNEAKER_WHITE_SOLE, SNEAKER_WOMENS_WHITE_SOLE } from "./sneaker-sizes.ts";

export type SizeChart = {
  label: string;
  columns: string[];
  rows: Array<{ label: string; values: string[] }>;
  note: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Gildan 18000 crewneck, laid flat. Matches the chart already printed on the sweatshirt. */
const CREWNECK: SizeChart = {
  label: "Size chart",
  columns: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
  rows: [
    { label: "Width, in", values: ["20.00", "22.01", "24.00", "26.00", "28.00", "30.00", "32.00"] },
    { label: "Length, in", values: ["27.00", "28.00", "29.00", "30.00", "31.00", "32.00", "33.00"] },
    {
      label: "Sleeve length (from center back), in",
      values: ["33.50", "34.50", "35.50", "36.50", "37.50", "38.50", "39.50"],
    },
    { label: "Size tolerance, in", values: ["1.50", "1.50", "1.50", "1.50", "1.50", "1.50", "1.50"] },
  ],
  note: "Lay the garment flat. Width is across the chest. Sleeve is measured from the center of the back.",
};

/** Gildan 5000 heavy cotton tee. Chest width and body length from the Gildan finished-measurement sheet. */
const TEE: SizeChart = {
  label: "Size chart",
  columns: ["S", "M", "L", "XL", "2XL"],
  rows: [
    { label: "Width, in", values: ["18", "20", "22", "24", "26"] },
    { label: "Length, in", values: ["28", "29", "30", "31", "32"] },
    { label: "Tolerance, in", values: ["1", "1", "1", "1", "1"] },
  ],
  note: "Gildan 5000, laid flat. Width is across the chest. A finished shirt can vary by about 1 in.",
};

/** Gildan 18600 full-zip hoodie finished measurements, sizes we sell. */
const ZIP_HOODIE: SizeChart = {
  label: "Size chart",
  columns: ["S", "M", "L", "XL", "2XL"],
  rows: [
    { label: "Width, in", values: ["19.25", "21.25", "23.25", "25.25", "27.25"] },
    { label: "Length, in", values: ["26", "27", "28", "29", "30"] },
    { label: "Tolerance, in", values: ["1", "1", "1", "1", "1"] },
  ],
  note: "Gildan 18600, laid flat. Width is across the chest. A finished hoodie can vary by about 1 in.",
};

function shoeChart(sizes: string[], note: string): SizeChart {
  return {
    label: "Size chart",
    columns: ["Fit"],
    rows: sizes.map((size) => ({ label: size, values: ["White sole"] })),
    note,
  };
}

const MENS_SNEAKER = shoeChart(
  SNEAKER_WHITE_SOLE.map((row) => row.size),
  "Men’s mesh sneaker. Order the US size you already wear in a mesh sneaker.",
);

const WOMENS_SNEAKER = shoeChart(
  SNEAKER_WOMENS_WHITE_SOLE.map((row) => row.size),
  "Women’s mesh sneaker. Order the US size you already wear.",
);

function sheet(label: string, width: string, height: string, note: string): SizeChart {
  return {
    label: "Size chart",
    columns: ["This piece"],
    rows: [
      { label: "Width", values: [width] },
      { label: "Height", values: [height] },
    ],
    note,
  };
}

const A3 = sheet("Size chart", "11.7 in (297 mm)", "16.5 in (420 mm)", "A3 paper, unframed. The print is the sheet size.");
const PRINT_18_24 = sheet("Size chart", "18 in", "24 in", "The print area is 18 × 24 in.");
const CANVAS_12 = sheet("Size chart", "12 in", "12 in", "The canvas face is 12 × 12 in.");
const FRAME_12_16 = sheet("Size chart", "12 in", "16 in", "The print inside the frame is 12 × 16 in.");

export function sizeChartFor(hint: { id?: string; title?: string; category?: string; description?: string }) {
  const blob = `${hint.id || ""} ${hint.title || ""} ${hint.category || ""} ${hint.description || ""}`.toLowerCase();
  if (/18600|zip hoodie|full-zip|full zip/.test(blob) || hint.category === "hoodie") return ZIP_HOODIE;
  if (/18000|crewneck|sweatshirt/.test(blob)) return CREWNECK;
  if (/5000|heavy cotton|\btee\b|t-shirt|t shirt/.test(blob) || hint.category === "tee") return TEE;
  if (/sneaker/.test(blob) || hint.category === "sneakers") {
    return /women|women’s|womens/.test(blob) ? WOMENS_SNEAKER : MENS_SNEAKER;
  }
  if (/18\s*[×x]\s*24|kowhai/.test(blob)) return PRINT_18_24;
  if (/12\s*[×x]\s*12|canvas/.test(blob) || hint.category === "canvas") return CANVAS_12;
  if (/12\s*[×x]\s*16|oak frame|frame/.test(blob) || hint.category === "frame") return FRAME_12_16;
  if (/a3|poster/.test(blob) || hint.category === "poster") return A3;
  return null;
}

export function sizeChartMarkup(chart: SizeChart) {
  const head = chart.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = chart.rows
    .map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.label)}</th>${row.values
          .map((value) => `<td>${escapeHtml(value)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<details class="fernora-size-chart"><summary>Size chart</summary><div style="overflow-x:auto"><table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div><p>${escapeHtml(chart.note)}</p></details>`;
}

function wrapTable(table: string) {
  return `<details class="fernora-size-chart"><summary>Size chart</summary><div style="overflow-x:auto">${table}</div></details>`;
}

/** Collapse a Printify size table into a dropdown, or add the chart for this product. */
export function withSizeChart(
  html: string,
  hint: { id?: string; title?: string; category?: string; description?: string } = {},
) {
  if (/class=["']fernora-size-chart["']/.test(html)) return html;
  const existing = html.match(/<table[^>]*(?:id=["']size-guide["']|class=["'][^"']*size)[^>]*>[\s\S]*?<\/table>/i);
  const measurement = html.match(/<table[\s\S]*?(?:Width, in|Chest Width)[\s\S]*?<\/table>/i);
  const table = existing?.[0] || measurement?.[0];
  if (table) return html.replace(table, wrapTable(table));
  const chart = sizeChartFor(hint);
  if (!chart) return html;
  return `${html}${sizeChartMarkup(chart)}`;
}

const SIZE_CHART_THEME_START = "{%- comment -%} fernora-size-chart {%- endcomment -%}";
const SIZE_CHART_THEME_END = "{%- comment -%} /fernora-size-chart {%- endcomment -%}";

type StorefrontRule = { test: string; html: string; women?: boolean };

function storefrontRules(): StorefrontRule[] {
  return [
    { test: "18600|zip hoodie|full-zip|full zip|\\bhoodie\\b", html: sizeChartMarkup(ZIP_HOODIE) },
    { test: "18000|crewneck|sweatshirt", html: sizeChartMarkup(CREWNECK) },
    { test: "5000|heavy cotton|\\btee\\b|t-shirt|t shirt", html: sizeChartMarkup(TEE) },
    { test: "sneaker", women: true, html: sizeChartMarkup(WOMENS_SNEAKER) },
    { test: "sneaker", html: sizeChartMarkup(MENS_SNEAKER) },
    { test: "18\\s*[×x]\\s*24|kowhai", html: sizeChartMarkup(PRINT_18_24) },
    { test: "12\\s*[×x]\\s*12|canvas", html: sizeChartMarkup(CANVAS_12) },
    { test: "12\\s*[×x]\\s*16|oak frame|\\bframe\\b", html: sizeChartMarkup(FRAME_12_16) },
    { test: "\\ba3\\b|poster", html: sizeChartMarkup(A3) },
  ];
}

/** Same chart the fernora.nz product script inserts, chosen from the title and description. */
export function storefrontChartFor(text: string) {
  const lower = text.toLowerCase();
  for (const rule of storefrontRules()) {
    if (rule.women && !/women/.test(lower)) continue;
    if (new RegExp(rule.test, "i").test(lower)) return rule.html;
  }
  return "";
}

export function sizeChartThemeBlock() {
  const rules = JSON.stringify(storefrontRules());
  return `${SIZE_CHART_THEME_START}
<style>
  details.fernora-size-chart { margin: 0.75rem 0 0; border: 1px solid rgba(28,43,36,.16); border-radius: 12px; padding: 0.7rem 0.9rem; }
  details.fernora-size-chart summary { cursor: pointer; font-weight: 600; }
  details.fernora-size-chart table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.82rem; }
  details.fernora-size-chart th, details.fernora-size-chart td { text-align: left; padding: 0.35rem 0.5rem 0.35rem 0; }
</style>
<script>
(function () {
  var rules = ${rules};
  function pick(text) {
    var lower = String(text || "").toLowerCase();
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.women && !/women/.test(lower)) continue;
      if (new RegExp(rule.test, "i").test(lower)) return rule.html;
    }
    return "";
  }
  function isMeasure(table) {
    if (table.closest && table.closest("details.fernora-size-chart")) return false;
    if (table.id === "size-guide") return true;
    return /Width,\\s*in|Chest Width/i.test(table.textContent || "");
  }
  function wrap(table) {
    var details = document.createElement("details");
    details.className = "fernora-size-chart";
    var summary = document.createElement("summary");
    summary.textContent = "Size chart";
    var scroller = document.createElement("div");
    scroller.style.overflowX = "auto";
    table.parentNode.insertBefore(details, table);
    details.appendChild(summary);
    details.appendChild(scroller);
    scroller.appendChild(table);
  }
  function run() {
    if (!/\\/products\\//.test(location.pathname)) return;
    var root = document.querySelector("product-component") || document.querySelector("[data-testid='product-information-details']");
    if (!root || root.querySelector("details.fernora-size-chart")) return;
    var tables = root.querySelectorAll("table");
    var wrapped = false;
    for (var i = 0; i < tables.length; i++) {
      if (!isMeasure(tables[i])) continue;
      wrap(tables[i]);
      wrapped = true;
    }
    if (wrapped) return;
    var rte = root.querySelector("rte-formatter");
    if (!rte) return;
    var title = ((root.querySelector("h1") || document.querySelector("h1") || {}).textContent) || "";
    var html = pick(title + " " + (rte.textContent || ""));
    if (!html) return;
    var holder = document.createElement("div");
    holder.innerHTML = html;
    if (holder.firstChild) rte.appendChild(holder.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  document.addEventListener("shopify:section:load", run);
})();
</script>
${SIZE_CHART_THEME_END}`;
}

/** Put the size-chart dropdown on every fernora.nz product page. */
export function withSizeChartInTheme(source: string) {
  const block = sizeChartThemeBlock();
  const start = source.indexOf(SIZE_CHART_THEME_START);
  const end = source.indexOf(SIZE_CHART_THEME_END);
  if (start >= 0 && end > start) {
    return `${source.slice(0, start)}${block}${source.slice(end + SIZE_CHART_THEME_END.length)}`;
  }
  if (source.includes("</body>")) return source.replace("</body>", `${block}\n</body>`);
  return `${source}\n${block}\n`;
}
