#!/usr/bin/env python3
"""Build Gelato print files that match catalog mockups.

Clothing and totes are RGBA DTG (ink only). Mugs are wrap files. Phone case
knocks out cream paper. Sources for apparel stay in scripts/apparel-src.
"""

from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "apparel-src"
PRINT_SRC = ROOT / "scripts" / "print-src"
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


def flood(mask: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    h, w = mask.shape
    out = np.zeros_like(mask, dtype=bool)
    stack = [seed]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or out[y, x] or not mask[y, x]:
            continue
        x0 = x
        while x0 > 0 and mask[y, x0 - 1] and not out[y, x0 - 1]:
            x0 -= 1
        x1 = x
        while x1 < w - 1 and mask[y, x1 + 1] and not out[y, x1 + 1]:
            x1 += 1
        out[y, x0 : x1 + 1] = True
        for xx in range(x0, x1 + 1):
            if y > 0 and mask[y - 1, xx] and not out[y - 1, xx]:
                stack.append((y - 1, xx))
            if y < h - 1 and mask[y + 1, xx] and not out[y + 1, xx]:
                stack.append((y + 1, xx))
    return out


def fit_on_square(rgba: np.ndarray, size: int = SIZE, fill: float = 0.84) -> np.ndarray:
    canvas = np.zeros((size, size, 4), dtype=np.uint8)
    h, w = rgba.shape[:2]
    scale = min((size * fill) / h, (size * fill) / w)
    nh, nw = max(1, int(h * scale)), max(1, int(w * scale))
    resized = np.array(Image.fromarray(rgba, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS))
    y, x = (size - nh) // 2, (size - nw) // 2
    canvas[y : y + nh, x : x + nw] = resized
    return canvas


def tote_fern_from_catalog(catalog: np.ndarray) -> np.ndarray:
    r, g, b = catalog[:, :, 0].astype(np.float32), catalog[:, :, 1].astype(np.float32), catalog[:, :, 2].astype(np.float32)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    h, w = luma.shape
    yy, xx = np.ogrid[:h, :w]
    bag = (xx > 320) & (xx < 700) & (yy > 360) & (yy < 800)
    dark = (luma < 115) & bag
    cy, cx = 615, 510
    if not dark[cy, cx]:
        ys, xs = np.nonzero(dark)
        dist = (ys - cy) ** 2 + (xs - cx) ** 2
        i = int(np.argmin(dist))
        cy, cx = int(ys[i]), int(xs[i])
    mask = flood(dark, (cy, cx))
    ys, xs = np.nonzero(mask)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    ink = catalog[mask].astype(np.float32)
    out[mask, :3] = np.clip(ink * 0.4 + np.array([42, 45, 40]) * 0.6, 0, 255).astype(np.uint8)
    out[mask, 3] = 255
    pad = 16
    crop = out[max(0, ys.min() - pad) : min(h, ys.max() + pad), max(0, xs.min() - pad) : min(w, xs.max() + pad)]
    return fit_on_square(crop)


def scale_longest(rgba: np.ndarray, longest: int) -> np.ndarray:
    im = Image.fromarray(rgba, "RGBA")
    w, h = im.size
    if max(w, h) == longest:
        return rgba
    scale = longest / max(w, h)
    return np.array(im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS))


