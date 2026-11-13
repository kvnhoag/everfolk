"""Apply published PixelOE to the clean portrait; keep frame and type separate."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'artifacts' / 'pixeloe-runtime' / 'site-packages'))
sys.dont_write_bytecode = True
import cv2
import numpy as np
import torch
from pixeloe.legacy.pixelize import pixelize
from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def main():
    cv2.setNumThreads(4)
    torch.set_num_threads(4)
    source = ROOT / 'source' / 'alexander-card-clean.png'
    output = ROOT / 'assets' / 'alexander-card-pixel.png'
    native = ROOT / 'assets' / 'alexander-card-pixel.logical.png'
    original_hash = sha(source)
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError('Could not read card source')
    options = dict(mode='contrast', target_size=(140, 175), patch_size=4,
                   pixel_size=6, thickness=1, color_matching=True,
                   contrast=1.0, saturation=1.0, colors=None, no_upscale=True,
                   no_downscale=True)
    # Upstream's area -> width/height float conversion can truncate this grid
    # by one row/column. Use its own downsampler with a positive rounding epsilon.
    target_area_root = float(np.sqrt(140 * 175)) + 1e-6
    logical = contrast_based_downscale(pixelize(image.copy(), **options), target_area_root)
    repeated = contrast_based_downscale(pixelize(image.copy(), **options), target_area_root)
    if logical.shape[:2] != (175, 140) or not np.array_equal(logical, repeated):
        raise RuntimeError(f'Grid or repeat-render mismatch: {logical.shape}, equal={np.array_equal(logical, repeated)}')
    enlarged = cv2.resize(logical, (840, 1050), interpolation=cv2.INTER_NEAREST)
    if not cv2.imwrite(str(native), logical) or not cv2.imwrite(str(output), enlarged):
        raise RuntimeError('Could not write card illustration')
    readback = cv2.imread(str(output), cv2.IMREAD_COLOR)
    if not np.all(readback.reshape(175, 6, 140, 6, 3) == logical[:, None, :, None, :]):
        raise RuntimeError('Pixel blocks are not exact')
    if sha(source) != original_hash:
        raise RuntimeError('Source changed')
    record = dict(source=str(source), sourceSha256=original_hash,
                  sourceSize=[image.shape[1], image.shape[0]],
                  method='PixelOE 1.0.0 legacy CPU API', options=options,
                  explicitGridRoundingEpsilon=1e-6,
                  logical=[140, 175], output=[840, 1050], outputSha256=sha(output),
                  deterministic=True, exactIntegerBlocks=True, sourceUnchanged=True)
    (ROOT / 'qa' / 'portrait-pixel.json').write_text(json.dumps(record, indent=2), encoding='utf8')
    print(json.dumps(record))

if __name__ == '__main__':
    main()
