#!/usr/bin/env python3
"""Compose registered coarse-3px/fine-2px PixelOE passes without blending.

The regional ellipse, global 4x4 Bayer thresholds and complete LCM cells follow
the installed Everfolk pixelate_regions.py algorithm. Eye-critical boxes also
force every intersecting common cell to the fine pass. PixelOE rendering,
outline thickness 0, repeat-render verification and PNG I/O belong to the caller.
This module never reads or writes files and never changes its input arrays.
"""
from __future__ import annotations

import hashlib
import math

import numpy as np


OUTPUT = (384, 480)
BASE_PIXEL_SIZE = 3
DETAIL_PIXEL_SIZE = 2
COMMON_CELL_SIZE = math.lcm(BASE_PIXEL_SIZE, DETAIL_PIXEL_SIZE)


def _point(value, label):
    if not isinstance(value, (list, tuple, np.ndarray)) or len(value) != 2:
        raise ValueError(f"{label} must be a two-coordinate point")
    point = tuple(float(coordinate) for coordinate in value)
    if not all(math.isfinite(coordinate) for coordinate in point):
        raise ValueError(f"{label} coordinates must be finite")
    return point


def _pixel_hash(array):
    return hashlib.sha256(array.tobytes(order="C")).hexdigest()


def _check_blocks(array, pixel_size, label):
    height, width = array.shape[:2]
    logical = array[::pixel_size, ::pixel_size]
    blocks = array.reshape(height // pixel_size, pixel_size,
                           width // pixel_size, pixel_size, 3)
    if not np.all(blocks == logical[:, None, :, None, :]):
        raise ValueError(f"{label} lacks exact registered {pixel_size}x{pixel_size} blocks")


def compose_registered(coarse_rgb, fine_rgb, eye_target, chin_target,
                       source_canvas=(800, 1000)):
    """Return ``(mixed_rgb, mask_bool, config, qa)`` for matched 384x480 RGB.

    Both arrays must be uint8 HWC RGB with origin (0,0). ``coarse_rgb`` must
    contain exact 3x3 blocks from 128x160; ``fine_rgb`` exact 2x2 blocks from
    192x240. The caller must create the fine pass with outline thickness 0.
    ``eye_target`` is the eye midpoint and ``chin_target`` the chin midpoint,
    expressed in the assembled ``source_canvas`` pixel coordinates. Returned
    region/box coordinates are in the 384x480 output canvas, not source pixels.
    A true mask value selects the fine pass. No palette reduction is performed.
    """
    width, height = OUTPUT
    for array, label in ((coarse_rgb, "Coarse RGB"), (fine_rgb, "Fine RGB")):
        if not isinstance(array, np.ndarray) or array.dtype != np.uint8:
            raise ValueError(f"{label} must be a NumPy uint8 array")
        if array.shape != (height, width, 3):
            raise ValueError(f"{label} must have shape (480,384,3), received {array.shape}")
    _check_blocks(coarse_rgb, BASE_PIXEL_SIZE, "Coarse RGB")
    _check_blocks(fine_rgb, DETAIL_PIXEL_SIZE, "Fine RGB")
    coarse_hash, fine_hash = _pixel_hash(coarse_rgb), _pixel_hash(fine_rgb)

    source_width, source_height = _point(source_canvas, "source_canvas")
    if source_width <= 0 or source_height <= 0:
        raise ValueError("source_canvas dimensions must be positive")
    eye_x, eye_y = _point(eye_target, "eye_target")
    chin_x, chin_y = _point(chin_target, "chin_target")
    if not (0 <= eye_x < source_width and 0 <= eye_y < source_height
            and 0 <= chin_x < source_width and 0 <= chin_y < source_height):
        raise ValueError("Eye and chin targets must be inside source_canvas")
    if chin_y <= eye_y:
        raise ValueError("Chin target must lie below the eye midpoint")
    distance = math.hypot(chin_x - eye_x, chin_y - eye_y)
    sx, sy = width / source_width, height / source_height
    center = [eye_x * sx, (eye_y + .25 * distance) * sy]
    radius = [.72 * distance * sx, distance * sy]
    box = [math.floor((eye_x - .55 * distance) * sx),
           math.floor((eye_y - .12 * distance) * sy),
           math.ceil((eye_x + .55 * distance) * sx),
           math.ceil((eye_y + .12 * distance) * sy)]
    if box[0] < 0 or box[1] < 0 or box[2] > width or box[3] > height:
        raise ValueError("Eye-critical band extends outside the output canvas")
    if box[0] >= box[2] or box[1] >= box[3]:
        raise ValueError("Eye-critical band has no area")
    config = {
        "base_pixel_size": BASE_PIXEL_SIZE,
        "detail_pixel_size": DETAIL_PIXEL_SIZE,
        "detail_outline_thickness": 0,
        "coordinateSpace": "output pixels; origin upper-left",
        "source_canvas": [source_width, source_height],
        "eye_target": [eye_x, eye_y],
        "chin_target": [chin_x, chin_y],
        "regions": [{"name": "face", "center": center, "radius": radius,
                     "inner_scale": .82}],
        "critical_boxes": [{"name": "eyes", "box": box}],
        "critical_selection": "Force every common 6x6 cell intersecting an eye box",
    }

    cell_size = COMMON_CELL_SIZE
    rows, columns = height // cell_size, width // cell_size
    yy, xx = np.meshgrid((np.arange(rows) + .5) * cell_size,
                         (np.arange(columns) + .5) * cell_size, indexing="ij")
    weights = np.zeros((rows, columns), dtype=np.float64)
    for region in config["regions"]:
        cx, cy = region["center"]
        rx, ry = region["radius"]
        radial_distance = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        weight = np.clip((1 - radial_distance) / (1 - region["inner_scale"]), 0, 1)
        weights = np.maximum(weights, weight)
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6],
                      [3, 11, 1, 9], [15, 7, 13, 5]])
    thresholds = (bayer[np.arange(rows)[:, None] % 4,
                        np.arange(columns)[None, :] % 4] + .5) / 16
    selected_cells = weights > thresholds
    bayer_selected_cells = selected_cells.copy()
    for critical in config["critical_boxes"]:
        x0, y0, x1, y1 = critical["box"]
        selected_cells[y0 // cell_size:(y1 + cell_size - 1) // cell_size,
                       x0 // cell_size:(x1 + cell_size - 1) // cell_size] = True
    mask = np.repeat(np.repeat(selected_cells, cell_size, axis=0), cell_size, axis=1)
    if not mask.any() or mask.all():
        raise ValueError("Face region must select fine cells and retain coarse cells")
    if not np.all(mask.reshape(rows, cell_size, columns, cell_size)
                  == selected_cells[:, None, :, None]):
        raise RuntimeError("Regional mask cuts a common 6x6 cell")

    critical_coverage = []
    for critical in config["critical_boxes"]:
        x0, y0, x1, y1 = critical["box"]
        pixels = (x1 - x0) * (y1 - y0)
        selected = int(mask[y0:y1, x0:x1].sum())
        if selected != pixels:
            raise RuntimeError("Eye-critical band is not entirely from the fine pass")
        critical_coverage.append({"name": critical["name"], "box": critical["box"],
                                  "selectedPixels": selected, "totalPixels": pixels,
                                  "detailCoverage": 1.0})
    mixed = np.where(mask[:, :, None], fine_rgb, coarse_rgb)
    if not np.array_equal(mixed, np.where(mask[:, :, None], fine_rgb, coarse_rgb)):
        raise RuntimeError("Regional composition repeat mismatch")
    outside_differences = int(np.count_nonzero(np.any(mixed[~mask] != coarse_rgb[~mask], axis=1)))
    selected_differences = int(np.count_nonzero(np.any(mixed[mask] != fine_rgb[mask], axis=1)))
    if outside_differences or selected_differences:
        raise RuntimeError("Mixed result differs from its selected registered source")
    if _pixel_hash(coarse_rgb) != coarse_hash or _pixel_hash(fine_rgb) != fine_hash:
        raise RuntimeError("Input pixel array changed during regional composition")
    qa = {
        "method": "Regional PixelOE whole-common-cell Bayer selection plus forced eye-critical cells",
        "gridType": "mixed-grid; no single logical grid",
        "output": [width, height],
        "baseLogical": [128, 160], "detailLogical": [192, 240],
        "basePixelSize": BASE_PIXEL_SIZE, "detailPixelSize": DETAIL_PIXEL_SIZE,
        "detailOutlineThicknessRequired": 0, "commonCellSize": cell_size,
        "gridOrigin": [0, 0], "sourceCanvas": [source_width, source_height],
        "coarsePixelSha256": coarse_hash, "finePixelSha256": fine_hash,
        "mixedPixelSha256": _pixel_hash(mixed),
        "maskPixelSha256": hashlib.sha256(mask.astype(np.uint8).tobytes()).hexdigest(),
        "selectedDetailCells": int(selected_cells.sum()),
        "retainedCoarseCells": int((~selected_cells).sum()),
        "criticalForcedAdditionalCells": int(np.count_nonzero(selected_cells & ~bayer_selected_cells)),
        "criticalForcedOutsideEllipseSupportCells": int(np.count_nonzero(selected_cells & (weights == 0))),
        "affectedPixels": int(mask.sum()),
        "changedPixels": int(np.count_nonzero(np.any(mixed != coarse_rgb, axis=2))),
        "outsideMaskChangedPixels": outside_differences,
        "selectedDetailDifferingPixels": selected_differences,
        "criticalCoverage": critical_coverage,
        "innerRegionFullDetail": bool(np.all(selected_cells[weights == 1])),
        "cellCenterEllipseSampling": True,
        "transition": "4x4 Bayer threshold (entry + 0.5) / 16, global common-cell origin",
        "registeredExactIntegerBlocks": True, "wholeCommonCells": True,
        "deterministicComposition": True, "coarseUnchanged": True, "fineUnchanged": True,
        "interpolatingUpscale": False, "colourBlend": False, "alphaBlend": False,
        "paletteQuantization": False,
        "callerChecksRequired": ["fine PixelOE outline thickness 0", "repeat PixelOE render equality",
                                 "source/base/fine/mixed PNG hashes", "PNG write/readback equality"],
    }
    return mixed, mask, config, qa
