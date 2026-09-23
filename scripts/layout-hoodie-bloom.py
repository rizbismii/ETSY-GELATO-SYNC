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
BASE = ROOT / "scripts" / "apparel-src" / "hoodie-bloom-mockup-base.jpg"
OUT = ROOT / "public" / "catalog" / "print-hoodie-bloom.png"
CATALOG = ROOT / "public" / "catalog"
WHITE_MOCKUPS = (
    CATALOG / "catalog-hoodie-bloom.jpg",
    CATALOG / "gallery-live_hoodie_bloom-model.jpg",
)
COLOR_MOCKUPS = {
    "black": CATALOG / "catalog-hoodie-bloom-black.jpg",
    "navy": CATALOG / "catalog-hoodie-bloom-navy.jpg",
}
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


def trim_art(design: np.ndarray) -> Image.Image:
    ys, xs = np.nonzero(design[:, :, 3] > 20)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    return Image.fromarray(design[y0:y1, x0:x1], "RGBA")


def paint_on_base(design: np.ndarray) -> np.ndarray:
    """Replace the side-by-side chest mark with the quote-under-fern file, large enough to read."""
    base = np.array(Image.open(BASE).convert("RGB"))
    cleared, (x0, y0, x1, y1) = inpaint_logo(base)
    art = trim_art(design)
    target_w = max(150, int((x1 - x0 + 1) * 2.4))
    target_h = max(1, int(art.size[1] * target_w / art.size[0]))
    art = art.resize((target_w, target_h), Image.Resampling.LANCZOS)
    cx = (x0 + x1) // 2
    left = cx - target_w // 2
    top = max(0, y0 - 8)
    canvas = Image.fromarray(cleared, "RGB")
    canvas.paste(art, (left, top), art)
    return np.array(canvas)


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """Studio backdrop only. The white hoodie itself is about 230–248, so a looser cut paints just the shadows."""
    luma = rgb.mean(axis=2)
    chroma = np.max(rgb, axis=2) - np.min(rgb, axis=2)
    light = (luma > 252) & (chroma < 6)
    h, w = light.shape
    bg = np.zeros(light.shape, dtype=bool)
    stack = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or not light[y, x]:
            continue
        bg[y, x] = True
        stack.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))
    return bg


def recolor_garment(rgb: np.ndarray, garment: tuple[int, int, int]) -> np.ndarray:
    out = rgb.astype(np.float32)
    luma = 0.299 * out[:, :, 0] + 0.587 * out[:, :, 1] + 0.114 * out[:, :, 2]
    chroma = np.max(out, axis=2) - np.min(out, axis=2)
    # Keep the fern and the dark quote. Recolor the rest of the garment, including the bright panels.
    fabric = ~background_mask(rgb) & (chroma < 28) & (luma > 130)
    shade = np.clip((luma - 160) / 95, 0.35, 1)
    tint = np.array(garment, np.float32).reshape(1, 1, 3) * (0.45 + 0.55 * shade[:, :, None])
    out[fabric] = tint[fabric]
    return np.clip(out, 0, 255).astype(np.uint8)


def save_jpeg(path: Path, rgb: np.ndarray) -> None:
    Image.fromarray(rgb, "RGB").save(path, "JPEG", quality=92, optimize=True)


def main() -> None:
    source = np.array(Image.open(SRC).convert("RGBA"))
    fern, text = split_quote(source)
    stacked = stack_quote(fern, text)
    if not quote_is_below_fern(stacked):
        raise SystemExit("wording did not land below the fern")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(stacked, "RGBA").save(OUT, "PNG", optimize=True)
    white = paint_on_base(stacked)
    for path in WHITE_MOCKUPS:
        save_jpeg(path, white)
    save_jpeg(COLOR_MOCKUPS["black"], recolor_garment(white, (18, 18, 20)))
    save_jpeg(COLOR_MOCKUPS["navy"], recolor_garment(white, (22, 34, 68)))
    print(f"wrote {OUT.name}, white mockups, and {', '.join(COLOR_MOCKUPS)}")


if __name__ == "__main__":
    main()
