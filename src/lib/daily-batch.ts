/** Daily Pressroom batch. Review only: callers must not publish it. */

export const DAILY_THEMES = ["christmas", "new-year", "summer", "nature"] as const;
export type DailyTheme = (typeof DAILY_THEMES)[number];

export const DAILY_BLANKS = [
  "live_tee_bloom",
  "live_hoodie_bloom",
  "live_poster",
  "live_botanical_kowhai",
] as const;
export type DailyBlankId = (typeof DAILY_BLANKS)[number];

export const DAILY_THEME_META: Record<DailyTheme, { label: string; note: string }> = {
  christmas: {
    label: "Christmas",
    note: "New Zealand summer Christmas, pohutukawa and fern",
  },
  "new-year": {
    label: "New Year",
    note: "First light and a new frond",
  },
  summer: {
    label: "Summer",
    note: "Coast light, salt, and kowhai",
  },
  nature: {
    label: "Nature",
    note: "Bush ferns and a quiet study plate",
  },
};

export type DailyWordOption = { id: string; line: string };

export const DAILY_WORD_OPTIONS: Record<DailyTheme, readonly DailyWordOption[]> = {
  christmas: [
    { id: "pohutukawa-christmas", line: "Pohutukawa Christmas" },
    { id: "red-bells", line: "Red bells, green fern" },
    { id: "home-christmas", line: "Home at Christmas" },
  ],
  "new-year": [
    { id: "new-frond", line: "A new frond" },
    { id: "first-light", line: "First light" },
    { id: "begin-bush", line: "Begin in the bush" },
  ],
  summer: [
    { id: "long-light", line: "Long light" },
    { id: "salt-fern", line: "Salt and fern" },
    { id: "summer-coast", line: "Summer on the coast" },
  ],
  nature: [
    { id: "stay-fern", line: "Stay with the fern" },
    { id: "bush-light", line: "Bush light" },
    { id: "grow-quietly", line: "Grow quietly" },
  ],
};

/** Live Gildan 5000 neck file: Fernora wordmark, transparent ground. */
export const FERNORA_COLLAR_PRINT = {
  file: "/catalog/print-tee-bloom-neck.png",
  fileName: "print-tee-bloom-neck.png",
  label: "Fernora brand logo",
  width: 750,
  height: 750,
} as const;

export type DailyLettering =
  | { mode: "none" }
  | { mode: "words"; phrases: Partial<Record<DailyTheme, string>> };

export const DEFAULT_DAILY_LETTERING: DailyLettering = { mode: "none" };

type BlankSpec = {
  name: string;
  product: string;
  placement: string;
  size: string;
  ground: "transparent" | "cream";
  mockup: string;
};

const BLANKS: Record<DailyBlankId, BlankSpec> = {
  live_tee_bloom: {
    name: "Heavy cotton tee",
    product: "Gildan 5000",
    placement: "Large center",
    size: "3000×1800",
    ground: "transparent",
    mockup: "/catalog/catalog-tee-bloom.jpg",
  },
  live_hoodie_bloom: {
    name: "Zip hoodie",
    product: "Gildan 18600",
    placement: "Left chest",
    size: "1200×1200",
    ground: "transparent",
    mockup: "/catalog/catalog-hoodie-bloom.jpg",
  },
  live_poster: {
    name: "A3 semi-gloss poster",
    product: "A3 poster",
    placement: "Front",
    size: "A3",
    ground: "cream",
    mockup: "/catalog/catalog-poster.png",
  },
  live_botanical_kowhai: {
    name: "18×24 botanical print",
    product: "18×24 poster",
    placement: "Front",
    size: "18×24 in",
    ground: "cream",
    mockup: "/catalog/catalog-kowhai-botanical.png",
  },
};

const SUBJECTS: Record<DailyTheme, Record<DailyBlankId, { title: string; subject: string }>> = {
  christmas: {
    live_tee_bloom: {
      title: "Pohutukawa bells",
      subject:
        "A large-center spray of red pohutukawa bells and a silver fern, open and uncrowded, New Zealand summer Christmas",
    },
    live_hoodie_bloom: {
      title: "Christmas sprig",
      subject:
        "A compact left-chest sprig with one silver fern and three red pohutukawa bells, readable at chest scale",
    },
    live_poster: {
      title: "Pohutukawa branch",
      subject: "A tall vertical pohutukawa branch with red bells and fern crosiers on cream",
    },
    live_botanical_kowhai: {
      title: "Christmas study plate",
      subject: "A botanical study plate of pohutukawa bells and fern crosiers with a generous cream margin",
    },
  },
  "new-year": {
    live_tee_bloom: {
      title: "Opening frond",
      subject: "A large-center fern crozier just opening, gold-green, with space around the frond",
    },
    live_hoodie_bloom: {
      title: "New frond",
      subject: "A compact left-chest fern crozier, a single new frond, readable at chest scale",
    },
    live_poster: {
      title: "First light harbour",
      subject: "A quiet harbour horizon at dawn with one fern in the foreground",
    },
    live_botanical_kowhai: {
      title: "New growth plate",
      subject: "A botanical plate of one unfurling fern, lots of cream paper, fine veins",
    },
  },
  summer: {
    live_tee_bloom: {
      title: "Coastal fern",
      subject: "A large-center coastal fern with a wash of sea green, airy and bright",
    },
    live_hoodie_bloom: {
      title: "Summer fern",
      subject: "A compact left-chest coastal fern, readable at chest scale",
    },
    live_poster: {
      title: "Long light coast",
      subject: "Long evening light on a fern-lined New Zealand coast, calm water",
    },
    live_botanical_kowhai: {
      title: "Summer kowhai",
      subject: "A study plate of kowhai flowers and summer grasses, painterly, cream ground",
    },
  },
  nature: {
    live_tee_bloom: {
      title: "Bush fern",
      subject: "A large-center bush fern with layered fronds in deep green",
    },
    live_hoodie_bloom: {
      title: "Fern mark",
      subject: "A compact left-chest fern in sage green, readable at chest scale",
    },
    live_poster: {
      title: "Fern grove",
      subject: "Soft light through a fern grove, tall vertical composition",
    },
    live_botanical_kowhai: {
      title: "Kowhai stem",
      subject: "A painterly study of a single kowhai stem, cream ground, uncrowded",
    },
  },
};

