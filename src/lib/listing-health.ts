/** Etsy and Printify listing health both ask for 13 tags (max 20 characters each). */
export const LISTING_TAG_LIMIT = 13;
export const LISTING_TAG_MAX_LEN = 20;
/** Printify listing health asks for 20 selected mockups. We store every real photo we have. */
export const LISTING_MOCKUP_TARGET = 20;

const SHARED_TAGS = [
  "fernora",
  "new zealand",
  "wall art",
  "made to order",
  "home decor",
  "art print",
  "nature",
  "gift",
  "cream",
  "botanical print",
  "unframed",
  "nz made",
];

const MIX_TAGS: Record<string, string> = {
  original: "Original fern",
  quote: "Quotes",
  botanical: "Botanical",
  scenic: "Scenic",
  home: "Home décor",
};

const GALLERY_PAIRS: Record<string, { mockup: string; print: string }> = {
  live_poster: { mockup: "/catalog/catalog-poster.png", print: "/catalog/print-poster-fern-arc.png" },
  live_quote_breathe: { mockup: "/catalog/catalog-breathe-here.png", print: "/catalog/print-breathe-here.png" },
  live_botanical_kowhai: {
    mockup: "/catalog/catalog-kowhai-botanical.png",
    print: "/catalog/print-kowhai-botanical.png",
  },
  live_canvas_harbour: {
    mockup: "/catalog/catalog-harbour-morning.png",
    print: "/catalog/print-harbour-morning.png",
  },
  live_frame_kind: { mockup: "/catalog/catalog-kind-light.png", print: "/catalog/print-kind-light.png" },
};

export function clipListingTag(tag: string) {
  return tag.trim().slice(0, LISTING_TAG_MAX_LEN);
}

/** Fill to 13 unique tags for current and future products. Keeps mix labels (Quotes, Botanical, …). */
export function fillListingTags(tags: string[], extras: string[] = []) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...tags, ...extras, ...SHARED_TAGS]) {
    const clean = clipListingTag(tag);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length === LISTING_TAG_LIMIT) break;
  }
  return out;
}

export function mixTag(collection?: string | null) {
  return (collection && MIX_TAGS[collection]) || "";
}

export function listingGallery(id?: string | null, mockup?: string | null, print?: string | null) {
  const pair = id ? GALLERY_PAIRS[id] : undefined;
  const files = [
    pair?.mockup || mockup || "",
    pair?.print || print || "",
    id ? `/catalog/gallery-${id}-detail.png` : "",
    id ? `/catalog/gallery-${id}-close.png` : "",
  ].filter((file, index, all) => file && all.indexOf(file) === index);
  return files;
}

export function listingHealth(input: { tags?: string[]; gallery?: string[] }) {
  const tags = input.tags || [];
  const gallery = input.gallery || [];
  return {
    tags: tags.length,
    tagLimit: LISTING_TAG_LIMIT,
    tagsOk: tags.length >= LISTING_TAG_LIMIT,
    photos: gallery.length,
    photoTarget: LISTING_MOCKUP_TARGET,
    photosOk: gallery.length >= LISTING_MOCKUP_TARGET,
  };
}

export const CATALOG_LISTING_TAGS: Record<string, string[]> = {
  live_poster: fillListingTags(
    ["fern", "poster", "botanical", "nz art", "wall print", "Original fern"],
    ["fern print", "a3 poster", "wall poster"],
  ),
  live_quote_breathe: fillListingTags(
    ["breathe", "quote", "kind", "poster", "positive", "Quotes"],
    ["quote print", "calm", "you are here"],
  ),
  live_botanical_kowhai: fillListingTags(
    ["Botanical", "kowhai", "flowers", "poster", "yellow"],
    ["nz flowers", "kowhai print", "floral print"],
  ),
  live_canvas_harbour: fillListingTags(
    ["harbour", "canvas", "landscape", "morning", "home", "Scenic"],
    ["nz harbour", "canvas print", "coastal"],
  ),
  live_frame_kind: fillListingTags(
    ["home", "framed", "kind", "quote", "homedecor", "Home décor"],
    ["oak frame", "ready to hang", "kind light"],
  ),
};

export function tagsForListing(id: string, fallback: string[] = [], collection?: string | null) {
  return CATALOG_LISTING_TAGS[id] || fillListingTags(fallback, [mixTag(collection)]);
}

export function galleryForListing(id: string) {
  const pair = GALLERY_PAIRS[id];
  return listingGallery(id, pair?.mockup, pair?.print);
}
