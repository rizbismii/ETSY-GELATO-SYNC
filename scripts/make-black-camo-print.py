#!/usr/bin/env python3
"""Original Fernora black-camo tile for men’s mesh sneakers. Not a licensed military pattern."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"
SIZE = (1944, 1875)
RNG = np.random.default_rng(6012)

COLORS = np.array(
    [
        (6, 6, 6),
        (20, 20, 18),
        (38, 40, 34),
        (82, 82, 76),
        (16, 28, 18),
    ],
    dtype=np.uint8,
)


def wrap_blur(plane: np.ndarray, radius: int) -> np.ndarray:
    pad = radius * 3
    tiled = np.pad(plane, pad, mode="wrap")
    img = Image.fromarray(np.clip(tiled * 255, 0, 255).astype(np.uint8), "L")
    img = img.filter(ImageFilter.GaussianBlur(radius=radius))
    crop = np.asarray(img, dtype=np.float32)[pad:-pad, pad:-pad] / 255.0
    return crop


def field(h: int, w: int, cells: int, radius: int) -> np.ndarray:
    coarse = RNG.random((cells, cells)).astype(np.float32)
    up = np.asarray(Image.fromarray(coarse, "F").resize((w, h), Image.Resampling.BICUBIC), dtype=np.float32)
    return wrap_blur(up, radius)


def fern(draw: ImageDraw.ImageDraw, x: float, y: float, length: float, angle: float, depth: int, fill: tuple[int, int, int]) -> None:
    if depth <= 0 or length < 10:
        return
    rad = np.deg2rad(angle)
    x2 = x + np.cos(rad) * length
    y2 = y + np.sin(rad) * length
    width = max(1, int(length / 18))
    draw.line([(x, y), (x2, y2)], fill=fill, width=width)
    fern(draw, x2, y2, length * 0.62, angle - 28, depth - 1, fill)
    fern(draw, x2, y2, length * 0.62, angle + 26, depth - 1, fill)
    fern(draw, x2, y2, length * 0.72, angle - 2, depth - 1, fill)


def main() -> None:
    w, h = SIZE
    a = field(h, w, 18, 28)
    b = field(h, w, 36, 14)
    c = field(h, w, 72, 7)
    mix = 0.52 * a + 0.33 * b + 0.15 * c
    mix = (mix - mix.min()) / (mix.max() - mix.min() + 1e-6)
    bands = np.digitize(mix, [0.22, 0.42, 0.62, 0.80], right=True)
    rgb = COLORS[np.clip(bands, 0, len(COLORS) - 1)]
    img = Image.fromarray(rgb, "RGB")
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    placements = (
        (180, 220, 210, -70),
        (980, 640, 180, 40),
        (1500, 260, 160, 200),
        (420, 1280, 190, -20),
        (1280, 1420, 170, 155),
        (720, 980, 130, 95),
    )
    for x, y, length, angle in placements:
        fern(draw, x, y, length, angle, 5, (12, 16, 13, 210))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    print_path = OUT / "print-camo-sneakers.png"
    img.save(print_path, "PNG", optimize=True)
    detail = img.crop((360, 280, 1480, 1360)).resize((1400, 1400), Image.Resampling.LANCZOS)
    close = img.crop((720, 620, 1220, 1100)).resize((1200, 1200), Image.Resampling.LANCZOS)
    detail.save(OUT / "gallery-live_sneaker_star-camo-detail.png", "PNG", optimize=True)
    close.save(OUT / "gallery-live_sneaker_star-camo-close.png", "PNG", optimize=True)
    detail.save(OUT / "gallery-live_sneaker_star-detail.png", "PNG", optimize=True)
    close.save(OUT / "gallery-live_sneaker_star-close.png", "PNG", optimize=True)
    print(print_path, img.size, print_path.stat().st_size)


if __name__ == "__main__":
    main()
