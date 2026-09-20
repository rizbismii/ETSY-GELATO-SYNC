#!/usr/bin/env python3
"""Keep print templates on the same artwork as the listing mockup.

Fern Arc was shipping a different fern (curled frond + roots) than the catalog
photo (open frond on cream paper). This rebuilds that print from the mockup
and fails if the wrong design comes back.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"

# Customer-facing mockup is the source of truth for wall-art prints.
PAIRS = (
    {
        "key": "live_poster",
        "mockup": "catalog-poster.png",
        "print": "print-poster-fern-arc.png",
        "rebuild": True,
        "shape": "portrait",
        "crop": (0.30, 0.17, 0.735, 0.805),
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


def drop_specks(mask: np.ndarray, min_pixels: int) -> np.ndarray:
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    keep = np.zeros_like(mask, dtype=bool)
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack = [(int(y), int(x))]
        blob: list[tuple[int, int]] = []
        while stack:
            cy, cx = stack.pop()
            if cy < 0 or cx < 0 or cy >= h or cx >= w or seen[cy, cx] or not mask[cy, cx]:
                continue
            seen[cy, cx] = True
            blob.append((cy, cx))
            stack.extend(((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)))
        if len(blob) >= min_pixels:
            for by, bx in blob:
                keep[by, bx] = True
    return keep


def listing_fern_on_cream(rgb: np.ndarray) -> np.ndarray:
    """Lift the fern the customer sees onto a clean cream sheet. No wall, no other fern."""
    luma = luma_of(rgb)
    paper = np.median(rgb[luma > 210], axis=0).astype(np.uint8)
    ink = luma < 168
    if ink.sum() < 80:
        ink = luma < 180
    ink = drop_specks(ink, min_pixels=40)
    ys, xs = np.nonzero(ink)
    pad = 24
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + pad + 1)
    fern = rgb[y0:y1, x0:x1]
    fluma = luma[y0:y1, x0:x1]
    fink = ink[y0:y1, x0:x1]
    alpha = np.clip((172 - fluma) * (255 / 18), 0, 255).astype(np.uint8)
    alpha[~fink] = 0
    canvas = Image.new("RGB", A3, tuple(int(c) for c in paper))
    art = Image.fromarray(fern, "RGB")
    mask = Image.fromarray(alpha, "L")
    scale = min((A3[0] * 0.70) / art.size[0], (A3[1] * 0.70) / art.size[1])
    nw, nh = max(1, int(art.size[0] * scale)), max(1, int(art.size[1] * scale))
    art = art.resize((nw, nh), Image.Resampling.LANCZOS)
    mask = mask.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(art, ((A3[0] - nw) // 2, int(A3[1] * 0.16)), mask)
    return np.array(canvas)


def rebuild_poster() -> np.ndarray:
    mockup = np.array(Image.open(OUT / "catalog-poster.png").convert("RGB"))
    pair = next(row for row in PAIRS if row["key"] == "live_poster")
    return listing_fern_on_cream(crop_frac(mockup, pair["crop"]))


def has_wrong_fern_arc(print_rgb: np.ndarray) -> str | None:
    """The retired print has a fiddlehead curl and roots. The listing fern does not."""
    luma = luma_of(print_rgb)
    h, w = luma.shape
    ink = luma < 90
    bottom = ink[int(h * 0.86) :, int(w * 0.35) : int(w * 0.65)]
    if bottom.size and bottom.mean() > 0.012:
        return "print still has roots that are not on the listing mockup"
    top_right = ink[int(h * 0.04) : int(h * 0.28), int(w * 0.55) : int(w * 0.88)]
    if top_right.size and top_right.mean() > 0.04:
        return "print still has a curled fiddlehead that is not on the listing mockup"
    return None


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
        if not mockup.exists() or not print_path.exists():
            print(f"MISSING {pair['mockup']} or {pair['print']}")
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
