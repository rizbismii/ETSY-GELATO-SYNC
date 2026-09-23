#!/usr/bin/env python3
"""Build the Grow With Purpose 1200×1200 embroidery print from the clean still.

Product photos come from Printify variant mockups, not from recolored composites.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from clean_embroidery_print import clean_embroidery

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "apparel-src" / "hoodie-bloom-embroidery.png"
OUT = ROOT / "public" / "catalog" / "print-hoodie-bloom.png"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing embroidery source {SRC}")
    clean_embroidery(SRC, OUT)
    print(f"wrote {OUT.name}")


if __name__ == "__main__":
    main()
