#!/usr/bin/env python3
"""Turn a Gemini print into a transparent, sharp Printify file.

Gemini either paints the transparency grid into the pixels or hands back a
cut-out whose empty pixels are stored as black. Flattening that black and
deleting every pale gray chews the drawing. This keeps ink, drops only the
real background, and does not resample a file that is already the right size.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, PngImagePlugin


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


def dilate(mask: np.ndarray) -> np.ndarray:
    grown = mask.copy()
    grown[1:] |= mask[:-1]
    grown[:-1] |= mask[1:]
    grown[:, 1:] |= mask[:, :-1]
    grown[:, :-1] |= mask[:, 1:]
    return grown


def flood_from_border(mask: np.ndarray) -> np.ndarray:
    """Border-connected background. A coarse pass, then a short full-size cleanup."""
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


def zero_rgb(rgba: np.ndarray) -> np.ndarray:
    rgba = rgba.copy()
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return rgba


def fit_canvas(rgba: np.ndarray, width: int, height: int) -> np.ndarray:
    """Place the art on the print canvas. Skip resampling when the size already matches."""
    source_h, source_w = rgba.shape[:2]
    if source_w == width and source_h == height:
        return zero_rgb(rgba)
    scale = min(width / source_w, height / source_h)
    fitted_w = min(width, max(1, int(round(source_w * scale))))
    fitted_h = min(height, max(1, int(round(source_h * scale))))
    straight = rgba.astype(np.float32)
    straight[:, :, :3] *= straight[:, :, 3:4] / 255.0
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
    piece = crisp_ink(piece)
    canvas = np.zeros((height, width, 4), dtype=np.uint8)
    y0 = (height - fitted_h) // 2
    x0 = (width - fitted_w) // 2
    canvas[y0 : y0 + fitted_h, x0 : x0 + fitted_w] = piece
    return canvas


def crisp_ink(rgba: np.ndarray) -> np.ndarray:
    """Sharpen only solid ink. Soft edges and empty pixels stay as they are."""
    color = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    blur = color.copy()
    blur[1:-1, 1:-1] = (
        color[:-2, 1:-1] + color[2:, 1:-1] + color[1:-1, :-2] + color[1:-1, 2:] + color[1:-1, 1:-1] * 2.0
    ) / 6.0
    sharp = np.clip(color + 0.7 * (color - blur), 0, 255)
    out = rgba.copy()
    solid = alpha > 220
    out[:, :, :3][solid] = sharp[solid]
    return out


def clean_cutout(rgba: np.ndarray) -> np.ndarray:
    """Keep a transparent file. Drop only invisible dust, not the drawing."""
    out = rgba.copy()
    dust = out[:, :, 3] < 6
    out[dust, 3] = 0
    return zero_rgb(out)


def clean_black(rgba: np.ndarray) -> np.ndarray:
    """Remove a solid black matte that touches the edge. Leave dark ink inside the art."""
    luma, chroma = luma_chroma(rgba[:, :, :3])
    matte = (luma <= 26) & (chroma <= 14) & (rgba[:, :, 3] > 0)
    cleared = flood_from_border(matte)
    fringe = dilate(cleared) & ~cleared & (luma <= 36) & (chroma <= 16)
    out = rgba.copy()
    out[cleared | fringe, 3] = 0
    return zero_rgb(out)


def clean_white(rgba: np.ndarray) -> np.ndarray:
    """Remove a white page that touches the edge. Leave white ink enclosed by the drawing."""
    luma, chroma = luma_chroma(rgba[:, :, :3])
    matte = (luma >= 246) & (chroma <= 12) & (rgba[:, :, 3] > 0)
    cleared = flood_from_border(matte)
    fringe = dilate(cleared) & ~cleared & (luma >= 230) & (chroma <= 18)
    out = rgba.copy()
    out[cleared | fringe, 3] = 0
    return zero_rgb(out)


def paper_islands(pale: np.ndarray, color: np.ndarray, min_plate: int) -> np.ndarray:
    """Pale pieces the wreath sealed off, plus specks that are not sitting on colored ink."""
    if not pale.any():
        return pale
    height, width = pale.shape
    seen = np.zeros((height, width), dtype=bool)
    drop = np.zeros((height, width), dtype=bool)
    colored = dilate(color)
    ys, xs = np.where(pale)
    for y, x in zip(ys.tolist(), xs.tolist()):
        if seen[y, x]:
            continue
        stack = [(y, x)]
        seen[y, x] = True
        pts: list[tuple[int, int]] = []
        touches_ink = False
        while stack:
            cy, cx = stack.pop()
            pts.append((cy, cx))
            if colored[cy, cx]:
                touches_ink = True
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < height and 0 <= nx < width and pale[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        # A large pale piece is trapped paper, even where it touches the drawing.
        # A small piece stays only when it is a highlight on colored ink.
        if len(pts) >= min_plate or not touches_ink:
            for cy, cx in pts:
                drop[cy, cx] = True
    return drop


def clean_paper(rgba: np.ndarray) -> np.ndarray:
    """Drop a pale plate, including paper a wreath has sealed in. Light ink on the drawing stays."""
    luma, chroma = luma_chroma(rgba[:, :, :3])
    alpha = rgba[:, :, 3]
    pale = (luma >= 176) & (chroma <= 34) & (alpha > 0)
    if int(pale.sum()) < 40:
        return rgba
    reached = flood_from_border(pale | (alpha == 0))
    cleared = reached & pale
    min_plate = max(800, (rgba.shape[0] * rgba.shape[1]) // 8000)
    cleared = cleared | paper_islands(pale & ~cleared, (chroma > 40) & (alpha > 80), min_plate)
    if int(cleared.sum()) < 40:
        return rgba
    fringe = cleared
    grown = cleared
    for _ in range(4):
        fringe = dilate(fringe) & ~grown & (luma >= 165) & (chroma <= 30) & (alpha > 0)
        grown = grown | fringe
    out = rgba.copy()
    out[grown, 3] = 0
    return zero_rgb(out)


def border_samples(values: np.ndarray) -> np.ndarray:
    return np.concatenate(
        [values[:6, :].ravel(), values[-6:, :].ravel(), values[:, :6].ravel(), values[:, -6:].ravel()]
    )


def checker_levels(luma: np.ndarray, chroma: np.ndarray) -> tuple[float, float] | None:
    neutral = chroma <= 14
    if int(neutral.sum()) < 100:
        return None
    samples = luma[neutral]
    low = float(np.percentile(samples, 20))
    high = float(np.percentile(samples, 80))
    if high - low < 12 or low < 140 or high > 250:
        return None
    return low, high


def half_period(luma_row: np.ndarray) -> int | None:
    row = luma_row.astype(np.float32)
    row = row - float(row.mean())
    best_lag = None
    best_score = 0.0
    for lag in range(8, 22):
        left = row[:-lag]
        right = row[lag:]
        denom = float(np.sqrt((left * left).mean() * (right * right).mean()) + 1e-6)
        score = -float((left * right).mean() / denom)
        if score > best_score:
            best_score = score
            best_lag = lag
    if best_lag is None or best_score < 0.25:
        return None
    return best_lag


def clean_checker(rgba: np.ndarray) -> np.ndarray:
    """Remove Gemini's two gray squares, including squares trapped inside the wreath."""
    luma, chroma = luma_chroma(rgba[:, :, :3])
    levels = checker_levels(luma, chroma)
    if levels is None:
        return rgba
    low, high = levels
    distance = np.minimum(np.abs(luma - low), np.abs(luma - high))
    squares = (chroma <= 14) & (distance <= 12) & (rgba[:, :, 3] > 0)
    cleared = flood_from_border(squares)
    period = half_period(luma[min(2, luma.shape[0] - 1)])
    if period:
        shifted = np.zeros(squares.shape, dtype=bool)
        shifted[:, period:] |= squares[:, :-period]
        shifted[:, :-period] |= squares[:, period:]
        shifted[period:, :] |= squares[:-period, :]
        shifted[:-period, :] |= squares[period:, :]
        cleared |= squares & shifted
    fringe = dilate(cleared) & ~cleared & (chroma <= 18) & (distance <= 18)
    out = rgba.copy()
    out[cleared | fringe, 3] = 0
    return zero_rgb(out)