export type DailyDesign = {
  id: string;
  theme: DailyTheme;
  themeLabel: string;
  blankId: DailyBlankId;
  blankName: string;
  product: string;
  placement: string;
  size: string;
  ground: "transparent" | "cream";
  mockup: string;
  title: string;
  subject: string;
  collar: typeof FERNORA_COLLAR_PRINT | null;
};

export type PreparedDesign = DailyDesign & {
  phrase: string | null;
  prompt: string;
  lettering: boolean;
};

export function dailyBatchDesigns(): DailyDesign[] {
  return DAILY_THEMES.flatMap((theme) =>
    DAILY_BLANKS.map((blankId) => {
      const blank = BLANKS[blankId];
      const art = SUBJECTS[theme][blankId];
      return {
        id: `${theme}-${blankId}`,
        theme,
        themeLabel: DAILY_THEME_META[theme].label,
        blankId,
        blankName: blank.name,
        product: blank.product,
        placement: blank.placement,
        size: blank.size,
        ground: blank.ground,
        mockup: blank.mockup,
        title: art.title,
        subject: art.subject,
        collar: blankId === "live_tee_bloom" ? FERNORA_COLLAR_PRINT : null,
      };
    }),
  );
}

/** A line is drawn only when Words is on and the line is one of that theme's options. */
export function phraseForTheme(theme: DailyTheme, lettering: DailyLettering = DEFAULT_DAILY_LETTERING) {
  if (lettering.mode !== "words") return null;
  const line = lettering.phrases[theme]?.trim();
  if (!line) return null;
  return DAILY_WORD_OPTIONS[theme].some((row) => row.line === line) ? line : null;
}

export function designPrompt(design: DailyDesign, phrase: string | null) {
  const surface =
    design.ground === "transparent"
      ? `Print-ready embroidery artwork on a transparent ground, ${design.placement.toLowerCase()}, ${design.size}.`
      : `Print-ready full-bleed artwork on a cream ground, ${design.size}.`;
  const collar =
    design.collar
      ? "Leave the Fernora wordmark off this front file. The collar print carries the brand logo."
      : "";
  const lettering = phrase
    ? `Include this line once, sharp and readable: "${phrase}". No other lettering.`
    : "No words, no letters, no numbers, no typography, no captions, and no signatures.";
  return [surface, `${design.subject}.`, "No garment, no mockup, no frame, no watermark.", collar, lettering]
    .filter(Boolean)
    .join(" ");
}

export function prepareDailyBatch(lettering: DailyLettering = DEFAULT_DAILY_LETTERING): PreparedDesign[] {
  return dailyBatchDesigns().map((design) => {
    const phrase = phraseForTheme(design.theme, lettering);
    return {
      ...design,
      phrase,
      prompt: designPrompt(design, phrase),
      lettering: Boolean(phrase),
    };
  });
}

export function dailyBatchSummary(rows: PreparedDesign[]) {
  const withWords = rows.filter((row) => row.lettering).length;
  return {
    total: rows.length,
    withWords,
    withoutWords: rows.length - withWords,
    collars: rows.filter((row) => row.collar).length,
  };
}

export function dailyBatchLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(date);
}

export type ReviewMark = { glanced: boolean; clean: boolean };

export function designsForThemes(rows: PreparedDesign[], themes: readonly DailyTheme[]) {
  const allowed = new Set(themes);
  return rows.filter((row) => allowed.has(row.theme));
}

/** Clean is only kept after a glance. Turning glance off clears clean. */
export function markGlanced(marks: Record<string, ReviewMark>, id: string, glanced: boolean) {
  const current = marks[id] || { glanced: false, clean: false };
  return {
    ...marks,
    [id]: { glanced, clean: glanced ? current.clean : false },
  };
}

export function markClean(marks: Record<string, ReviewMark>, id: string, clean: boolean) {
  const current = marks[id];
  if (!current?.glanced) return marks;
  return { ...marks, [id]: { glanced: true, clean } };
}

/** Push set: glanced and marked clean, and still in the batch being reviewed. */
export function designsToSave(
  rows: PreparedDesign[],
  reviews: Record<string, { glanced?: boolean; clean?: boolean } | undefined>,
) {
  return rows.filter((row) => reviews[row.id]?.glanced === true && reviews[row.id]?.clean === true);
}