def mug_sage_band(fern_rgba: np.ndarray, width: int = 2700, height: int = 1140) -> np.ndarray:
    wrap = np.zeros((height, width, 4), dtype=np.uint8)
    wrap[:, :, :3] = 255
    wrap[:, :, 3] = 255
    sage = np.array([168, 176, 145], dtype=np.uint8)
    border = np.array([132, 142, 108], dtype=np.uint8)
    fern_ink = np.array([72, 98, 58], dtype=np.uint8)
    top, bot = int(height * 0.30), int(height * 0.70)
    wrap[top:bot, :, :3] = sage
    wrap[top : top + 16, :, :3] = border
    wrap[bot - 16 : bot, :, :3] = border
    stamp = Image.fromarray(fern_rgba, "RGBA")
    stamp.thumbnail((150, 200), Image.Resampling.LANCZOS)
    stamp = np.array(stamp)
    tinted = stamp.copy()
    tinted[:, :, :3] = fern_ink
    sh, sw = tinted.shape[:2]
    step = sw + 36
    y_mid = top + (bot - top - sh) // 2
    for i, x in enumerate(range(-sw // 4, width, step)):
        paste_rgba(wrap, tinted, x, y_mid + (-10 if i % 2 else 10))
    return wrap


def paste_rgba(dst: np.ndarray, src: np.ndarray, x: int, y: int) -> None:
    sh, sw = src.shape[:2]
    dh, dw = dst.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dw, x + sw), min(dh, y + sh)
    if x1 <= x0 or y1 <= y0:
        return
    sx0, sy0 = x0 - x, y0 - y
    patch = src[sy0 : sy0 + (y1 - y0), sx0 : sx0 + (x1 - x0)]
    a = patch[:, :, 3:4].astype(np.float32) / 255.0
    dst[y0:y1, x0:x1, :3] = np.clip(patch[:, :, :3] * a + dst[y0:y1, x0:x1, :3] * (1.0 - a), 0, 255).astype(np.uint8)
    dst[y0:y1, x0:x1, 3] = np.maximum(dst[y0:y1, x0:x1, 3], patch[:, :, 3])


def mug_letter_wrap(rgb: np.ndarray, width: int = 2700, height: int = 1140) -> np.ndarray:
    luma = 0.299 * rgb[:, :, 0].astype(np.float32) + 0.587 * rgb[:, :, 1].astype(np.float32) + 0.114 * rgb[:, :, 2].astype(np.float32)
    rows = luma.mean(axis=1) < 80
    if not rows.any():
        band = rgb
    else:
        ys = np.nonzero(rows)[0]
        band = rgb[ys.min() : ys.max() + 1]
    im = Image.fromarray(band, "RGB")
    scale = width / im.size[0]
    nh = max(1, int(im.size[1] * scale))
    resized = im.resize((width, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), (10, 10, 10))
    if nh >= height:
        resized = im.resize((width, height), Image.Resampling.LANCZOS)
        canvas.paste(resized, (0, 0))
    else:
        canvas.paste(resized, (0, (height - nh) // 2))
    return np.array(canvas.convert("RGBA"))


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
    tote = tote_fern_from_catalog(np.array(Image.open(OUT / "catalog-tote.png").convert("RGB")))
    grow = upscale(knockout_dark(np.array(Image.open(PRINT_SRC / "grow-anyway.png").convert("RGB"))))
    mug = mug_sage_band(tote)
    morning = mug_letter_wrap(np.array(Image.open(PRINT_SRC / "good-morning.png").convert("RGB")))
    case = scale_longest(
        knockout_light(np.array(Image.open(PRINT_SRC / "belong-here.png").convert("RGB")), luma_cut=230, chroma_cut=28),
        2400,
    )

    save_rgba(OUT / "print-hoodie-fern-mark.png", hoodie)
    save_rgba(OUT / "print-be-kind.png", tee)
    save_rgba(OUT / "print-soft-days.png", sweat)
    save_rgba(OUT / "print-tote-fern-spray.png", tote)
    save_rgba(OUT / "print-grow-anyway.png", grow)
    save_rgba(OUT / "print-mug-fern-band.png", mug)
    save_rgba(OUT / "print-good-morning.png", morning)
    save_rgba(OUT / "print-belong-here.png", case)

    PREVIEW.mkdir(parents=True, exist_ok=True)
    save_rgba(PREVIEW / "hoodie-on-black.png", composite(hoodie, (18, 18, 18)))
    save_rgba(PREVIEW / "hoodie-on-white.png", composite(hoodie, (245, 245, 245)))
    save_rgba(PREVIEW / "tee-on-cream.png", composite(tee, (245, 234, 220)))
    save_rgba(PREVIEW / "tee-on-black.png", composite(tee, (18, 18, 18)))
    save_rgba(PREVIEW / "sweat-on-black.png", composite(sweat, (12, 12, 12)))
    save_rgba(PREVIEW / "sweat-on-white.png", composite(sweat, (245, 245, 245)))
    save_rgba(PREVIEW / "tote-on-natural.png", composite(tote, (232, 222, 205)))
    save_rgba(PREVIEW / "grow-on-black.png", composite(grow, (12, 12, 12)))
    save_rgba(PREVIEW / "mug-band.png", mug)
    save_rgba(PREVIEW / "mug-morning.png", morning)
    save_rgba(PREVIEW / "case-on-cream.png", composite(case, (245, 238, 226), size=640))

    print("sage", sage.tolist())
    for name, arr in (
        ("print-hoodie-fern-mark.png", hoodie),
        ("print-be-kind.png", tee),
        ("print-soft-days.png", sweat),
        ("print-tote-fern-spray.png", tote),
        ("print-grow-anyway.png", grow),
        ("print-mug-fern-band.png", mug),
        ("print-good-morning.png", morning),
        ("print-belong-here.png", case),
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
