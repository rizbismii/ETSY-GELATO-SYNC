#!/usr/bin/env python3
"""Build Gildan 5000 embroidery prints: 3000×1800 large center and 750×750 neck."""

from __future__ import annotations

import importlib.util
from pathlib import Path

CLEANER = Path(__file__).resolve().parent / "clean-embroidery-print.py"
SPEC = importlib.util.spec_from_file_location("clean_embroidery_print", CLEANER)
if SPEC is None or SPEC.loader is None:
    raise SystemExit(f"missing embroidery cleaner {CLEANER}")
_mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(_mod)
clean_embroidery = _mod.clean_embroidery

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "scripts" / "apparel-src"
OUT_DIR = ROOT / "public" / "catalog"
EMB_SRC = SRC_DIR / "tee-bloom-embroidery.png"
NECK_SRC = SRC_DIR / "tee-bloom-neck.png"
EMB_OUT = OUT_DIR / "print-tee-bloom.png"
NECK_OUT = OUT_DIR / "print-tee-bloom-neck.png"


def main() -> None:
    if not EMB_SRC.exists():
        raise SystemExit(f"missing embroidery source {EMB_SRC}")
    if not NECK_SRC.exists():
        raise SystemExit(f"missing neck source {NECK_SRC}")
    clean_embroidery(EMB_SRC, EMB_OUT, width=3000, height=1800, fill=0.96)
    clean_embroidery(NECK_SRC, NECK_OUT, width=750, height=750, fill=0.84)
    print(f"wrote {EMB_OUT.name} and {NECK_OUT.name}")


if __name__ == "__main__":
    main()
