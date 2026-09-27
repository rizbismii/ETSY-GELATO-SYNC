#!/usr/bin/env python3
"""Build a raised DTG puff print of the rainbow fern, separate from embroidery.

The still is stitch art on a cream checker. This knocks that ground out, melts
the thread into solid ink, and adds a soft top light plus a contact shadow so
the print reads as puff ink on a garment.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "apparel-src" / "fern-bloom-source.png"
DEST = ROOT / "public" / "catalog" / "print-fern-puff-dtg.png"
SIDE = 3600
DPI = 300


def knockout(rgb: np.ndarray) -> np.ndarray:
    channels = rgb.astype(np.float32)
    red, green, blue = channels[:, :, 0], channels[:, :, 1], channels[:, :, 2]
    luma = 0.299 * red + 0.587 * green + 0.114 * blue
    chroma = np.maximum(np.maximum(red, green), blue) - np.minimum(np.minimum(red, green), blue)
    ground = (chroma <= 28) & (luma >= 185)
    alpha = Image.fromarray(np.where(ground, 0, 255).astype(np.uint8), "L")
    # Fill stitch gaps, then drop specks that are not part of the fern.
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return np.array(alpha)


def puff(rgb: np.ndarray, alpha: np.ndarray, side: int) -> np.ndarray:
    height, width = rgb.shape[:2]
    scale = side / max(height, width)
    fitted = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    color = Image.fromarray(rgb, "RGB").resize(fitted, Image.Resampling.LANCZOS)
    color = color.filter(ImageFilter.GaussianBlur(1.4))
    coverage = Image.fromarray(alpha, "L").resize(fitted, Image.Resampling.LANCZOS)
    coverage = coverage.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    col = np.array(color).astype(np.float32)
    mask = np.array(coverage).astype(np.float32) / 255.0
    height_map = np.array(coverage.filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255.0
    gy, gx = np.gradient(height_map)
    shade = -gx * 0.65 - gy
    peak = float(np.percentile(np.abs(shade), 98)) + 1e-6
    shade = np.clip(shade / peak, -1, 1)
    lit = np.clip(col * (1 + 0.28 * shade[..., None]) + np.clip(shade, 0, 1)[..., None] * 16, 0, 255)
    shadow = coverage.filter(ImageFilter.GaussianBlur(8))
    shadow = shadow.transform(shadow.size, Image.AFFINE, (1, 0, -14, 0, 1, -18), fillcolor=0)
    shade_a = np.array(shadow).astype(np.float32) / 255.0 * 0.42
    out = np.zeros((fitted[1], fitted[0], 4), dtype=np.float32)
    out[:, :, 3] = shade_a * 255
    body = np.clip(mask, 0, 1)
    under = out[:, :, 3] / 255.0
    over = body + under * (1 - body)
    mixed = lit * body[..., None] + out[:, :, :3] * under[..., None] * (1 - body[..., None])
    out[:, :, :3] = np.where(over[..., None] > 0, mixed / np.maximum(over[..., None], 1e-6), 0)
    out[:, :, 3] = over * 255
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    y0 = (side - fitted[1]) // 2
    x0 = (side - fitted[0]) // 2
    piece = np.clip(out, 0, 255).astype(np.uint8)
    piece[piece[:, :, 3] == 0, :3] = 0
    canvas[y0 : y0 + fitted[1], x0 : x0 + fitted[0]] = piece
    return canvas


def build(source: Path, dest: Path, side: int, dpi: int) -> None:
    rgb = np.array(Image.open(source).convert("RGB"))
    canvas = puff(rgb, knockout(rgb), side)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(canvas, "RGBA").save(dest, "PNG", dpi=(dpi, dpi))


def check() -> None:
    rgb = np.full((48, 48, 3), 236, dtype=np.uint8)
    rgb[16:32, 18:34] = (40, 140, 70)
    alpha = knockout(rgb)
    if int(alpha[0, 0]) != 0 or int(alpha[24, 26]) < 200:
        raise SystemExit("puff knockout missed the ground or the ink")
    out = puff(rgb, alpha, 96)
    if out.shape != (96, 96, 4) or int(out[0, 0, 3]) != 0:
        raise SystemExit("puff canvas did not stay transparent at the corner")
    if int(out[:, :, 3].max()) < 200:
        raise SystemExit("puff canvas has no ink")
    print("ok puff dtg")


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
