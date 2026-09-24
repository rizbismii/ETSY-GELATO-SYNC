#!/usr/bin/env python3
"""Crop the official product photo so the design is visible on the item.

Do not publish print-template stills (artwork on cream). Customers see the
design on the garment, poster, or shoe. Existing cream detail/close files
are left on disk for print-match checks but are not customer photos.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"

# Official ghost / flat cameras — design on the real product, no model crop guess.
GHOST = {
    "live_tee_bloom": "gallery-live_tee_bloom-ghost.jpg",
    "live_hoodie_bloom": "gallery-live_hoodie_bloom-ghost.jpg",
}

PAIRS = (
    ("live_poster", "catalog-poster.png"),
    ("live_quote_breathe", "catalog-breathe-here.png"),
    ("live_botanical_kowhai", "catalog-kowhai-botanical.png"),
    ("live_canvas_harbour", "catalog-harbour-morning.png"),
    ("live_frame_kind", "catalog-kind-light.png"),
    ("live_sneaker_star", "catalog-camo-sneakers-angle.jpg"),
    ("live_sneaker_star_w", "catalog-star-sneakers-w-angle.jpg"),
    ("live_hoodie_bloom", "gallery-live_hoodie_bloom-ghost.jpg"),
    ("live_tee_bloom", "gallery-live_tee_bloom-ghost.jpg"),
)


def chroma_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    near_white = (r > 236) & (g > 236) & (b > 236)
    return (chroma > 26) & ~near_white


def design_bbox(im: Image.Image, apparel: bool) -> tuple[int, int, int, int]:
    arr = np.array(im.convert("RGB"))
    mask = chroma_mask(arr)
    h, w = mask.shape
    if apparel:
        # Ignore hair / jeans / room; keep the garment body.
        mask[: int(h * 0.22)] = False
        mask[int(h * 0.72) :] = False
        mask[:, : int(w * 0.22)] = False
        mask[:, int(w * 0.82) :] = False
    ys, xs = np.nonzero(mask)
    if len(xs) < 80:
        return (int(w * 0.28), int(h * 0.28), int(w * 0.72), int(h * 0.72))
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def square_crop(im: Image.Image, box: tuple[int, int, int, int], pad_ratio: float, size: int = 1600) -> Image.Image:
    x0, y0, x1, y1 = box
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    side = int(max(bw, bh) * pad_ratio)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2
    left = max(0, cx - half)
    top = max(0, cy - half)
    right = min(im.size[0], left + side)
    bottom = min(im.size[1], top + side)
    left = max(0, right - side)
    top = max(0, bottom - side)
    crop = im.convert("RGB").crop((left, top, right, bottom))
    return crop.resize((size, size), Image.Resampling.LANCZOS)


def write_stills(key: str, source_name: str) -> str:
    src = OUT / source_name
    wear = OUT / f"gallery-{key}-onproduct.jpg"
    close = OUT / f"gallery-{key}-onproduct-close.jpg"
    if not src.exists():
        return f"MISSING {source_name}"
    im = Image.open(src)
    apparel = key in GHOST
    box = design_bbox(im, apparel=apparel)
    square_crop(im, box, 3.4 if apparel else 1.8).save(wear, "JPEG", quality=92)
    square_crop(im, box, 1.7 if apparel else 1.15).save(close, "JPEG", quality=92)
    return f"wrote {key} from {source_name}"


def check_only() -> int:
    failed = 0
    for key, source_name in PAIRS:
        wear = OUT / f"gallery-{key}-onproduct.jpg"
        close = OUT / f"gallery-{key}-onproduct-close.jpg"
        if not (OUT / source_name).exists() or not wear.exists() or not close.exists():
            print(f"MISSING on-product stills for {key}")
            failed += 1
            continue
        print(f"ok {key} on-product stills")
    return failed


def main() -> None:
    if "--check" in sys.argv:
        failed = check_only()
        if failed:
            raise SystemExit(f"{failed} product(s) missing on-product stills")
        return
    for key, source_name in PAIRS:
        print(write_stills(key, source_name))
    failed = check_only()
    if failed:
        raise SystemExit(f"{failed} product(s) missing on-product stills")


if __name__ == "__main__":
    main()
