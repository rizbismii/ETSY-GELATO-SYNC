#!/usr/bin/env python3
"""Write a tight, zoomable design still for every catalog product.

Listing photos are full garments or rooms. Zooming those keeps the artwork tiny.
This crops the print file to the ink and composites it on cream so Etsy and the
website have a clear second/third photo. Existing stills are kept when present.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"
CREAM = (250, 246, 239)
SIZE = 2000

PAIRS = (
    ("live_poster", "print-poster-fern-arc.png"),
    ("live_quote_breathe", "print-breathe-here.png"),
    ("live_botanical_kowhai", "print-kowhai-botanical.png"),
    ("live_canvas_harbour", "print-harbour-morning.png"),
    ("live_frame_kind", "print-kind-light.png"),
    ("live_sneaker_star", "print-camo-sneakers.png"),
    ("live_sneaker_star_w", "print-star-sneakers.png"),
    ("live_hoodie_bloom", "print-hoodie-bloom.png"),
    ("live_tee_bloom", "print-tee-bloom.png"),
)


def ink_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    arr = np.array(im)
    if arr.ndim == 3 and arr.shape[2] == 4:
        mask = arr[:, :, 3] > 16
    else:
        rgb = arr[:, :, :3].astype(np.int16)
        cream = np.array(CREAM, dtype=np.int16)
        mask = np.max(np.abs(rgb - cream), axis=2) > 18
        white = np.max(np.abs(rgb - 255), axis=2) > 12
        mask = np.logical_and(mask, white)
    ys, xs = np.nonzero(mask)
    if len(xs) < 40:
        return (0, 0, im.size[0], im.size[1])
    pad = max(24, int(0.06 * max(im.size)))
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(im.size[0], int(xs.max()) + pad + 1)
    y1 = min(im.size[1], int(ys.max()) + pad + 1)
    return (x0, y0, x1, y1)


def square_on_cream(crop: Image.Image, size: int = SIZE) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), CREAM + (255,))
    fitted = crop.convert("RGBA")
    fitted.thumbnail((int(size * 0.88), int(size * 0.88)), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas.convert("RGB")


def tighter(box: tuple[int, int, int, int], im: Image.Image) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    inset_x = int(w * 0.12)
    inset_y = int(h * 0.10)
    return (
        max(0, x0 + inset_x),
        max(0, y0 + inset_y),
        min(im.size[0], x1 - inset_x),
        min(im.size[1], y1 - inset_y),
    )


def write_stills(key: str, print_name: str, overwrite: bool) -> str:
    src = OUT / print_name
    detail = OUT / f"gallery-{key}-detail.png"
    close = OUT / f"gallery-{key}-close.png"
    if not src.exists():
        return f"MISSING {print_name}"
    if detail.exists() and close.exists() and not overwrite:
        return f"keep {key}"
    im = Image.open(src)
    box = ink_bbox(im)
    detail_im = square_on_cream(im.crop(box))
    close_im = square_on_cream(im.crop(tighter(box, im)))
    detail_im.save(detail, "PNG", optimize=True)
    close_im.save(close, "PNG", optimize=True)
    return f"wrote {key} {detail_im.size[0]}x{detail_im.size[1]}"


def check_only() -> int:
    failed = 0
    for key, print_name in PAIRS:
        detail = OUT / f"gallery-{key}-detail.png"
        close = OUT / f"gallery-{key}-close.png"
        src = OUT / print_name
        if not src.exists() or not detail.exists() or not close.exists():
            print(f"MISSING design zoom stills for {key}")
            failed += 1
            continue
        print(f"ok {key} zoom stills")
    return failed


def main() -> None:
    if "--check" in sys.argv:
        failed = check_only()
        if failed:
            raise SystemExit(f"{failed} product(s) missing design zoom stills")
        return
    overwrite = "--overwrite" in sys.argv
    for key, print_name in PAIRS:
        print(write_stills(key, print_name, overwrite=overwrite or key == "live_tee_bloom"))
    failed = check_only()
    if failed:
        raise SystemExit(f"{failed} product(s) missing design zoom stills")


if __name__ == "__main__":
    main()
