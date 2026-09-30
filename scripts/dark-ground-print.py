#!/usr/bin/env python3
"""Recolor a light-ground logo so it reads on a black or dark garment.

The shirt or paper around the art is cleared. Dark neutral ink (outlines and
lettering) becomes the chosen light color. Gold, red, and other saturated
color stay. White shapes trapped inside the art, such as a banner, stay.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

INKS: dict[str, tuple[int, int, int]] = {
    "white": (247, 244, 238),
    "cream": (243, 224, 184),
    "gold": (224, 177, 90),
    "silver": (230, 232, 236),
}


def load_rgba(source: Path) -> np.ndarray:
    image = Image.open(source)
    if image.mode == "RGBA":
        return np.array(image)
    if image.mode == "RGB":
        rgb = np.array(image)
        alpha = np.full(rgb.shape[:2], 255, dtype=np.uint8)
        return np.dstack((rgb, alpha))
    return np.array(image.convert("RGBA"))


def luma_chroma(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    channels = rgb.astype(np.float32)
    red, green, blue = channels[:, :, 0], channels[:, :, 1], channels[:, :, 2]
    luma = 0.299 * red + 0.587 * green + 0.114 * blue
    chroma = np.maximum(np.maximum(red, green), blue) - np.minimum(np.minimum(red, green), blue)
    return luma, chroma


def dilate(mask: np.ndarray, radius: int = 1) -> np.ndarray:
    grown = mask.copy()
    for _ in range(radius):
        nxt = grown.copy()
        nxt[1:] |= grown[:-1]
        nxt[:-1] |= grown[1:]
        nxt[:, 1:] |= grown[:, :-1]
        nxt[:, :-1] |= grown[:, 1:]
        grown = nxt
    return grown


def flood_from_border(mask: np.ndarray) -> np.ndarray:
    if not mask.any():
        return mask
    step = 4
    small = mask[::step, ::step]
    seen = np.zeros(small.shape, dtype=bool)
    seen[0, :] = small[0, :]
    seen[-1, :] = small[-1, :]
    seen[:, 0] = small[:, 0]
    seen[:, -1] = small[:, -1]
    for _ in range(max(small.shape)):
        nxt = dilate(seen) & small
        if np.array_equal(nxt, seen):
            break
        seen = nxt
    full = np.repeat(np.repeat(seen, step, axis=0), step, axis=1)
    full = full[: mask.shape[0], : mask.shape[1]]
    full &= mask
    for _ in range(step * 3):
        nxt = dilate(full) & mask
        if np.array_equal(nxt, full):
            break
        full = nxt
    return full


def scale_longest(rgba: np.ndarray, longest: int) -> np.ndarray:
    height, width = rgba.shape[:2]
    if longest <= 0 or max(height, width) >= longest:
        return rgba
    scale = longest / max(height, width)
    resized = Image.fromarray(rgba, "RGBA").resize(
        (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
        Image.Resampling.LANCZOS,
    )
    return np.array(resized)


def connected_within(mask: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    seen = seeds & mask
    if not seen.any():
        return seen
    for _ in range(max(mask.shape)):
        nxt = dilate(seen) & mask
        if np.array_equal(nxt, seen):
            break
        seen = nxt
    return seen


def for_dark_ground(rgba: np.ndarray, ink: tuple[int, int, int]) -> np.ndarray:
    color = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    luma, chroma = luma_chroma(color)
    visible = alpha > 16
    ink_core = visible & (luma < 92) & (chroma < 32)
    light = visible & (luma > 205) & (chroma < 24)
    ground = flood_from_border(light)
    # Only ink that touches the cleared ground changes color. Lettering inside a
    # white banner, and detail sitting on gold, stays dark so it still reads.
    outer = connected_within(ink_core, ink_core & dilate(ground, 1))
    fringe = dilate(outer, 1) & ~ink_core & visible & ~ground & (chroma < 40) & (luma < 210)

    out = rgba.copy()
    out[ground, 3] = 0
    out[ground, :3] = 0
    out[outer, :3] = ink
    out[outer, 3] = 255
    if fringe.any():
        strength = np.clip((210.0 - luma) / (210.0 - 92.0), 0, 1)
        out[fringe, :3] = ink
        out[fringe, 3] = np.clip(strength[fringe] * 255, 0, 255).astype(np.uint8)
    empty = out[:, :, 3] == 0
    out[empty, :3] = 0
    return out


def write_dark_ground(source: Path, dest: Path, ink_name: str, dpi: int, longest: int) -> None:
    if ink_name not in INKS:
        raise SystemExit(f"Unknown ink {ink_name}. Choose {', '.join(INKS)}.")
    converted = for_dark_ground(load_rgba(source), INKS[ink_name])
    converted = scale_longest(converted, longest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(converted, "RGBA").save(dest, "PNG", dpi=(dpi, dpi))


def check() -> None:
    size = 80
    rgb = np.full((size, size, 3), 244, dtype=np.uint8)
    rgb[18:62, 18:62] = (54, 54, 54)
    rgb[28:52, 28:52] = (246, 246, 246)
    rgb[34:44, 34:44] = (190, 40, 48)
    rgb[46:50, 36:40] = (54, 54, 54)
    rgb[20:30, 64:74] = (150, 150, 150)
    source = Path("/tmp/dark-ground-check.png")
    dest = Path("/tmp/dark-ground-check-out.png")
    Image.fromarray(rgb, "RGB").save(source)
    write_dark_ground(source, dest, "white", 300, 0)
    out = np.array(Image.open(dest).convert("RGBA"))
    if int(out[0, 0, 3]) != 0:
        raise SystemExit("the light ground stayed opaque")
    banner = out[30, 30]
    if int(banner[3]) < 250 or int(banner[0]) < 230 or abs(int(banner[0]) - int(banner[2])) > 20:
        raise SystemExit(f"white trapped inside the art was cleared: {banner.tolist()}")
    line = out[22, 22]
    if int(line[3]) < 250 or int(line[0]) < 230:
        raise SystemExit(f"dark ink was not recolored for a dark ground: {line.tolist()}")
    rose = out[38, 38]
    if int(rose[0]) < 160 or int(rose[1]) > 80:
        raise SystemExit(f"saturated color was recolored: {rose.tolist()}")
    inner = out[48, 38]
    if int(inner[3]) < 250 or int(inner[0]) > 80:
        raise SystemExit(f"ink inside the art was recolored: {inner.tolist()}")
    gun = out[24, 68]
    if int(gun[3]) < 250 or abs(int(gun[0]) - 150) > 25:
        raise SystemExit(f"mid gray was recolored: {gun.tolist()}")
    print("ok dark ground print")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?")
    parser.add_argument("dest", nargs="?")
    parser.add_argument("--ink", default="white", choices=sorted(INKS))
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--longest", type=int, default=3000)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
        return
    if not args.source or not args.dest:
        raise SystemExit("source and dest are required")
    write_dark_ground(Path(args.source), Path(args.dest), args.ink, args.dpi, args.longest)
    print(f"wrote {args.dest} ink={args.ink}")


if __name__ == "__main__":
    main()
