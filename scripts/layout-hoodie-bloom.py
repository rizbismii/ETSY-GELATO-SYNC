#!/usr/bin/env python3
"""Place the Grow With Purpose line under the fern on the zip-hoodie embroidery.

The source file keeps the original side-by-side stitching. This script lifts
that lettering and centers it beneath the fern, then refreshes the white
hoodie mockup so the catalog photo matches the print file.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "apparel-src" / "hoodie-bloom-source.png"
OUT = ROOT / "public" / "catalog" / "print-hoodie-bloom.png"
MOCKUPS = (
    ROOT / "public" / "catalog" / "catalog-hoodie-bloom.jpg",
    ROOT / "public" / "catalog" / "gallery-live_hoodie_bloom-model.jpg",
)
SIZE = 1200


def components(mask: np.ndarray) -> list[np.ndarray]:
    h, w = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    groups: list[np.ndarray] = []
    for y in range(h):
        xs = np.flatnonzero(mask[y] & ~seen[y])
        for x in xs:
            if seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            cells: list[tuple[int, int]] = []
            while stack:
                cy, cx = stack.pop()
                cells.append((cy, cx))
                for ny in (cy - 1, cy, cy + 1):
                    if ny < 0 or ny >= h:
                        continue
                    for nx in (cx - 1, cx, cx + 1):
                        if nx < 0 or nx >= w or seen[ny, nx] or not mask[ny, nx]:
                            continue
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            group = np.zeros(mask.shape, dtype=bool)
            ys, xs_ = zip(*cells)
            group[np.array(ys), np.array(xs_)] = True
            groups.append(group)
    return groups


def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def split_quote(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ink = rgba[:, :, 3] > 16
    groups = [group for group in components(ink) if int(group.sum()) >= 12]
    groups.sort(key=lambda group: int(group.sum()), reverse=True)
    if not groups:
        raise SystemExit("hoodie embroidery source has no ink")
    fern = groups[0]
    fx0, fy0, fx1, fy1 = bbox(fern)
    text = np.zeros(ink.shape, dtype=bool)
    for group in groups[1:]:
        count = int(group.sum())
        x0, y0, x1, y1 = bbox(group)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        beside_fern = cx < fx0 + (fx1 - fx0) * 0.42 and fy0 - 40 < cy < fy0 + (fy1 - fy0) * 0.62
        letter_sized = 12 <= count <= 6000
        if beside_fern and letter_sized:
            text |= group
    if int(text.sum()) < 80:
        raise SystemExit("could not find the wording beside the fern")
    fern_rgba = rgba.copy()
    fern_rgba[text] = 0
    text_rgba = np.zeros_like(rgba)
    text_rgba[text] = rgba[text]
    return fern_rgba, text_rgba


def trim(rgba: np.ndarray, pad: int = 8) -> np.ndarray:
    ys, xs = np.nonzero(rgba[:, :, 3] > 8)
    y0, y1 = max(0, int(ys.min()) - pad), min(rgba.shape[0], int(ys.max()) + pad + 1)
    x0, x1 = max(0, int(xs.min()) - pad), min(rgba.shape[1], int(xs.max()) + pad + 1)
    return rgba[y0:y1, x0:x1]


def stack_quote(fern: np.ndarray, text: np.ndarray) -> np.ndarray:
    fern, text = trim(fern, 4), trim(text, 4)
    gap = max(28, int(fern.shape[0] * 0.045))
    width = max(fern.shape[1], text.shape[1])
    height = fern.shape[0] + gap + text.shape[0]
    canvas = np.zeros((height, width, 4), dtype=np.uint8)
    paste(canvas, fern, (width - fern.shape[1]) // 2, 0)
    paste(canvas, text, (width - text.shape[1]) // 2, fern.shape[0] + gap)
    return fit_square(canvas, SIZE, 0.9)


def paste(dst: np.ndarray, src: np.ndarray, x: int, y: int) -> None:
    sh, sw = src.shape[:2]
    dst[y : y + sh, x : x + sw] = src


def fit_square(rgba: np.ndarray, size: int, fill: float) -> np.ndarray:
    canvas = np.zeros((size, size, 4), dtype=np.uint8)
    h, w = rgba.shape[:2]
    scale = min((size * fill) / h, (size * fill) / w)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = np.array(Image.fromarray(rgba, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS))
    canvas[(size - nh) // 2 : (size - nh) // 2 + nh, (size - nw) // 2 : (size - nw) // 2 + nw] = resized
    return canvas


def quote_is_below_fern(rgba: np.ndarray) -> bool:
    ink = rgba[:, :, 3] > 20
    row = ink.sum(axis=1)
    rows = np.flatnonzero(row > 8)
    if len(rows) < 10:
        return False
    top, bot = int(rows[0]), int(rows[-1])
    # The lower fifth should still hold lettering, and a quiet gap should sit above it.
    lower = ink[bot - (bot - top) // 5 : bot + 1].sum()
    return lower > 40


def inpaint_logo(rgb: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    ink = chroma > 18
    if not ink.any():
        raise SystemExit("hoodie mockup has no embroidery to replace")
    x0, y0, x1, y1 = bbox(ink)
    fabric = rgb[(chroma < 8) & (rgb.mean(axis=2) > 210)]
    fill = np.median(fabric, axis=0).astype(np.uint8) if len(fabric) else np.array([245, 245, 245], np.uint8)
    out = rgb.copy()
    out[ink] = fill
    return out, (x0, y0, x1, y1)


def paint_mockup(path: Path, design: np.ndarray) -> None:
    base = np.array(Image.open(path).convert("RGB"))
    cleared, (x0, y0, x1, y1) = inpaint_logo(base)
    logo_w = max(1, x1 - x0 + 1)
    logo_h = max(1, y1 - y0 + 1)
    art = Image.fromarray(design, "RGBA")
    target_w = int(logo_w * 1.35)
    scale = target_w / art.size[0]
    target_h = max(1, int(art.size[1] * scale))
    art = art.resize((target_w, target_h), Image.Resampling.LANCZOS)
    # Keep the fern where the old mark sat; the line hangs below it.
    cx = (x0 + x1) // 2
    left = cx - target_w // 2
    top = y0 - int(target_h * 0.08)
    canvas = Image.fromarray(cleared, "RGB")
    canvas.paste(art, (left, top), art)
    canvas.save(path, "JPEG", quality=90, optimize=True)


def main() -> None:
    source = np.array(Image.open(SRC).convert("RGBA"))
    fern, text = split_quote(source)
    stacked = stack_quote(fern, text)
    if not quote_is_below_fern(stacked):
        raise SystemExit("wording did not land below the fern")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(stacked, "RGBA").save(OUT, "PNG", optimize=True)
    for mockup in MOCKUPS:
        paint_mockup(mockup, stacked)
    print(f"wrote {OUT.name} and {len(MOCKUPS)} mockups")


if __name__ == "__main__":
    main()
