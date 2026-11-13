"""Coarser PixelOE variants using the same clean anime source and colour treatment."""
from __future__ import annotations

from pathlib import Path
import importlib.util
import sys

sys.dont_write_bytecode = True

source = Path(__file__).with_name("build-anime-pixeloe-v3.py")
spec = importlib.util.spec_from_file_location("anime_pixel_base", source)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.REVIEW = base.STUDY / "review" / "anime-v4"
base.QA = base.STUDY / "qa" / "anime-v4-pixeloe.json"
base.PRESETS = [
    {"name": "bold", "width": 320, "height": 180, "scale": 6},
    {"name": "chunky", "width": 240, "height": 135, "scale": 8},
]

if __name__ == "__main__":
    base.run()
