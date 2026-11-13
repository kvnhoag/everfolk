"""Apply published PixelOE to the clean anime + chiaroscuro v5 source.

No image generation, palette reduction or processing of an already-pixelated
image happens here. Runtime stays isolated in ignored artifacts/pixeloe-runtime.
"""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
RUNTIME = PROJECT / "artifacts" / "pixeloe-runtime" / "site-packages"
sys.path.insert(0, str(RUNTIME))

import cv2
import numpy as np
import torch

try:
    from pixeloe.legacy.pixelize import pixelize
except ImportError:
    from pixeloe.pixelize import pixelize

STUDY = Path(__file__).resolve().parents[1]
SOURCE = STUDY / "source" / "alexander-anime-chiaroscuro-before-v5.png"
REVIEW = STUDY / "review" / "hybrid-v5"
QA = STUDY / "qa" / "hybrid-v5-pixeloe.json"
PRESETS = [
    {"name": "bold", "width": 320, "height": 180, "scale": 6},
    {"name": "chunky", "width": 240, "height": 135, "scale": 8},
]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run():
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Clean hybrid source not ready: {SOURCE}")
    REVIEW.mkdir(parents=True, exist_ok=True)
    QA.parent.mkdir(parents=True, exist_ok=True)
    cv2.setNumThreads(4)
    torch.set_num_threads(4)
    source_hash = sha(SOURCE)
    image = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not load source: {SOURCE}")
    source_ratio = image.shape[1] / image.shape[0]
    aspect_adjustment = ((16 / 9) / source_ratio - 1) * 100
    qa = {
        "method": "Published PixelOE, legacy CPU API",
        "package": importlib.metadata.version("pixeloe"),
        "source": str(SOURCE),
        "sourceSha256": source_hash,
        "sourceSize": [image.shape[1], image.shape[0]],
        "sourceCrop": None,
        "aspectNormalizationPercent": round(aspect_adjustment, 6),
        "aspectNote": "Explicit 16:9 target; PixelOE normalizes source aspect. No source crop.",
        "upstream": "https://github.com/KohakuBlueleaf/PixelOE",
        "runtime": str(RUNTIME),
        "versions": {"opencv": cv2.__version__, "torch": torch.__version__, "numpy": np.__version__},
        "presets": [],
    }
    for preset in PRESETS:
        started = time.perf_counter()
        options = dict(mode="contrast", target_size=(preset["width"], preset["height"]),
                       patch_size=4, pixel_size=preset["scale"], thickness=1,
                       color_matching=True, contrast=1.0, saturation=1.0,
                       colors=None, no_upscale=True)
        logical = pixelize(image.copy(), **options)
        expected = (preset["height"], preset["width"])
        if logical.shape[:2] != expected:
            raise RuntimeError(f"Unexpected logical dimensions {logical.shape}; expected {expected}")
        repeated = pixelize(image.copy(), **options)
        if not np.array_equal(logical, repeated):
            raise RuntimeError(f"Non-deterministic output for {preset['name']}")
        output = cv2.resize(logical, (preset["width"] * preset["scale"], preset["height"] * preset["scale"]), interpolation=cv2.INTER_NEAREST)
        stem = REVIEW / f"alexander-hybrid-pixel-{preset['name']}"
        logical_path, output_path = Path(str(stem) + ".logical.png"), Path(str(stem) + ".png")
        if not cv2.imwrite(str(logical_path), logical) or not cv2.imwrite(str(output_path), output):
            raise RuntimeError("Could not write PixelOE output")
        readback = cv2.imread(str(output_path), cv2.IMREAD_COLOR)
        blocked = readback.reshape(preset["height"], preset["scale"], preset["width"], preset["scale"], 3)
        exact = bool(np.all(blocked == logical[:, None, :, None, :]))
        if not exact:
            raise RuntimeError("PNG pixel blocks are not exact integer replications")
        nonblank = bool(float(np.std(readback)) > 1)
        if not nonblank:
            raise RuntimeError("PixelOE output is blank")
        record = {**preset, "options": options, "logicalPath": str(logical_path), "outputPath": str(output_path),
                  "outputSize": [output.shape[1], output.shape[0]], "outputSha256": sha(output_path),
                  "logicalSha256": sha(logical_path), "exactIntegerBlocks": exact,
                  "deterministic": True, "nonblank": nonblank, "colourQuantization": False,
                  "uniqueColours": int(len(np.unique(logical.reshape(-1, 3), axis=0))),
                  "elapsedSeconds": round(time.perf_counter() - started, 3)}
        qa["presets"].append(record)
        print(json.dumps({"preset": preset["name"], "size": record["outputSize"], "seconds": record["elapsedSeconds"], "colours": record["uniqueColours"]}), flush=True)
    qa["sourceUnchanged"] = sha(SOURCE) == source_hash
    if not qa["sourceUnchanged"]:
        raise RuntimeError("Source changed")
    QA.write_text(json.dumps(qa, indent=2), encoding="utf8")
    print(json.dumps({"qa": str(QA), "sourceUnchanged": True}), flush=True)


if __name__ == "__main__":
    run()
