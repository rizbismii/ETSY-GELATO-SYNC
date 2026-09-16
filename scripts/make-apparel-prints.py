#!/usr/bin/env python3
"""Build transparent DTG print files that match catalog garment mockups.

Sources stay in scripts/apparel-src (cream/black posters). Outputs are RGBA
PNGs in public/catalog: ink only, no paper square. Hoodie art is a sage filled
circle + fern like catalog-hoodie.png, not the cream poster with a thin ring.
"""

from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "apparel-src"
OUT = ROOT / "public" / "catalog"
PREVIEW = ROOT / "scripts" / "apparel-preview"
SIZE = 3600


def save_rgba(path: Path, pixels: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels, "RGBA").save(path, "PNG", optimize=True)


def upscale(rgba: np.ndarray, size: int = SIZE) -> np.ndarray:
    im = Image.fromarray(rgba, "RGBA")
    if im.size != (size, size):
        im = im.resize((size, size), Image.Resampling.LANCZOS)
    return np.array(im)


def sample_sage(catalog: np.ndarray) -> np.ndarray:
    r, g, b = catalog[:, :, 0].astype(np.float32), catalog[:, :, 1].astype(np.float32), catalog[:, :, 2].astype(np.float32)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    sage = (g > r + 4) & (g > b + 4) & (luma > 95) & (luma < 165) & (g < 175)
    if sage.sum() < 200:
        return np.array([139, 148, 110], dtype=np.uint8)
    return np.median(catalog[sage], axis=0).astype(np.uint8)


def knockout_light(rgb: np.ndarray, luma_cut: float = 208, chroma_cut: float = 32) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.float32), rgb[:, :, 1].astype(np.float32), rgb[:, :, 2].astype(np.float32)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    cream = (luma > luma_cut) & (chroma < chroma_cut)
    alpha = np.zeros(luma.shape, dtype=np.uint8)
    alpha[~cream] = 255
    fade = (~cream) & (luma > luma_cut - 18)
    alpha[fade] = np.clip((luma_cut + 8 - luma[fade]) * (255 / 26), 0, 255).astype(np.uint8)
    return np.dstack([rgb, alpha])


def knockout_dark(rgb: np.ndarray, luma_cut: float = 42) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.float32), rgb[:, :, 1].astype(np.float32), rgb[:, :, 2].astype(np.float32)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    alpha = np.clip((luma - luma_cut) * (255 / 36), 0, 255).astype(np.uint8)
    return np.dstack([rgb, alpha])


def hoodie_emblem(rgb: np.ndarray, sage: np.ndarray, size: int = SIZE) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.float32), rgb[:, :, 1].astype(np.float32), rgb[:, :, 2].astype(np.float32)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    cream = luma > 200
    ink = luma < 90
    ring = ~cream & ~ink
    ys, xs = np.nonzero(ring | ink)
    cy, cx = float(ys.mean()), float(xs.mean())
    dist = np.sqrt((ys - cy) ** 2 + (xs - cx) ** 2)
    radius = float(np.percentile(dist, 97))
    h = luma.shape[0]
    scale = size / h
    fern = np.zeros((h, rgb.shape[1], 4), dtype=np.uint8)
    fern[ink, :3] = rgb[ink]
    fern[ink, 3] = 255
    fern = upscale(fern, size)
    out = np.zeros((size, size, 4), dtype=np.uint8)
    yy, xx = np.ogrid[:size, :size]
    inside = np.sqrt((yy - cy * scale) ** 2 + (xx - cx * scale) ** 2) <= radius * scale + 1
    out[inside, :3] = sage
    out[inside, 3] = 255
    alpha = fern[:, :, 3:4].astype(np.float32) / 255.0
    out[:, :, :3] = np.clip(fern[:, :, :3] * alpha + out[:, :, :3] * (1.0 - alpha), 0, 255).astype(np.uint8)
    out[:, :, 3] = np.maximum(out[:, :, 3], fern[:, :, 3])
    return out


def composite(rgba: np.ndarray, ground: tuple[int, int, int], size: int = 720) -> np.ndarray:
    art = Image.fromarray(rgba, "RGBA").resize((size, size), Image.Resampling.LANCZOS)
    base = Image.new("RGB", (size, size), ground)
    base.paste(art, mask=art.split()[-1])
    return np.array(base.convert("RGBA"))


def main() -> None:
    hoodie_src = np.array(Image.open(SRC / "hoodie-fern-mark.png").convert("RGB"))
    tee_src = np.array(Image.open(SRC / "be-kind.png").convert("RGB"))
    sweat_src = np.array(Image.open(SRC / "soft-days.png").convert("RGB"))
    catalog = np.array(Image.open(OUT / "catalog-hoodie.png").convert("RGB"))
    sampled = sample_sage(catalog)
    sage = np.clip(
        sampled.astype(np.float32) * 0.35 + np.array([139, 148, 110], dtype=np.float32) * 0.65,
        0,
        255,
    ).astype(np.uint8)

    hoodie = hoodie_emblem(hoodie_src, sage)
    tee = upscale(knockout_light(tee_src))
    sweat = upscale(knockout_dark(sweat_src))

    save_rgba(OUT / "print-hoodie-fern-mark.png", hoodie)
    save_rgba(OUT / "print-be-kind.png", tee)
    save_rgba(OUT / "print-soft-days.png", sweat)

    PREVIEW.mkdir(parents=True, exist_ok=True)
    save_rgba(PREVIEW / "hoodie-on-black.png", composite(hoodie, (18, 18, 18)))
    save_rgba(PREVIEW / "hoodie-on-white.png", composite(hoodie, (245, 245, 245)))
    save_rgba(PREVIEW / "tee-on-cream.png", composite(tee, (245, 234, 220)))
    save_rgba(PREVIEW / "tee-on-black.png", composite(tee, (18, 18, 18)))
    save_rgba(PREVIEW / "sweat-on-black.png", composite(sweat, (12, 12, 12)))
    save_rgba(PREVIEW / "sweat-on-white.png", composite(sweat, (245, 245, 245)))

    print("sage", sage.tolist())
    for name, arr in (
        ("print-hoodie-fern-mark.png", hoodie),
        ("print-be-kind.png", tee),
        ("print-soft-days.png", sweat),
    ):
        alpha = arr[:, :, 3]
        print(
            name,
            arr.shape[:2],
            "transparent%",
            round(float((alpha < 8).mean()) * 100, 1),
            "opaque%",
            round(float((alpha > 250).mean()) * 100, 1),
            "alpha",
            int(alpha.min()),
            int(alpha.max()),
        )


if __name__ == "__main__":
    main()
