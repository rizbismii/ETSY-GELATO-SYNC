#!/usr/bin/env python3
"""Keep print templates on the same artwork as the listing mockup.

Fern Arc must be the paper the customer sees — not a re-centered / rescaled fern.
Lifestyle mockup stays the listing photo; the print is that paper cropped to A3.
Also writes extra gallery stills so listing health has more than one photo.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"

PAIRS = (
    {
        "key": "live_poster",
        "mockup": "catalog-poster.png",
        "print": "print-poster-fern-arc.png",
        "rebuild": True,
        "shape": "portrait",
        # Listing paper corners (TL, TR, BR, BL) as fractions of catalog-poster.png.
        "corners": ((0.380, 0.250), (0.738, 0.236), (0.775, 0.812), (0.332, 0.816)),
    },
    {
        "key": "live_quote_breathe",
        "mockup": "catalog-breathe-here.png",
        "print": "print-breathe-here.png",
        "rebuild": False,
        "shape": "landscape",
    },
    {
        "key": "live_botanical_kowhai",
        "mockup": "catalog-kowhai-botanical.png",
        "print": "print-kowhai-botanical.png",
        "rebuild": False,
        "shape": "portrait",
    },
    {
        "key": "live_canvas_harbour",
        "mockup": "catalog-harbour-morning.png",
        "print": "print-harbour-morning.png",
        "rebuild": False,
        "shape": "square",
    },
    {
        "key": "live_frame_kind",
        "mockup": "catalog-kind-light.png",
        "print": "print-kind-light.png",
        "rebuild": False,
        "shape": "portrait",
    },
)

A3 = (2480, 3508)


def luma_of(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.float32), rgb[:, :, 1].astype(np.float32), rgb[:, :, 2].astype(np.float32)
    return 0.299 * r + 0.587 * g + 0.114 * b


def crop_frac(rgb: np.ndarray, box: tuple[float, float, float, float]) -> np.ndarray:
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = box
    return rgb[int(h * y0) : int(h * y1), int(w * x0) : int(w * x1)]


def perspective_coeffs(source: list[tuple[float, float]], target: list[tuple[float, float]]) -> list[float]:
    matrix = []
    for src, dst in zip(source, target):
        matrix.append([dst[0], dst[1], 1, 0, 0, 0, -src[0] * dst[0], -src[0] * dst[1]])
        matrix.append([0, 0, 0, dst[0], dst[1], 1, -src[1] * dst[0], -src[1] * dst[1]])
    solved = np.linalg.lstsq(np.array(matrix, dtype=np.float64), np.array(source, dtype=np.float64).reshape(8), rcond=None)[0]
    return solved.tolist()


def paper_to_print(mockup: Image.Image, corners: tuple[tuple[float, float], ...], size: tuple[int, int] = A3) -> np.ndarray:
    """Warp the listing paper onto a flat A3 sheet. Same fern, same margins — no wall."""
    w, h = mockup.size
    source = [(x * w, y * h) for x, y in corners]
    dest = [(0, 0), (size[0] - 1, 0), (size[0] - 1, size[1] - 1), (0, size[1] - 1)]
    coeffs = perspective_coeffs(source, dest)
    flat = mockup.transform(size, Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    return np.array(flat.convert("RGB"))


def rebuild_poster() -> np.ndarray:
    mockup = Image.open(OUT / "catalog-poster.png").convert("RGB")
    pair = next(row for row in PAIRS if row["key"] == "live_poster")
    return paper_to_print(mockup, pair["corners"])


def has_wrong_fern_arc(print_rgb: np.ndarray) -> str | None:
    """Retired print had a fiddlehead curl and roots. Wall in the crop means the paper warp missed."""
    luma = luma_of(print_rgb)
    h, w = luma.shape
    ink = luma < 90
    bottom = ink[int(h * 0.86) :, int(w * 0.35) : int(w * 0.65)]
    if bottom.size and bottom.mean() > 0.012:
        return "print still has roots that are not on the listing mockup"
    top_right = ink[int(h * 0.04) : int(h * 0.28), int(w * 0.55) : int(w * 0.88)]
    if top_right.size and top_right.mean() > 0.04:
        return "print still has a curled fiddlehead that is not on the listing mockup"
    top_band = luma[: int(h * 0.04)]
    if top_band.size and (top_band < 160).mean() > 0.02:
        return "print still includes the room wall — paper warp missed the listing sheet"
    mid_ink = luma < 168
    ys, xs = np.nonzero(mid_ink)
    if len(ys) < 80:
        return "print is missing the listing fern"
    return None


def write_gallery(key: str, print_rgb: np.ndarray) -> None:
    img = Image.fromarray(print_rgb, "RGB")
    w, h = img.size
    detail_box = (int(w * 0.18), int(h * 0.12), int(w * 0.82), int(h * 0.78))
    close_box = (int(w * 0.28), int(h * 0.18), int(w * 0.72), int(h * 0.62))
    img.crop(detail_box).resize((1200, 1600), Image.Resampling.LANCZOS).save(
        OUT / f"gallery-{key}-detail.png", "PNG", optimize=True
    )
    img.crop(close_box).resize((1200, 1600), Image.Resampling.LANCZOS).save(
        OUT / f"gallery-{key}-close.png", "PNG", optimize=True
    )


def build() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for pair in PAIRS:
        mockup = OUT / pair["mockup"]
        print_path = OUT / pair["print"]
        if not mockup.exists():
            raise SystemExit(f"Missing mockup {mockup}")
        if pair["rebuild"]:
            art = rebuild_poster()
            Image.fromarray(art, "RGB").save(print_path, "PNG", optimize=True)
        if not print_path.exists():
            raise SystemExit(f"Missing print {print_path}")
        print_rgb = np.array(Image.open(print_path).convert("RGB"))
        write_gallery(pair["key"], print_rgb)
        wrong = has_wrong_fern_arc(print_rgb) if pair["key"] == "live_poster" else None
        rows.append(
            {
                "key": pair["key"],
                "mockup": pair["mockup"],
                "print": pair["print"],
                "rebuilt": bool(pair["rebuild"]),
                "width": int(print_rgb.shape[1]),
                "height": int(print_rgb.shape[0]),
                "ok": wrong is None,
                "error": wrong,
            }
        )
        print(f"{pair['print']} {print_rgb.shape[1]}x{print_rgb.shape[0]} {'ok' if not wrong else wrong}")
    return rows


def check_only() -> int:
    failed = 0
    for pair in PAIRS:
        mockup = OUT / pair["mockup"]
        print_path = OUT / pair["print"]
        detail = OUT / f"gallery-{pair['key']}-detail.png"
        close = OUT / f"gallery-{pair['key']}-close.png"
        if not mockup.exists() or not print_path.exists():
            print(f"MISSING {pair['mockup']} or {pair['print']}")
            failed += 1
            continue
        if not detail.exists() or not close.exists():
            print(f"MISSING gallery stills for {pair['key']}")
            failed += 1
            continue
        if pair["key"] != "live_poster":
            print(f"ok {pair['print']} paired to {pair['mockup']}")
            continue
        wrong = has_wrong_fern_arc(np.array(Image.open(print_path).convert("RGB")))
        print(f"{'ok' if not wrong else 'MISMATCH'} {pair['print']}" + (f" {wrong}" if wrong else ""))
        if wrong:
            failed += 1
    return failed


def main() -> None:
    if "--check" in sys.argv:
        failed = check_only()
        if failed:
            raise SystemExit(f"{failed} print file(s) do not match the listing mockup")
        return
    rows = build()
    (ROOT / "data" / "print-match.json").write_text(json.dumps({"pairs": rows}, indent=2) + "\n")
    failed = check_only()
    if failed:
        raise SystemExit(f"{failed} print file(s) still mismatch after rebuild")


if __name__ == "__main__":
    main()
