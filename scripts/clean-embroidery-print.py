#!/usr/bin/env python3
"""Turn a cream-backed embroidery still into a 1200×1200 transparent print file."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 1200


def knockout_cream(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.float32)
    g = rgb[:, :, 1].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    paper = (luma >= 198) & (chroma <= 22)
    h, w = paper.shape
    reach = np.zeros(paper.shape, dtype=bool)
    stack = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]
    for x in range(0, w, 8):
        stack.extend(((0, x), (h - 1, x)))
    for y in range(0, h, 8):
        stack.extend(((y, 0), (y, w - 1)))
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or reach[y, x] or not paper[y, x]:
            continue
        reach[y, x] = True
        stack.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))
    alpha = np.where(reach, 0, 255).astype(np.uint8)
    rgba = np.dstack((rgb, alpha))
    return rgba


def trim(rgba: np.ndarray, pad: int = 16) -> np.ndarray:
    ink = rgba[:, :, 3] > 12
    if not ink.any():
        raise SystemExit("embroidery source has no ink after knockout")
    ys, xs = np.nonzero(ink)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(rgba.shape[0], int(ys.max()) + pad + 1)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(rgba.shape[1], int(xs.max()) + pad + 1)
    return rgba[y0:y1, x0:x1]


def fit_square(rgba: np.ndarray, size: int = SIZE, fill: float = 0.9) -> np.ndarray:
    canvas = np.zeros((size, size, 4), dtype=np.uint8)
    image = Image.fromarray(rgba, "RGBA")
    scale = min((size * fill) / image.size[1], (size * fill) / image.size[0])
    nw = max(1, int(image.size[0] * scale))
    nh = max(1, int(image.size[1] * scale))
    resized = np.array(image.resize((nw, nh), Image.Resampling.LANCZOS))
    canvas[(size - nh) // 2 : (size - nh) // 2 + nh, (size - nw) // 2 : (size - nw) // 2 + nw] = resized
    return canvas


def clean_embroidery(source: Path, dest: Path) -> None:
    rgb = np.array(Image.open(source).convert("RGB"))
    rgba = fit_square(trim(knockout_cream(rgb)))
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(dest, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("dest")
    args = parser.parse_args()
    clean_embroidery(Path(args.source), Path(args.dest))
    print(f"wrote {args.dest}")


if __name__ == "__main__":
    main()
