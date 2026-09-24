#!/usr/bin/env python3
"""Crop official product photos so the design fills the customer stills.

Customers never see cream print-template tiles. These stills stay on the real
item. Fill targets are measured on every run so a future product cannot ship
a tiny chest logo in a sea of fabric.

Apparel prefers the official ghost/flat camera. Other products use the
catalog mockup. New CATALOG_ART_PAIRS keys are picked up automatically.
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

# Design bbox / crop-side. Apparel context keeps collar or zipper in frame.
CONTEXT_FILL = {"apparel": 0.50, "default": 0.62}
CLOSE_FILL = {"apparel": 0.80, "default": 0.88}
MIN_FILL = {"apparel_context": 0.45, "apparel_close": 0.72, "default_close": 0.50}
OUTPUT_SIZE = 1600


def catalog_pairs() -> list[tuple[str, str]]:
    text = PRINT_FILE_TS.read_text()
    found = re.findall(r'key: "([^"]+)", mockup: "/catalog/([^"]+)"', text)
    if not found:
        raise SystemExit("Could not read CATALOG_ART_PAIRS from print-file.ts")
    pairs: list[tuple[str, str]] = []
    for key, mockup in found:
        ghost = OUT / f"gallery-{key}-ghost.jpg"
        source = ghost.name if ghost.exists() else mockup
        pairs.append((key, source))
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
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    design = max(bw, bh)
    side = max(int(round(design / max(0.12, fill))), design + 16)
    pad = max(8, int(design * 0.08))
    cx = (x0 + x1) // 2 + int(side * bias[0])
    cy = (y0 + y1) // 2 + int(side * bias[1])
    half = side // 2
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
    sharp = crop.resize((size, size), Image.Resampling.LANCZOS)
    return sharp.filter(ImageFilter.UnsharpMask(radius=1.3, percent=145, threshold=2))


def write_stills(key: str, source_name: str) -> str:
    src = OUT / source_name
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
    context_bias = (-0.18 if apparel else 0.0, -0.16 if apparel else 0.0)
    if apparel:
        img_cx = im.size[0] / 2
        design_cx = (box[0] + box[2]) / 2
        context_bias = (-0.20 if design_cx > img_cx else 0.08, -0.16)
    place_square(im, box, CONTEXT_FILL[kind], context_bias).save(wear, "JPEG", quality=93)
    place_square(im, box, CLOSE_FILL[kind]).save(close, "JPEG", quality=93)
    return f"wrote {key} from {source_name} fill ctx={CONTEXT_FILL[kind]} close={CLOSE_FILL[kind]}"


def check_one(key: str, source_name: str) -> str | None:
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
        if ctx < MIN_FILL["apparel_context"]:
            return f"{key} context fill {ctx:.2f} < {MIN_FILL['apparel_context']}"
        if cl < MIN_FILL["apparel_close"]:
            return f"{key} close fill {cl:.2f} < {MIN_FILL['apparel_close']}"
    elif cl < MIN_FILL["default_close"]:
        return f"{key} close fill {cl:.2f} < {MIN_FILL['default_close']}"
    print(f"ok {key} on-product stills ctx={ctx:.2f} close={cl:.2f}")
    return None


def check_only() -> int:
    failed = 0
    for key, source_name in catalog_pairs():
        error = check_one(key, source_name)
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
    for key, source_name in pairs:
        print(write_stills(key, source_name))
    failed = check_only()
    if failed:
        raise SystemExit(f"{failed} product(s) failed on-product still checks")


if __name__ == "__main__":
    main()
