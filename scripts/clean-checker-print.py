#!/usr/bin/env python3
"""Turn a Gemini checkerboard JPEG into a transparent Printify file.

Gemini paints the transparency grid into the pixels. Those grays print on the
garment. This knocks them out, then fits the art on a transparent canvas.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def knockout_checker(rgb: np.ndarray, alpha: np.ndarray | None = None) -> np.ndarray:
    """Drop baked checkerboard grays, including squares trapped inside the art."""
    channels = rgb.astype(np.float32)
    red, green, blue = channels[:, :, 0], channels[:, :, 1], channels[:, :, 2]
    luma = 0.299 * red + 0.587 * green + 0.114 * blue
    chroma = np.maximum(np.maximum(red, green), blue) - np.minimum(np.minimum(red, green), blue)
    background = (chroma <= 20) & (luma >= 168) & (luma <= 243)
    # JPEG ringing leaves a gray lip on the ink. Clear that lip too.
    neighbor = np.zeros(background.shape, dtype=bool)
    neighbor[1:] |= background[:-1]
    neighbor[:-1] |= background[1:]
    neighbor[:, 1:] |= background[:, :-1]
    neighbor[:, :-1] |= background[:, 1:]
    fringe = neighbor & ~background & (chroma <= 28) & (luma >= 165) & (luma <= 246)
    cleared = background | fringe
    next_alpha = np.where(cleared, 0, 255).astype(np.uint8)
    if alpha is not None:
        next_alpha = np.minimum(alpha, next_alpha)
    out = np.dstack((rgb, next_alpha))
    out[next_alpha == 0, :3] = 0
    return out


def fit_canvas(rgba: np.ndarray, width: int, height: int) -> np.ndarray:
    """Scale with premultiplied alpha so the checker gray does not halo."""
    source_h, source_w = rgba.shape[:2]
    scale = min(width / source_w, height / source_h)
    fitted_w = min(width, max(1, int(round(source_w * scale))))
    fitted_h = min(height, max(1, int(round(source_h * scale))))
    straight = rgba.astype(np.float32)
    coverage = straight[:, :, 3:4] / 255.0
    straight[:, :, :3] *= coverage
    resized = np.array(
        Image.fromarray(np.clip(straight, 0, 255).astype(np.uint8), "RGBA").resize(
            (fitted_w, fitted_h),
            Image.Resampling.LANCZOS,
        )
    ).astype(np.float32)
    coverage = resized[:, :, 3:4]
    color = np.zeros_like(resized[:, :, :3])
    visible = coverage[:, :, 0] > 0
    color[visible] = resized[:, :, :3][visible] / np.maximum(coverage[visible] / 255.0, 1e-6)
    piece = np.zeros((fitted_h, fitted_w, 4), dtype=np.uint8)
    piece[:, :, :3] = np.clip(color, 0, 255)
    piece[:, :, 3] = np.clip(coverage[:, :, 0], 0, 255)
    canvas = np.zeros((height, width, 4), dtype=np.uint8)
    y0 = (height - fitted_h) // 2
    x0 = (width - fitted_w) // 2
    canvas[y0 : y0 + fitted_h, x0 : x0 + fitted_w] = piece
    return canvas


def clean_checker_print(source: Path, dest: Path, width: int, height: int, dpi: int) -> None:
    rgb = np.array(Image.open(source).convert("RGB"))
    canvas = fit_canvas(knockout_checker(rgb), width, height)
    # Upscale can blend the old gray back in along edges. Clear it again.
    canvas = knockout_checker(canvas[:, :, :3], canvas[:, :, 3])
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(canvas, "RGBA").save(dest, "PNG", dpi=(dpi, dpi), optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("dest")
    parser.add_argument("--width", type=int, default=3852)
    parser.add_argument("--height", type=int, default=4398)
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args()
    clean_checker_print(Path(args.source), Path(args.dest), args.width, args.height, args.dpi)
    print(f"wrote {args.dest} {args.width}x{args.height} @ {args.dpi} dpi")


if __name__ == "__main__":
    main()
