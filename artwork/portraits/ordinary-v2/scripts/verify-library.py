#!/usr/bin/env python3
"""Verify v2 source links, fixed M/F geometry, skin variants and portrait map."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def require(value, message):
    if not value:
        raise ValueError(message)


def path(value):
    result = (ROOT / value).resolve(strict=True)
    require(result.is_relative_to(ROOT.parent), "Asset reference escapes portrait libraries: " + value)
    return result


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def check_record(record):
    pairs = (("path", "sha256"), ("source", "sourceSha256"), ("assembled", "assembledSha256"), ("logical", "logicalSha256"), ("frontHairPath", "frontHairSha256"), ("skinMask", "skinMaskSha256"))
    for location, digest in pairs:
        if isinstance(record.get(location), str) and isinstance(record.get(digest), str):
            require(sha(path(record[location])) == record[digest], "Hash mismatch: " + record[location])


def main():
    manifest = read(ROOT / "manifest.json")
    source_index = read(ROOT / "source-index.json")
    mappings = read(ROOT / "../ordinary-v1/mappings.json")
    world = read(REPO / "worlds/alexandria-sample.json")
    require(manifest["canonicalBodyGeometryCount"] == 2, "Exactly two M/F body geometries required")
    require(manifest["physicalBodyPresentInEveryAssembly"], "Physical body contract missing")
    require(world["version"] == mappings["worldVersion"], "World changed; review mappings")
    require({j["id"] for j in world["character"]["jobs"]} == {j["id"] for j in manifest["jobWardrobeBindings"]}, "Job map drift")
    require({p["id"] for p in world["character"]["partners"]} == {p["id"] for p in manifest["encounterWardrobeBindings"]}, "Encounter map drift")
    require(len(source_index["assets"]) == 58, "Source inventory mismatch")
    for source in source_index["assets"]:
        check_record(source)
        for provenance in source.get("provenance", []):
            path(provenance)
    geometry_alpha = {}
    for record in manifest["canonicalBodies"]:
        check_record(record)
        with Image.open(path(record["path"])) as im:
            require(im.mode == "RGBA" and im.size == (800, 1000), "Invalid canonical body canvas")
            geometry_alpha[record["sex"]] = im.getchannel("A").copy()
    require(set(geometry_alpha) == {"male", "female"}, "Missing body sex")
    for record in manifest["skinPaletteBodies"]:
        check_record(record)
        with Image.open(path(record["path"])) as im:
            require(ImageChops.difference(im.getchannel("A"), geometry_alpha[record["sex"]]).getbbox() is None, "Skin variation changed body shape")
        require(record["outsideSkinMaskPixelsUnchanged"], "Skin transfer altered garment pixels")
    require(len(manifest["skinPaletteBodies"]) == 36, "Expect one skin match for every identity and age")
    for key in ("ageBodyPlacements", "heads", "garments", "assemblies"):
        for record in manifest[key]:
            check_record(record)
    portraits = manifest["portraits"]
    ids = {p["id"] for p in portraits}
    require(len(portraits) == len(ids) == 192, "Portrait count or ID uniqueness failure")
    for portrait in portraits:
        check_record(portrait)
        with Image.open(path(portrait["path"])) as im:
            require(im.mode == "RGB" and im.size == (384, 480), "Invalid final portrait: " + portrait["id"])
        require(portrait.get("bodyId") is not None, "Final portrait has no body binding")
        qa = read(path(portrait["qa"]))
        require(qa["basePixelSize"] == 3 and qa["detailPixelSize"] == 2 and qa["commonCellSize"] == 6 and qa["uniformLogicalGrid"] is False, "Agreed mixed-grid profile missing")
        require(qa["outsideMaskChangedPixels"] == 0 and qa["selectedDetailDifferingPixels"] == 0 and qa["sourceBaseFineFilesUnchanged"], "Regional preservation check failed")
        for location, digest in (("coarsePath", "coarseSha256"), ("finePath", "fineSha256"), ("maskPath", "maskSha256"), ("configPath", "configSha256"), ("outputPath", "outputSha256")):
            require(sha(path(qa[location])) == qa[digest], "Mixed finish dependency hash mismatch")
        with Image.open(path(qa["coarsePath"])) as im:
            coarse = np.asarray(im.convert("RGB")).copy()
        with Image.open(path(qa["finePath"])) as im:
            fine = np.asarray(im.convert("RGB")).copy()
        with Image.open(path(qa["maskPath"])) as im:
            mask = np.asarray(im.convert("L")) == 255
        with Image.open(path(portrait["path"])) as im:
            mixed = np.asarray(im.convert("RGB")).copy()
        require(np.array_equal(mixed[~mask], coarse[~mask]) and np.array_equal(mixed[mask], fine[mask]), "Final does not preserve exact selected pixels")
        cells = mask.reshape(80, 6, 64, 6)
        require(np.array_equal(cells.any(axis=(1, 3)), cells.all(axis=(1, 3))), "Selection splits a common cell")
        for rgb, block in ((coarse, 3), (fine, 2)):
            blocks = rgb.reshape(480 // block, block, 384 // block, block, 3)
            require(np.array_equal(blocks, np.broadcast_to(blocks[:, :1, :, :1, :], blocks.shape)), "Pixel pass has interpolated blocks")
        for critical in qa["criticalCoverage"]:
            x0, y0, x1, y1 = critical["box"]
            require(mask[y0:y1, x0:x1].all(), "Eye region lost finer detail")
        for pass_key in ("coarseQA", "fineQA"):
            pass_qa = read(path(qa[pass_key]))
            require(all(pass_qa[k] for k in ("deterministic", "exactIntegerBlocks", "pngReadbackExact", "sourceUnchanged")), "PixelOE pass QA failed")
    bridges = manifest["legacySlotBridges"]
    require(len(bridges) == 288 and all(b["portraitId"] in ids for b in bridges), "Dangling legacy slot")
    require(len(manifest["originSelectors"]) == 16 and len(manifest["jobWardrobeBindings"]) == 33 and len(manifest["encounterWardrobeBindings"]) == 16, "Content mapping coverage incomplete")
    require(manifest["sourceIntegrity"]["allProtectedInputsUnchanged"], "Source integrity failed")
    for filename in ("README.md", "AGENT_MAP.md", "contract.json", "head-anchors.json", "female-wardrobe-anchors.json", "review/index.html", "review/adult-identities.png", "references/credits.json"):
        path(filename)
    result = {"status": "passed", "worldVersion": world["version"], "canonicalBodyGeometries": 2, "identityAgeSkinPalettes": len(manifest["skinPaletteBodies"]), "sameBodyAlphaAcrossSkinVariations": True, "sourceAssets": 58, "portraits": 192, "legacyBridges": 288, "jobs": 33, "origins": 16, "encounters": 16, "sourceHashesAndPaths": True, "agreedCoarse3Fine2Filter": True, "outsideFaceExactCoarsePixels": True, "whole6PixelCells": True, "finerEyeCoverage": True, "runtimeIntegrated": manifest["runtimeIntegrated"], "visualReview": "See qa/body-fit-visual-review.json; geometry/hash checks alone do not establish anatomical fit."}
    (ROOT / "qa/library-audit.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
