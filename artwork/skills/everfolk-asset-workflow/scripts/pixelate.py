#!/usr/bin/env python3
"""PixelOE legacy CPU finish with exact-grid, repeat-render, and source QA.

Requires an existing PixelOE runtime; installs nothing. The default logical grid
is a card preset. Crop/compose the input to the selected aspect ratio first.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def positive_int(value: str) -> int:
    result = int(value)
    if result <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return result


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Opaque source image; never modified")
    parser.add_argument("--output", type=Path, required=True, help="Integer-enlarged output PNG")
    parser.add_argument("--runtime", type=Path, required=True, help="Existing runtime site-packages directory")
    parser.add_argument("--logical-width", type=positive_int, default=420, help="Logical pixel width (card preset: 420)")
    parser.add_argument("--logical-height", type=positive_int, default=525, help="Logical pixel height (card preset: 525)")
    parser.add_argument("--scale", type=positive_int, default=2, help="Nearest-neighbour integer enlargement (default: 2)")
    parser.add_argument("--logical-output", type=Path, help="Logical PNG (default: OUTPUT_STEM.logical.png)")
    parser.add_argument("--qa", type=Path, help="QA JSON (default: OUTPUT_STEM.qa.json)")
    parser.add_argument("--config", type=Path, help="JSON: patch_size, thickness, color_matching, palette_colors")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing destination files; cannot replace input/config")
    return parser.parse_args()


def read_config(path: Path | None, pixel_count: int) -> dict:
    settings = {"patch_size": 4, "thickness": 1, "color_matching": True, "palette_colors": None}
    if path:
        values = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(values, dict) or set(values) - set(settings):
            raise ValueError(f"Config must be an object with only {', '.join(settings)}")
        settings.update(values)
    patch = settings["patch_size"]
    if type(patch) is not int or patch < 4:
        raise ValueError("patch_size must be an integer >= 4")
    thickness = settings["thickness"]
    if type(thickness) is not int or thickness < 0:
        raise ValueError("thickness must be a nonnegative integer")
    if type(settings["color_matching"]) is not bool:
        raise ValueError("color_matching must be true or false")
    colors = settings["palette_colors"]
    if colors is not None and (type(colors) is not int or not 2 <= colors <= min(256, pixel_count)):
        raise ValueError("palette_colors must be null or an integer from 2 to min(256, logical pixel count)")
    return settings


def main() -> None:
    args = arguments()
    source = args.input.resolve(strict=True)
    runtime = args.runtime.resolve(strict=True)
    if not runtime.is_dir():
        raise ValueError("--runtime must point to an existing site-packages directory")
    output = args.output.resolve()
    logical_path = (args.logical_output or output.with_name(output.stem + ".logical.png")).resolve()
    qa_path = (args.qa or output.with_suffix(".qa.json")).resolve()
    config_path = args.config.resolve(strict=True) if args.config else None
    destinations = (output, logical_path, qa_path)
    protected = {source, *([config_path] if config_path else [])}
    if len(set(destinations)) != len(destinations) or any(path in protected for path in destinations):
        raise ValueError("Output, logical output, and QA must be distinct and cannot overwrite input/config")
    if output.suffix.lower() != ".png" or logical_path.suffix.lower() != ".png":
        raise ValueError("Both image outputs must use the lossless .png extension")
    for path in destinations:
        if path.exists() and not args.overwrite:
            raise FileExistsError(f"Destination exists; choose a new version or use --overwrite: {path}")
    width, height, scale = args.logical_width, args.logical_height, args.scale
    settings = read_config(config_path, width * height)

    # Keep imports below parsing so --help works without loading a heavy runtime.
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(runtime))
    import cv2
    import numpy as np
    import torch
    from pixeloe.legacy.pixelize import pixelize
    from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale

    cv2.setNumThreads(4)
    torch.set_num_threads(4)
    source_hash = sha256(source)
    raw_source = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if raw_source is None:
        raise ValueError(f"Could not decode input image: {source}")
    if raw_source.dtype != np.uint8:
        raise ValueError("Input must be an 8-bit image; explicitly convert high-bit-depth sources first")
    if raw_source.ndim == 3 and raw_source.shape[2] == 4 and np.any(raw_source[:, :, 3] != 255):
        raise ValueError("Transparent input: deliberately composite onto an opaque background before PixelOE")
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    options = dict(mode="contrast", target_size=(width, height),
                   patch_size=settings["patch_size"], pixel_size=scale,
                   thickness=settings["thickness"], color_matching=settings["color_matching"],
                   contrast=1.0, saturation=1.0, colors=None,
                   no_upscale=True, no_downscale=True)
    epsilon = 1e-6
    target_area_root = float(np.sqrt(width * height)) + epsilon

    def render():
        # Seed optional quantization separately on every render.
        cv2.setRNGSeed(0)
        logical = contrast_based_downscale(pixelize(image.copy(), **options), target_area_root)
        if logical.shape[:2] != (height, width):
            raise RuntimeError(f"Upstream grid mismatch: got {logical.shape[:2]}, expected {(height, width)}")
        if settings["palette_colors"] is not None:
            from pixeloe.legacy.color import color_quant
            logical = color_quant(logical, colors=settings["palette_colors"], method="kmeans")
        return logical

    logical = render()
    repeated = render()
    if not np.array_equal(logical, repeated):
        raise RuntimeError("Repeat render differs: do not accept a nondeterministic finish")
    unique_colors = int(np.unique(logical.reshape(-1, 3), axis=0).shape[0])
    if settings["palette_colors"] is not None and unique_colors > settings["palette_colors"]:
        raise RuntimeError("Optional palette reduction exceeded the requested colour count")
    enlarged = cv2.resize(logical, (width * scale, height * scale), interpolation=cv2.INTER_NEAREST)
    for path in destinations:
        path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(logical_path), logical) or not cv2.imwrite(str(output), enlarged):
        raise RuntimeError("Could not write output PNGs")
    logical_readback = cv2.imread(str(logical_path), cv2.IMREAD_COLOR)
    enlarged_readback = cv2.imread(str(output), cv2.IMREAD_COLOR)
    if not np.array_equal(logical_readback, logical) or not np.array_equal(enlarged_readback, enlarged):
        raise RuntimeError("PNG readback differs")
    if not np.all(enlarged_readback.reshape(height, scale, width, scale, 3) == logical[:, None, :, None, :]):
        raise RuntimeError("Integer output blocks are not exact")
    if sha256(source) != source_hash:
        raise RuntimeError("Source hash changed")
    try:
        pixeloe_version = importlib.metadata.version("pixeloe")
    except importlib.metadata.PackageNotFoundError:
        pixeloe_version = "unavailable"
    record = dict(source=str(source), sourceSha256=source_hash,
                  sourceSize=[image.shape[1], image.shape[0]], runtime=str(runtime),
                  method="PixelOE legacy CPU: outline prepass + upstream contrast downscale",
                  versions=dict(pixeloe=pixeloe_version, opencv=cv2.__version__, numpy=np.__version__, torch=torch.__version__),
                  options=options, config=settings, configPath=str(config_path) if config_path else None,
                  configSha256=sha256(config_path) if config_path else None,
                  paletteSeed=0 if settings["palette_colors"] else None, uniqueColors=unique_colors,
                  explicitGridRoundingEpsilon=epsilon,
                  logical=[width, height], output=[width * scale, height * scale], scale=scale,
                  logicalPath=str(logical_path), outputPath=str(output),
                  logicalSha256=sha256(logical_path), outputSha256=sha256(output),
                  logicalPixelSha256=hashlib.sha256(logical.tobytes()).hexdigest(),
                  deterministic=True, exactIntegerBlocks=True, pngReadbackExact=True,
                  sourceUnchanged=True, interpolatingUpscale=False)
    qa_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError) as error:
        print(f"pixelate.py: {error}", file=sys.stderr)
        raise SystemExit(1)
