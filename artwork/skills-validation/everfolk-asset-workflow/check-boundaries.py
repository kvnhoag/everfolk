"""Task-owned behavioural validation of the staged reusable CLI."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
RUNTIME = PROJECT / "artifacts/pixeloe-runtime/site-packages"
SKILL = PROJECT / "artwork/skills/everfolk-asset-workflow"
SOURCE = PROJECT / "artwork/cards/alexander-equipment-v5/source/alexander-equipment-revised.png"
sys.path.insert(0, str(RUNTIME))
sys.dont_write_bytecode = True
import cv2
import numpy as np


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*extra):
    return subprocess.run([sys.executable, str(SKILL / "scripts/pixelate.py"),
                           "--runtime", str(RUNTIME), *map(str, extra)],
                          capture_output=True, text=True)


def main():
    before = digest(SOURCE)
    fixture_root = ROOT / "alpha-boundary"
    fixture_root.mkdir(exist_ok=False)
    bgr = cv2.imread(str(SOURCE))
    opaque = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    opaque_path = fixture_root / "opaque-rgba.png"
    transparent_path = fixture_root / "transparent-rgba.png"
    assert cv2.imwrite(str(opaque_path), opaque)
    opaque[0, 0, 3] = 127
    assert cv2.imwrite(str(transparent_path), opaque)
    opaque_result = run("--input", opaque_path, "--output", fixture_root / "opaque-result.png")
    assert opaque_result.returncode == 0, opaque_result.stderr
    assert digest(fixture_root / "opaque-result.png") == digest(ROOT / "default/portrait-pixel.png")
    rejected_path = fixture_root / "transparent-result.png"
    transparent_result = run("--input", transparent_path, "--output", rejected_path)
    assert transparent_result.returncode == 1
    assert "Transparent input" in transparent_result.stderr
    assert not rejected_path.exists()
    source_overwrite = run("--input", SOURCE, "--output", SOURCE, "--overwrite")
    assert source_overwrite.returncode == 1
    assert "cannot overwrite input/config" in source_overwrite.stderr
    assert digest(SOURCE) == before
    assert digest(ROOT / "default/portrait-pixel.png") == digest(PROJECT / "artwork/cards/alexander-equipment-v5/assets/alexander-card-pixel.png")
    assert digest(ROOT / "default/portrait-pixel.logical.png") == digest(PROJECT / "artwork/cards/alexander-equipment-v5/assets/alexander-card-pixel.logical.png")
    summary = {"opaqueRGBAAccepted": True, "opaqueRGBAMatchesRGB": True,
               "partialAlphaRejected": True, "alphaRejectionWroteNoOutput": True,
               "sourceOverwriteRejected": True, "sourceUnchanged": True,
               "defaultMatchesV5EnlargedPNG": True, "defaultMatchesV5LogicalPNG": True,
               "defaultOutputSha256": digest(ROOT / "default/portrait-pixel.png"),
               "defaultLogicalSha256": digest(ROOT / "default/portrait-pixel.logical.png"),
               "transparentError": transparent_result.stderr.strip()}
    (ROOT / "validation-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