def background_kind(rgba: np.ndarray) -> str:
    alpha = rgba[:, :, 3]
    if float((alpha == 0).mean()) > 0.04:
        return "cutout"
    luma, chroma = luma_chroma(rgba[:, :, :3])
    edge_luma = float(np.median(border_samples(luma)))
    edge_chroma = float(np.median(border_samples(chroma)))
    if edge_luma < 35 and edge_chroma < 18:
        return "black"
    if edge_chroma < 16 and edge_luma >= 246:
        return "white"
    if edge_chroma < 18 and 150 < edge_luma < 245:
        return "checker"
    return "keep"


def clean_checker_print(
    source: Path,
    dest: Path,
    width: int,
    height: int,
    dpi: int,
    comment: str = "",
) -> None:
    rgba = load_rgba(source)
    kind = background_kind(rgba)
    if kind == "cutout":
        cleaned = clean_paper(clean_cutout(rgba))
    elif kind == "black":
        cleaned = clean_black(rgba)
    elif kind == "white":
        cleaned = clean_paper(clean_white(rgba))
    elif kind == "checker":
        cleaned = clean_checker(rgba)
        # A flat off-white page has no two-tone grid, so the checker pass leaves it.
        if cleaned is rgba:
            cleaned = clean_paper(rgba)
    else:
        cleaned = rgba
    if width <= 0 or height <= 0:
        width, height = cleaned.shape[1], cleaned.shape[0]
    canvas = fit_canvas(cleaned, width, height)
    if kind == "checker":
        # Only the pure checker gray that resampling blended back. Not the drawing.
        canvas = clean_checker(canvas)
    dest.parent.mkdir(parents=True, exist_ok=True)
    note = " ".join(comment.split())[:240]
    pnginfo = PngImagePlugin.PngInfo()
    if note:
        pnginfo.add_text("Comment", note)
    Image.fromarray(canvas, "RGBA").save(dest, "PNG", dpi=(dpi, dpi), pnginfo=pnginfo)
    return width, height


