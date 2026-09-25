#!/usr/bin/env python3
"""Build customer stills where the design is readable on the product.

Official 1200px mockups make chest embroidery unreadable when cropped.
If the design on the official photo is small, the matching print file is
stamped onto the garment fabric (collar/zipper stay). Cream template tiles
are never published. New CATALOG_ART_PAIRS keys are picked up automatically.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"
PRINT_FILE_TS = ROOT / "src" / "lib" / "print-file.ts"

CONTEXT_FILL = {"apparel": 0.46, "default": 0.62}
CLOSE_FILL = {"apparel": 0.76, "default": 0.88}
CROP_FILL = {
    "apparel_context": 0.26,
    "apparel_close": 0.50,
    "default_context": 0.62,
    "default_close": 0.88,
}
MIN_FILL = {"apparel_context": 0.38, "apparel_close": 0.64, "default_close": 0.50}
OUTPUT_SIZE = 1600
SMALL_DESIGN_PX = 400
MIN_UNIQUE_COLORS = 800
MIN_DARK_PX = 1800


def catalog_pairs() -> list[tuple[str, str, str]]:
    text = PRINT_FILE_TS.read_text()
    found = re.findall(
        r'key: "([^"]+)", mockup: "/catalog/([^"]+)", print: "/catalog/([^"]+)"',
        text,
    )
    if not found:
        raise SystemExit("Could not read CATALOG_ART_PAIRS from print-file.ts")
    pairs: list[tuple[str, str, str]] = []
    for key, mockup, print_name in found:
        ghost = OUT / f"gallery-{key}-ghost.jpg"
        source = ghost.name if ghost.exists() else mockup
        pairs.append((key, source, print_name))
    return pairs


def is_apparel(key: str, source_name: str) -> bool:
    blob = f"{key} {source_name}".lower()
    return "ghost" in blob or any(word in blob for word in ("hoodie", "tee", "sweat", "shirt"))


def chroma_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    near_white = (r > 236) & (g > 236) & (b > 236)
    return (chroma > 26) & ~near_white


def ink_mask(rgb: np.ndarray) -> np.ndarray:
    luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    return luma < 178


def design_bbox(im: Image.Image, apparel: bool) -> tuple[int, int, int, int]:
    rgb = np.array(im.convert("RGB"))
    mask = chroma_mask(rgb)
    h, w = mask.shape
    if apparel:
        mask[: int(h * 0.20)] = False
        mask[int(h * 0.74) :] = False
        mask[:, : int(w * 0.18)] = False
        mask[:, int(w * 0.86) :] = False
    else:
        ink = ink_mask(rgb)
        if int(ink.sum()) > 400:
            mask = ink
    ys, xs = np.nonzero(mask)
    if len(xs) < 80:
        return (int(w * 0.28), int(h * 0.28), int(w * 0.72), int(h * 0.72))
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def measured_fill(im: Image.Image) -> float:
    x0, y0, x1, y1 = design_bbox(im, apparel=False)
    return max(x1 - x0, y1 - y0) / max(1, max(im.size))


def colorful_fill(im: Image.Image) -> float:
    mask = chroma_mask(np.array(im.convert("RGB")))
    ys, xs = np.nonzero(mask)
    if len(xs) < 80:
        return 0.0
    return max(int(xs.max()) - int(xs.min()), int(ys.max()) - int(ys.min())) / max(1, max(im.size))


def place_square(
    im: Image.Image,
    box: tuple[int, int, int, int],
    fill: float,
    bias: tuple[float, float] = (0.0, 0.0),
    size: int = OUTPUT_SIZE,
) -> Image.Image:
    x0, y0, x1, y1 = box
    design = max(x1 - x0, y1 - y0)
    side = max(int(round(design / max(0.12, fill))), design + 16)
    cx = (x0 + x1) // 2 + int(side * bias[0])
    cy = (y0 + y1) // 2 + int(side * bias[1])
    half = side // 2
    pad = max(8, int(design * 0.08))
    min_cx, max_cx = x1 - half + pad, x0 + half - pad
    min_cy, max_cy = y1 - half + pad, y0 + half - pad
    if min_cx <= max_cx:
        cx = min(max(cx, min_cx), max_cx)
    if min_cy <= max_cy:
        cy = min(max(cy, min_cy), max_cy)
    left = max(0, cx - half)
    top = max(0, cy - half)
    right = min(im.size[0], left + side)
    bottom = min(im.size[1], top + side)
    left = max(0, right - side)
    top = max(0, bottom - side)
    crop = im.convert("RGB").crop((left, top, right, bottom))
    return crop.resize((size, size), Image.Resampling.LANCZOS)


def artwork_rgba(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    chroma = arr[:, :, :3].max(axis=2).astype(np.int16) - arr[:, :, :3].min(axis=2).astype(np.int16)
    keep = ((chroma > 12) | (luma < 210)) & (arr[:, :, 3] > 10)
    alpha = Image.fromarray(np.where(keep, 255, 0).astype(np.uint8), "L")
    alpha = alpha.filter(ImageFilter.MaxFilter(3))
    arr[:, :, 3] = np.array(alpha)
    ys, xs = np.nonzero(arr[:, :, 3])
    if len(xs) < 40:
        return im
    return Image.fromarray(arr).crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fabric_rgb(im: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    arr = np.array(im.convert("RGB"))
    h, w, _ = arr.shape
    x0, y0, x1, y1 = box
    pad = 40
    xa, ya = max(0, x0 - pad), max(0, y0 - pad)
    xb, yb = min(w, x1 + pad), min(h, y1 + pad)
    ring = arr[ya:yb, xa:xb]
    inner = np.ones(ring.shape[:2], dtype=bool)
    iy0, ix0 = max(0, y0 - ya), max(0, x0 - xa)
    iy1, ix1 = min(ring.shape[0], y1 - ya), min(ring.shape[1], x1 - xa)
    inner[iy0:iy1, ix0:ix1] = False
    pix = ring[inner]
    if len(pix) < 20:
        pix = ring.reshape(-1, 3)
    luma = 0.299 * pix[:, 0] + 0.587 * pix[:, 1] + 0.114 * pix[:, 2]
    fabric = pix[luma > 210] if np.any(luma > 210) else pix
    return tuple(int(v) for v in np.median(fabric, axis=0))


def chroma_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    mask = chroma_mask(np.array(im.convert("RGB")))
    ys, xs = np.nonzero(mask)
    if len(xs) < 40:
        return design_bbox(im, apparel=False)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def clean_and_stamp(crop: Image.Image, art: Image.Image, fill: float) -> Image.Image:
    old = chroma_bbox(crop)
    color = fabric_rgb(crop, old)
    x0, y0, x1, y1 = old
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    x0 = max(0, x0 - int(bw * 0.35))
    y0 = max(0, y0 - int(bh * 0.35))
    x1 = min(crop.size[0], x1 + int(bw * 0.35))
    y1 = min(crop.size[1], y1 + int(bh * 0.35))
    arr = np.array(crop.convert("RGB"))
    region = arr[y0:y1, x0:x1]
    fabric = np.array(color, dtype=np.int16)
    diff = np.abs(region.astype(np.int16) - fabric).sum(axis=2)
    region[diff > 10] = color
    arr[y0:y1, x0:x1] = region
    canvas = Image.fromarray(arr)
    side = int(max(canvas.size) * fill)
    aw, ah = art.size
    scale = side / max(aw, ah)
    nw, nh = max(1, int(aw * scale)), max(1, int(ah * scale))
    fitted = art.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (old[0] + old[2]) // 2
    oy = (old[1] + old[3]) // 2
    px = min(max(0, ox - nw // 2), max(0, canvas.size[0] - nw))
    py = min(max(0, oy - nh // 2), max(0, canvas.size[1] - nh))
    out = canvas.convert("RGBA")
    out.paste(fitted, (px, py), fitted)
    return out.convert("RGB")


def unique_colors(im: Image.Image) -> int:
    colors = im.convert("RGB").getcolors(maxcolors=400000)
    return 400000 if colors is None else len(colors)


def dark_pixels(im: Image.Image) -> int:
    arr = np.array(im.convert("RGB"))
    luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    return int((luma < 92).sum())


def should_stamp(box: tuple[int, int, int, int], print_path: Path) -> bool:
    design = max(box[2] - box[0], box[3] - box[1])
    return print_path.exists() and design < SMALL_DESIGN_PX


def write_stills(key: str, source_name: str, print_name: str) -> str:
    src = OUT / source_name
    print_path = OUT / print_name
    wear = OUT / f"gallery-{key}-onproduct.jpg"
    close = OUT / f"gallery-{key}-onproduct-close.jpg"
    if not src.exists():
        return f"MISSING {source_name}"
    if re.search(r"(print-|-(detail|close)\.)", source_name) and "onproduct" not in source_name:
        return f"REFUSED template source {source_name}"
    im = Image.open(src)
    apparel = is_apparel(key, source_name)
    box = design_bbox(im, apparel=apparel)
    kind = "apparel" if apparel else "default"
    context_bias = (0.0, 0.0)
    if apparel:
        img_cx = im.size[0] / 2
        design_cx = (box[0] + box[2]) / 2
        if "hoodie" in key:
            context_bias = (-0.22 if design_cx > img_cx else 0.04, -0.10)
        else:
            context_bias = (0.0, -0.14)
    crop_ctx = CROP_FILL["apparel_context" if apparel else "default_context"]
    crop_close = CROP_FILL["apparel_close" if apparel else "default_close"]
    ctx = place_square(im, box, crop_ctx, context_bias)
    cl = place_square(im, box, crop_close)
    stamped = False
    if should_stamp(box, print_path):
        art = artwork_rgba(print_path)
        ctx = clean_and_stamp(ctx, art, CONTEXT_FILL[kind])
        cl = clean_and_stamp(cl, art, CLOSE_FILL[kind])
        stamped = True
    else:
        ctx = ctx.filter(ImageFilter.UnsharpMask(radius=1.3, percent=145, threshold=2))
        cl = cl.filter(ImageFilter.UnsharpMask(radius=1.3, percent=145, threshold=2))
    ctx.save(wear, "JPEG", quality=93)
    cl.save(close, "JPEG", quality=93)
    note = " stamped print" if stamped else ""
    return f"wrote {key} from {source_name}{note} fill ctx={CONTEXT_FILL[kind]} close={CLOSE_FILL[kind]}"


def check_one(key: str, source_name: str, print_name: str) -> str | None:
    wear = OUT / f"gallery-{key}-onproduct.jpg"
    close = OUT / f"gallery-{key}-onproduct-close.jpg"
    src = OUT / source_name
    if not src.exists() or not wear.exists() or not close.exists():
        return f"MISSING on-product stills for {key}"
    apparel = is_apparel(key, source_name)
    wear_im = Image.open(wear)
    close_im = Image.open(close)
    ctx = colorful_fill(wear_im) if apparel else measured_fill(wear_im)
    cl = colorful_fill(close_im) if apparel else measured_fill(close_im)
    if apparel:
        if not (OUT / print_name).exists():
            return f"{key} missing print file for readable on-product stills"
        if ctx < MIN_FILL["apparel_context"]:
            return f"{key} context fill {ctx:.2f} < {MIN_FILL['apparel_context']}"
        if cl < MIN_FILL["apparel_close"]:
            return f"{key} close fill {cl:.2f} < {MIN_FILL['apparel_close']}"
        src_box = design_bbox(Image.open(src), apparel=True)
        if should_stamp(src_box, OUT / print_name):
            if unique_colors(close_im) < MIN_UNIQUE_COLORS:
                return f"{key} close-up is not a readable stamped print"
            if dark_pixels(close_im) < MIN_DARK_PX:
                return f"{key} close-up is missing readable dark lettering"
    elif cl < MIN_FILL["default_close"]:
        return f"{key} close fill {cl:.2f} < {MIN_FILL['default_close']}"
    print(f"ok {key} on-product stills ctx={ctx:.2f} close={cl:.2f}")
    return None


def check_only() -> int:
    failed = 0
    for key, source_name, print_name in catalog_pairs():
        error = check_one(key, source_name, print_name)
        if error:
            print(error)
            failed += 1
    return failed


def main() -> None:
    pairs = catalog_pairs()
    if "--check" in sys.argv:
        failed = check_only()
        if failed:
            raise SystemExit(f"{failed} product(s) failed on-product still checks")
        return
    for key, source_name, print_name in pairs:
        print(write_stills(key, source_name, print_name))
    failed = check_only()
    if failed:
        raise SystemExit(f"{failed} product(s) failed on-product still checks")


if __name__ == "__main__":
    main()
