#!/usr/bin/env python3
"""Build a flat DTG print of the rainbow fern, separate from embroidery and puff.

The still is stitch art on a cream checker. This knocks that ground out, closes
the thread gaps with neighboring ink, and leaves a transparent file with no
bevel or contact shadow.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "apparel-src" / "fern-bloom-source.png"
DEST = ROOT / "public" / "catalog" / "print-fern-dtg.png"
SIDE = 3600
DPI = 300


def ground_of(rgb: np.ndarray) -> np.ndarray:
    channels = rgb.astype(np.float32)
    red, green, blue = channels[:, :, 0], channels[:, :, 1], channels[:, :, 2]
    luma = 0.299 * red + 0.587 * green + 0.114 * blue
    chroma = np.maximum(np.maximum(red, green), blue) - np.minimum(np.minimum(red, green), blue)
    return (chroma <= 28) & (luma >= 185)


def close_coverage(ground: np.ndarray) -> np.ndarray:
    alpha = Image.fromarray(np.where(ground, 0, 255).astype(np.uint8), "L")
    # Fill stitch gaps, then drop specks that are not part of the fern.
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return np.array(alpha)


def bleed_ink(rgb: np.ndarray, ground: np.ndarray, coverage: np.ndarray) -> np.ndarray:
    """Keep thread color, and paint closed gaps with nearby ink instead of cream."""
    ink = ~ground
    amount = ink.astype(np.float32)
    premul = rgb.astype(np.float32) * amount[..., None]
    color = Image.fromarray(np.clip(premul, 0, 255).astype(np.uint8), "RGB")
    weight = Image.fromarray(np.clip(amount * 255, 0, 255).astype(np.uint8), "L")
    color = np.array(color.filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32)
    weight = np.array(weight.filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255.0
    filled = np.where(weight[..., None] > 0.04, color / np.maximum(weight[..., None], 1e-3), 0)
    out = np.where(ink[..., None], rgb, filled)
    out[~((coverage > 0))] = 0
    return np.clip(out, 0, 255).astype(np.uint8)


def crisp_ink(color: Image.Image, alpha: np.ndarray) -> np.ndarray:
    sharp = np.array(color.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2)))
    solid = alpha > 220
    base = np.array(color)
    mixed = np.where(solid[..., None], sharp, base)
    mixed[alpha == 0] = 0
    return mixed


def flat(rgb: np.ndarray, side: int) -> np.ndarray:
    ground = ground_of(rgb)
    coverage = close_coverage(ground)
    color = bleed_ink(rgb, ground, coverage)
    height, width = rgb.shape[:2]
    scale = side / max(height, width)
    fitted = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    color_im = Image.fromarray(color, "RGB").resize(fitted, Image.Resampling.LANCZOS)
    alpha_im = Image.fromarray(coverage, "L").resize(fitted, Image.Resampling.LANCZOS)
    alpha = np.array(alpha_im)
    alpha[alpha < 6] = 0
    rgb_out = crisp_ink(color_im, alpha)
    piece = np.dstack([rgb_out, alpha])
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    y0 = (side - fitted[1]) // 2
    x0 = (side - fitted[0]) // 2
    canvas[y0 : y0 + fitted[1], x0 : x0 + fitted[0]] = piece
    return canvas


def build(source: Path, dest: Path, side: int, dpi: int) -> None:
    rgb = np.array(Image.open(source).convert("RGB"))
    canvas = flat(rgb, side)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(canvas, "RGBA").save(dest, "PNG", dpi=(dpi, dpi))


def check() -> None:
    rgb = np.full((48, 48, 3), 236, dtype=np.uint8)
    rgb[16:32, 18:34] = (40, 140, 70)
    rgb[23:25, 25:27] = 236
    ground = ground_of(rgb)
    coverage = close_coverage(ground)
    if not ground[0, 0] or not ground[24, 26]:
        raise SystemExit("dtg ground test missed the cream or the stitch hole")
    if int(coverage[0, 0]) != 0 or int(coverage[24, 26]) < 200:
        raise SystemExit("dtg coverage missed the ink or left a stitch hole")
    out = flat(rgb, 96)
    if out.shape != (96, 96, 4) or int(out[0, 0, 3]) != 0:
        raise SystemExit("dtg canvas did not stay transparent at the corner")
    if int(out[:, :, 3].max()) < 200:
        raise SystemExit("dtg canvas has no ink")
    # A flat print has no offset contact shadow, so a corner stays empty.
    if int(out[2, 2, 3]) != 0:
        raise SystemExit("dtg canvas picked up a shadow")
    print("ok fern dtg")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--side", type=int, default=SIDE)
    args = parser.parse_args()
    if args.check:
        check()
        return
    if not SOURCE.exists():
        raise SystemExit(f"missing fern source {SOURCE}")
    build(SOURCE, DEST, args.side, DPI)
    print(f"wrote {DEST} {args.side}x{args.side} @ {DPI} dpi")


if __name__ == "__main__":
    main()
