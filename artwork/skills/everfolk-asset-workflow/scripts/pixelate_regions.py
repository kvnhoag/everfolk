#!/usr/bin/env python3
"""Optional mixed-grid PixelOE finish: preserve a verified coarse base outside
explicit regions and select complete finer cells inside them. No colour blend,
sharpening, generated edits, or eye painting is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
from pixelate import sha256


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Unchanged opaque painting used by the coarse base")
    parser.add_argument("--base", type=Path, required=True, help="Verified coarse pixel PNG; never modified")
    parser.add_argument("--base-qa", type=Path, required=True, help="Coarse base pixelate.py QA JSON")
    parser.add_argument("--config", type=Path, required=True, help="Explicit regional geometry and grid JSON")
    parser.add_argument("--runtime", type=Path, required=True, help="Existing PixelOE site-packages directory")
    parser.add_argument("--output", type=Path, required=True, help="New mixed-grid PNG")
    parser.add_argument("--qa", type=Path, help="QA JSON (default: OUTPUT_STEM.qa.json)")
    parser.add_argument("--mask", type=Path, help="Optional binary selection mask PNG: white selects finer pixels")
    parser.add_argument("--detail-output", type=Path, help="Optional full-image finer PixelOE pass PNG")
    parser.add_argument("--overwrite", action="store_true", help="Replace destination files, never input/base/metadata/config")
    return parser.parse_args()


def integer(value, label, minimum=1):
    if type(value) is not int or value < minimum:
        raise ValueError(f"{label} must be an integer >= {minimum}")
    return value


def pair(value, label, positive=False):
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{label} must contain two finite numbers")
    if any(type(item) not in (int, float) or not math.isfinite(item) or (positive and item <= 0) for item in value):
        raise ValueError(f"{label} must contain two {'positive ' if positive else ''}finite numbers")
    return value


def read_config(path):
    config = json.loads(path.read_text(encoding="utf-8-sig"))
    keys = {"base_pixel_size", "detail_pixel_size", "detail_outline_thickness", "regions", "critical_boxes"}
    if not isinstance(config, dict) or set(config) - keys or not keys <= set(config):
        raise ValueError(f"Config requires exactly these keys: {', '.join(sorted(keys))}")
    base_size = integer(config["base_pixel_size"], "base_pixel_size")
    detail_size = integer(config["detail_pixel_size"], "detail_pixel_size")
    if detail_size >= base_size:
        raise ValueError("detail_pixel_size must be smaller than base_pixel_size")
    integer(config["detail_outline_thickness"], "detail_outline_thickness", minimum=0)
    if not isinstance(config["regions"], list) or not config["regions"]:
        raise ValueError("regions must be a nonempty list")
    if not isinstance(config["critical_boxes"], list):
        raise ValueError("critical_boxes must be a list (it may be empty)")
    for collection, required in (("regions", {"name", "center", "radius", "inner_scale"}),
                                 ("critical_boxes", {"name", "box"})):
        names = set()
        for entry in config[collection]:
            if not isinstance(entry, dict) or set(entry) != required:
                raise ValueError(f"Every {collection} entry must contain exactly {sorted(required)}")
            name = entry["name"]
            if not isinstance(name, str) or not name.strip() or name in names:
                raise ValueError(f"Every {collection} entry needs a unique nonempty name")
            names.add(name)
            if collection == "regions":
                pair(entry["center"], "region center")
                pair(entry["radius"], "region radius", positive=True)
                inner = entry["inner_scale"]
                if type(inner) not in (int, float) or not math.isfinite(inner) or not 0 < inner < 1:
                    raise ValueError("inner_scale must be a finite number strictly between 0 and 1")
            else:
                box = entry["box"]
                if not isinstance(box, list) or len(box) != 4:
                    raise ValueError("A critical box must be [x0, y0, x1, y1], exclusive at x1/y1")
                for coordinate in box:
                    integer(coordinate, "critical box coordinate", minimum=0)
                if box[0] >= box[2] or box[1] >= box[3]:
                    raise ValueError("Critical boxes need positive width and height")
    return config


def main():
    args = arguments()
    paths = {key: getattr(args, key).resolve(strict=True) for key in ("input", "base", "base_qa", "config", "runtime")}
    if not paths["runtime"].is_dir():
        raise ValueError("--runtime must point to an existing site-packages directory")
    if paths["input"] == paths["base"]:
        raise ValueError("Painting input and coarse base must be distinct files")
    output = args.output.resolve()
    qa_path = (args.qa or output.with_suffix(".qa.json")).resolve()
    mask_path = args.mask.resolve() if args.mask else None
    detail_path = args.detail_output.resolve() if args.detail_output else None
    destinations = [output, qa_path, *([mask_path] if mask_path else []), *([detail_path] if detail_path else [])]
    if len(set(destinations)) != len(destinations) or any(path in paths.values() for path in destinations):
        raise ValueError("Destinations must be distinct and cannot overwrite input/base/metadata/config/runtime")
    for path in [output, *([mask_path] if mask_path else []), *([detail_path] if detail_path else [])]:
        if path.suffix.lower() != ".png":
            raise ValueError("All image outputs must use the lossless .png extension")
    for path in destinations:
        if path.exists() and not args.overwrite:
            raise FileExistsError(f"Destination exists; choose a new version or use --overwrite: {path}")
    config = read_config(paths["config"])
    base_qa = json.loads(paths["base_qa"].read_text(encoding="utf-8-sig"))
    source_hash, base_hash = sha256(paths["input"]), sha256(paths["base"])
    if not isinstance(base_qa, dict) or base_qa.get("sourceSha256") != source_hash:
        raise ValueError("Base QA sourceSha256 does not match the painting input")
    if base_qa.get("outputSha256") != base_hash:
        raise ValueError("Base QA outputSha256 does not match the coarse base PNG")
    protected_hashes = {key: sha256(paths[key]) for key in ("input", "base", "base_qa", "config")}

    sys.dont_write_bytecode = True
    sys.path.insert(0, str(paths["runtime"]))
    import cv2
    import numpy as np
    import torch
    from pixeloe.legacy.pixelize import pixelize
    from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale

    cv2.setNumThreads(4)
    torch.set_num_threads(4)

    def read_opaque(path, label):
        raw = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if raw is None or raw.dtype != np.uint8 or raw.ndim != 3 or raw.shape[2] not in (3, 4):
            raise ValueError(f"{label} must be a decodable 8-bit RGB or opaque RGBA image")
        if raw.shape[2] == 4 and np.any(raw[:, :, 3] != 255):
            raise ValueError(f"{label} has meaningful alpha; composite explicitly onto an opaque background first")
        return raw[:, :, :3].copy()

    painting = read_opaque(paths["input"], "Painting input")
    base = read_opaque(paths["base"], "Coarse base")
    height, width = base.shape[:2]
    base_size, detail_size = config["base_pixel_size"], config["detail_pixel_size"]
    cell_size = math.lcm(base_size, detail_size)
    if width % cell_size or height % cell_size:
        raise ValueError(f"Base dimensions must be divisible by the common registered cell size {cell_size}")
    logical_base = [width // base_size, height // base_size]
    if (base_qa.get("output") != [width, height] or base_qa.get("logical") != logical_base
            or base_qa.get("scale") != base_size or base_qa.get("sourceSize") != [painting.shape[1], painting.shape[0]]):
        raise ValueError("Base QA dimensions/scale do not match the images and configured coarse pixel size")
    base_samples = base[::base_size, ::base_size]
    if not np.all(base.reshape(height // base_size, base_size, width // base_size, base_size, 3)
                  == base_samples[:, None, :, None, :]):
        raise ValueError("Coarse base does not contain exact registered integer pixel blocks")

    detail_width, detail_height = width // detail_size, height // detail_size
    detail_options = dict(mode="contrast", target_size=(detail_width, detail_height),
                          patch_size=4, pixel_size=detail_size,
                          thickness=config["detail_outline_thickness"], color_matching=True,
                          contrast=1.0, saturation=1.0, colors=None, no_upscale=True, no_downscale=True)
    epsilon = 1e-6

    def render_detail():
        logical = contrast_based_downscale(pixelize(painting.copy(), **detail_options),
                                          float(np.sqrt(detail_width * detail_height)) + epsilon)
        if logical.shape[:2] != (detail_height, detail_width):
            raise RuntimeError("Detail PixelOE logical grid mismatch")
        result = cv2.resize(logical, (width, height), interpolation=cv2.INTER_NEAREST)
        if not np.all(result.reshape(detail_height, detail_size, detail_width, detail_size, 3)
                      == logical[:, None, :, None, :]):
            raise RuntimeError("Detail integer blocks are not exact")
        return result

    detail = render_detail()
    repeated_detail = render_detail()
    if not np.array_equal(detail, repeated_detail):
        raise RuntimeError("Detail repeat render differs")

    rows, columns = height // cell_size, width // cell_size
    yy, xx = np.meshgrid((np.arange(rows) + .5) * cell_size,
                         (np.arange(columns) + .5) * cell_size, indexing="ij")
    weights = np.zeros((rows, columns), dtype=np.float64)
    for region in config["regions"]:
        cx, cy = region["center"]
        rx, ry = region["radius"]
        distance = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        weight = np.clip((1 - distance) / (1 - region["inner_scale"]), 0, 1)
        weights = np.maximum(weights, weight)
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])
    thresholds = (bayer[np.arange(rows)[:, None] % 4, np.arange(columns)[None, :] % 4] + .5) / 16
    selected_cells = weights > thresholds
    mask = np.repeat(np.repeat(selected_cells, cell_size, axis=0), cell_size, axis=1)
    if not mask.any() or mask.all():
        raise ValueError("Regions must select some detail cells and retain some coarse cells")
    if np.any(selected_cells[weights == 0]):
        raise RuntimeError("A cell outside the regional support was selected")
    critical_coverage = []
    for critical in config["critical_boxes"]:
        x0, y0, x1, y1 = critical["box"]
        if x1 > width or y1 > height:
            raise ValueError(f"Critical box {critical['name']} exceeds the output canvas")
        selected = int(mask[y0:y1, x0:x1].sum())
        pixels = (x1 - x0) * (y1 - y0)
        if selected != pixels:
            raise ValueError(f"Critical box {critical['name']} is not entirely selected from the detail pass ({selected}/{pixels})")
        critical_coverage.append(dict(name=critical["name"], box=critical["box"], selectedPixels=selected,
                                      totalPixels=pixels, detailCoverage=1.0))

    result = np.where(mask[:, :, None], detail, base)
    repeated_result = np.where(mask[:, :, None], repeated_detail, base)
    if not np.array_equal(result, repeated_result):
        raise RuntimeError("Regional composition repeat mismatch")
    outside_differences = int(np.count_nonzero(np.any(result[~mask] != base[~mask], axis=1)))
    selected_differences = int(np.count_nonzero(np.any(result[mask] != detail[mask], axis=1)))
    mask_cells = mask.reshape(rows, cell_size, columns, cell_size)
    if not np.all(mask_cells == selected_cells[:, None, :, None]) or outside_differences or selected_differences:
        raise RuntimeError("Whole-cell selection or exact base/detail composition failed")
    for path in destinations:
        path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), result) or not np.array_equal(cv2.imread(str(output), cv2.IMREAD_COLOR), result):
        raise RuntimeError("Output PNG write/readback mismatch")
    if detail_path and (not cv2.imwrite(str(detail_path), detail)
                        or not np.array_equal(cv2.imread(str(detail_path), cv2.IMREAD_COLOR), detail)):
        raise RuntimeError("Detail PNG write/readback mismatch")
    binary_mask = mask.astype(np.uint8) * 255
    if mask_path and (not cv2.imwrite(str(mask_path), binary_mask)
                      or not np.array_equal(cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE), binary_mask)):
        raise RuntimeError("Selection mask write/readback mismatch")
    for key, old_hash in protected_hashes.items():
        if sha256(paths[key]) != old_hash:
            raise RuntimeError(f"Protected source changed: {key}")
    try:
        pixeloe_version = importlib.metadata.version("pixeloe")
    except importlib.metadata.PackageNotFoundError:
        pixeloe_version = "unavailable"
    changed_pixels = int(np.count_nonzero(np.any(result != base, axis=2)))
    record = dict(method="Regional PixelOE: whole common-cell Bayer selection, no colour/alpha blend",
                  gridType="mixed-grid; no single logical grid", source=str(paths["input"]), sourceSha256=source_hash,
                  sourceSize=[painting.shape[1], painting.shape[0]], base=str(paths["base"]), baseSha256=base_hash,
                  baseQa=str(paths["base_qa"]), baseQaSha256=protected_hashes["base_qa"],
                  configPath=str(paths["config"]), configSha256=protected_hashes["config"], config=config,
                  runtime=str(paths["runtime"]),
                  versions=dict(pixeloe=pixeloe_version, opencv=cv2.__version__, numpy=np.__version__, torch=torch.__version__),
                  output=[width, height], outputPath=str(output), outputSha256=sha256(output),
                  basePixelSize=base_size, detailPixelSize=detail_size, commonCellSize=cell_size,
                  gridOrigin=[0, 0], detailLogical=[detail_width, detail_height], detailOptions=detail_options,
                  detailPixelSha256=hashlib.sha256(detail.tobytes()).hexdigest(),
                  detailOutputPath=str(detail_path) if detail_path else None,
                  detailOutputSha256=sha256(detail_path) if detail_path else None,
                  maskPath=str(mask_path) if mask_path else None, maskSha256=sha256(mask_path) if mask_path else None,
                  maskPixelSha256=hashlib.sha256(binary_mask.tobytes()).hexdigest(),
                  selectedDetailCells=int(selected_cells.sum()), retainedCoarseCells=int((~selected_cells).sum()),
                  affectedPixels=int(mask.sum()), changedPixels=changed_pixels,
                  outsideMaskChangedPixels=outside_differences, selectedDetailDifferingPixels=selected_differences,
                  criticalCoverage=critical_coverage, innerRegionFullDetail=True,
                  cellCenterEllipseSampling=True, transition="4x4 Bayer threshold (entry + 0.5) / 16, global cell origin",
                  explicitGridRoundingEpsilon=epsilon, registeredExactIntegerBlocks=True,
                  wholeCommonCells=True, deterministic=True, pngReadbackExact=True,
                  sourceUnchanged=True, baseUnchanged=True, metadataUnchanged=True,
                  interpolatingUpscale=False, colourBlend=False, alphaBlend=False)
    qa_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError) as error:
        print(f"pixelate_regions.py: {error}", file=sys.stderr)
        raise SystemExit(1)