def check() -> None:
    size = 80
    cell = 10
    rgb = np.zeros((size, size, 3), dtype=np.uint8)
    yy, xx = np.indices((size, size))
    dark = ((yy // cell + xx // cell) % 2) == 0
    rgb[dark] = (198, 198, 198)
    rgb[~dark] = (230, 230, 230)
    rgb[30:50, 30:50] = (180, 40, 50)
    source = Path("/tmp/gemini-checker-check.png")
    dest = Path("/tmp/gemini-checker-check-out.png")
    Image.fromarray(rgb, "RGB").save(source)
    clean_checker_print(source, dest, 160, 160, 300)
    out = np.array(Image.open(dest).convert("RGBA"))
    if out.shape != (160, 160, 4):
        raise SystemExit(f"expected 160x160, got {out.shape}")
    if int(out[0, 0, 3]) != 0 or int(out[-1, -1, 3]) != 0:
        raise SystemExit("checker corners stayed opaque")
    red, green, blue, alpha = [out[:, :, i].astype(np.int16) for i in range(4)]
    chroma = np.maximum(np.maximum(red, green), blue) - np.minimum(np.minimum(red, green), blue)
    luma = 0.299 * red + 0.587 * green + 0.114 * blue
    leftover = (alpha > 0) & (chroma <= 14) & (luma >= 175) & (luma <= 242)
    if int(leftover.sum()) != 0:
        raise SystemExit(f"opaque checker pixels remain: {int(leftover.sum())}")
    ink = (alpha > 200) & (red > green + 40) & (red > blue + 40)
    if int(ink.sum()) < 20:
        raise SystemExit("the colored mark was removed with the checker")

    cut = np.zeros((40, 40, 4), dtype=np.uint8)
    cut[10:30, 10:30] = (20, 140, 70, 255)
    cut[18:22, 18:22, 3] = 140
    cut_source = Path("/tmp/gemini-cutout-check.png")
    cut_dest = Path("/tmp/gemini-cutout-check-out.png")
    Image.fromarray(cut, "RGBA").save(cut_source)
    clean_checker_print(cut_source, cut_dest, 40, 40, 300)
    kept = np.array(Image.open(cut_dest).convert("RGBA"))
    if int(kept[0, 0, 3]) != 0:
        raise SystemExit("a transparent file was filled in")
    if int(kept[0, 0, 0]) != 0:
        raise SystemExit("empty pixels were painted")
    if int(kept[15, 15, 3]) < 200 or int(kept[15, 15, 1]) < 80:
        raise SystemExit("the cut-out drawing was damaged")

    black = np.zeros((48, 48, 3), dtype=np.uint8)
    black[16:32, 16:32] = (200, 60, 40)
    black_source = Path("/tmp/gemini-black-check.png")
    black_dest = Path("/tmp/gemini-black-check-out.png")
    Image.fromarray(black, "RGB").save(black_source)
    clean_checker_print(black_source, black_dest, 48, 48, 300)
    opened = np.array(Image.open(black_dest).convert("RGBA"))
    if int(opened[0, 0, 3]) != 0:
        raise SystemExit("black matte stayed opaque")
    if int(opened[24, 24, 3]) < 200 or int(opened[24, 24, 0]) < 120:
        raise SystemExit("ink on a black matte was removed")

    page = np.full((48, 48, 3), 255, dtype=np.uint8)
    page[16:32, 16:32] = (30, 24, 40)
    page[20:26, 20:26] = (240, 140, 40)
    page[22:24, 22:24] = (255, 255, 255)
    white_source = Path("/tmp/gemini-white-check.png")
    white_dest = Path("/tmp/gemini-white-check-out.png")
    Image.fromarray(page, "RGB").save(white_source)
    clean_checker_print(white_source, white_dest, 0, 0, 300, comment="house on white")
    lifted = np.array(Image.open(white_dest).convert("RGBA"))
    if lifted.shape[:2] != (48, 48):
        raise SystemExit("a file-sized print was resized")
    if int(lifted[0, 0, 3]) != 0:
        raise SystemExit("white page stayed opaque")
    if int(lifted[18, 18, 3]) < 200 or int(lifted[18, 18, 0]) > 80:
        raise SystemExit("the drawing on a white page was removed")
    if int(lifted[23, 23, 3]) < 200 or int(lifted[23, 23, 0]) < 240:
        raise SystemExit("white ink inside the drawing was cleared")
    plate = np.zeros((64, 64, 4), dtype=np.uint8)
    plate[8:56, 12:52] = (232, 228, 220, 255)
    plate[24:44, 24:44] = (210, 90, 20, 255)
    plate[30:34, 30:34] = (250, 248, 242, 255)
    plate_source = Path("/tmp/gemini-paper-check.png")
    plate_dest = Path("/tmp/gemini-paper-check-out.png")
    Image.fromarray(plate, "RGBA").save(plate_source)
    clean_checker_print(plate_source, plate_dest, 0, 0, 300)
    peeled = np.array(Image.open(plate_dest).convert("RGBA"))
    if int(peeled[0, 0, 3]) != 0 or int(peeled[12, 16, 3]) != 0:
        raise SystemExit("pale plate behind the drawing stayed opaque")
    if int(peeled[26, 26, 3]) < 200 or int(peeled[26, 26, 0]) < 160:
        raise SystemExit("the drawing on a pale plate was removed")
    if int(peeled[32, 32, 3]) < 200 or int(peeled[32, 32, 0]) < 240:
        raise SystemExit("light ink inside the drawing was cleared with the plate")

    sealed = np.zeros((80, 80, 4), dtype=np.uint8)
    sealed[8:72, 8:72] = (200, 90, 30, 255)
    sealed[16:64, 16:64] = (226, 224, 220, 255)
    sealed[30:50, 30:50] = (190, 70, 20, 255)
    sealed[38:42, 38:42] = (250, 246, 240, 255)
    sealed[20:23, 20:23] = (230, 228, 226, 255)
    sealed_source = Path("/tmp/gemini-sealed-check.png")
    sealed_dest = Path("/tmp/gemini-sealed-check-out.png")
    Image.fromarray(sealed, "RGBA").save(sealed_source)
    clean_checker_print(sealed_source, sealed_dest, 0, 0, 300)
    opened = np.array(Image.open(sealed_dest).convert("RGBA"))
    if int(opened[0, 0, 3]) != 0 or int(opened[20, 20, 3]) != 0 or int(opened[40, 18, 3]) != 0:
        raise SystemExit("paper sealed inside the wreath stayed opaque")
    if int(opened[34, 34, 3]) < 200 or int(opened[34, 34, 0]) < 140:
        raise SystemExit("the drawing inside a sealed plate was removed")
    if int(opened[40, 40, 3]) < 200 or int(opened[40, 40, 0]) < 240:
        raise SystemExit("a highlight on the drawing was cleared with the sealed plate")

    saved = Image.open(white_dest)
    if saved.info.get("Comment") != "house on white" and saved.text.get("Comment") != "house on white":
        comment = saved.info.get("Comment") or getattr(saved, "text", {}).get("Comment")
        raise SystemExit(f"png comment was not stored: {comment}")
    print("ok gemini checker knockout")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?")
    parser.add_argument("dest", nargs="?")
    parser.add_argument("--width", type=int, default=3852)
    parser.add_argument("--height", type=int, default=4398)
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--comment", default="")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
        return
    if not args.source or not args.dest:
        raise SystemExit("source and dest are required")
    width, height = clean_checker_print(
        Path(args.source),
        Path(args.dest),
        args.width,
        args.height,
        args.dpi,
        args.comment,
    )
    print(f"wrote {args.dest} {width}x{height} @ {args.dpi} dpi")


if __name__ == "__main__":
    main()
