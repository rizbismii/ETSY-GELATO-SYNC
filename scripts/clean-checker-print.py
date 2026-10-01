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
from PIL import Image


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


def clean_white_paper(rgba: np.ndarray) -> np.ndarray:
    """Drop a white sheet that touches the edge, including one inside a transparent margin.

    Gemini often seals that sheet with a light gray band around luma 242. A pure-white
    test stops at the band, so the sheet stays opaque. Off-white still counts as paper.
    White trapped inside the drawing stays, because it does not touch the edge.
    """
    luma, chroma = luma_chroma(rgba[:, :, :3])
    alpha = rgba[:, :, 3]
    # 232 sits under the gray seal and above a Gemini checker square (about 230).
    paper = ((luma >= 232) & (chroma <= 16) & (alpha > 0)) | (alpha == 0)
    reached = flood_from_border(paper)
    cleared = reached & (alpha > 0) & (luma >= 232) & (chroma <= 16)
    pale = (alpha > 0) & (luma >= 214) & (chroma <= 18)
    fringe = np.zeros(cleared.shape, dtype=bool)
    edge = cleared
    for _ in range(3):
        edge = dilate(edge) & pale & ~cleared & ~fringe
        if not edge.any():
            break
        fringe |= edge
    # A darker drop shadow under the sheet touches the empty margin. Walk only
    # a few pixels in from that margin so gray inside the drawing stays.
    outside = alpha == 0
    shadow = np.zeros(alpha.shape, dtype=bool)
    for _ in range(8):
        edge = dilate(outside) & ~outside & (alpha > 0) & (chroma <= 12)
        if not edge.any():
            break
        shadow |= edge
        outside |= edge
    out = rgba.copy()
    out[cleared | fringe | shadow, 3] = 0
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
    if edge_chroma < 18 and 150 < edge_luma < 245:
        return "checker"
    if edge_luma >= 242 and edge_chroma < 18:
        return "white"
    return "keep"


def clean_checker_print(source: Path, dest: Path, width: int, height: int, dpi: int) -> None:
    rgba = load_rgba(source)
    kind = background_kind(rgba)
    if kind == "cutout":
        cleaned = clean_cutout(rgba)
    elif kind == "black":
        cleaned = clean_black(rgba)
    elif kind == "checker":
        cleaned = clean_checker(rgba)
    else:
        cleaned = rgba
    cleaned = clean_white_paper(cleaned)
    canvas = fit_canvas(cleaned, width, height)
    if kind == "checker":
        # Only the pure checker gray that resampling blended back. Not the drawing.
        canvas = clean_checker(canvas)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(canvas, "RGBA").save(dest, "PNG", dpi=(dpi, dpi))


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

    sheet = np.zeros((60, 60, 4), dtype=np.uint8)
    sheet[8:52, 4:56] = (255, 255, 255, 255)
    sheet[24:36, 24:36] = (20, 90, 180, 255)
    sheet_source = Path("/tmp/gemini-white-sheet-check.png")
    sheet_dest = Path("/tmp/gemini-white-sheet-check-out.png")
    Image.fromarray(sheet, "RGBA").save(sheet_source)
    clean_checker_print(sheet_source, sheet_dest, 60, 60, 300)
    knocked = np.array(Image.open(sheet_dest).convert("RGBA"))
    if int(knocked[0, 0, 3]) != 0 or int(knocked[12, 12, 3]) != 0:
        raise SystemExit("white paper behind the art stayed opaque")
    if int(knocked[30, 30, 3]) < 200 or int(knocked[30, 30, 2]) < 120:
        raise SystemExit("the drawing on the white sheet was removed")

    # A light gray seal (the chemistry upload) blocks a pure-white flood.
    sealed = np.zeros((80, 80, 4), dtype=np.uint8)
    sealed[6:74, 6:74] = (255, 255, 255, 255)
    sealed[14:66, 14:66] = (242, 242, 242, 255)
    sealed[20:60, 20:60] = (255, 255, 255, 255)
    sealed[32:48, 32:48] = (20, 90, 180, 255)
    sealed[38:42, 38:42] = (255, 255, 255, 255)
    sealed[68:74, 6:74] = (130, 130, 130, 255)
    sealed_source = Path("/tmp/gemini-sealed-sheet-check.png")
    sealed_dest = Path("/tmp/gemini-sealed-sheet-check-out.png")
    Image.fromarray(sealed, "RGBA").save(sealed_source)
    clean_checker_print(sealed_source, sealed_dest, 80, 80, 300)
    opened_sheet = np.array(Image.open(sealed_dest).convert("RGBA"))
    if int(opened_sheet[10, 40, 3]) != 0 or int(opened_sheet[16, 40, 3]) != 0 or int(opened_sheet[24, 24, 3]) != 0:
        raise SystemExit("a white sheet behind a gray seal stayed opaque")
    if int(opened_sheet[70, 40, 3]) != 0:
        raise SystemExit("the gray shadow under the sheet stayed opaque")
    if int(opened_sheet[40, 40, 3]) < 200:
        raise SystemExit("white trapped inside the drawing was cleared")
    if int(opened_sheet[34, 34, 3]) < 200 or int(opened_sheet[34, 34, 2]) < 120:
        raise SystemExit("the drawing on the sealed sheet was removed")
    print("ok gemini checker knockout")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?")
    parser.add_argument("dest", nargs="?")
    parser.add_argument("--width", type=int, default=3852)
    parser.add_argument("--height", type=int, default=4398)
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
        return
    if not args.source or not args.dest:
        raise SystemExit("source and dest are required")
    clean_checker_print(Path(args.source), Path(args.dest), args.width, args.height, args.dpi)
    print(f"wrote {args.dest} {args.width}x{args.height} @ {args.dpi} dpi")


if __name__ == "__main__":
    main()
