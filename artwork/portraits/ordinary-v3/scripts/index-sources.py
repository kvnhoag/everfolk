#!/usr/bin/env python3
"""Index v3 continuous models, face edits and immutable v2 wardrobe dependencies.

Uses existing Pillow; installs nothing. Writes only this library's source-index.json.
Copied adult baselines/proof edits point to their existing exact prompts and
generation sidecars instead of creating duplicate or invented provenance.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT.parent
V2 = PORTRAITS / "ordinary-v2"
PROOF = PORTRAITS / "ordinary-v3-neck-proof"
STAGES = ("infant", "child", "youth", "adult", "middle", "elder")
WARDROBES = ("everyday", "work", "maritime", "commerce", "scholarly",
             "military", "elite", "performance", "infant")
NEW_WARDROBES = ("royalty", "aristocrat")
ORIGINAL_KEYS = ("toolOriginalPath", "generatedOriginal", "originalGeneratedPath",
                 "generatedPath", "sourcePath", "originalPath", "toolFile")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def required(path):
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def rel(path):
    resolved = path.resolve()
    if not resolved.is_relative_to(PORTRAITS.resolve()):
        raise ValueError(f"Project pointer escapes artwork/portraits: {path}")
    return Path(os.path.relpath(resolved, ROOT)).as_posix()


def metadata_source(path):
    own = path.with_suffix(".generation.json")
    if own.is_file():
        return ROOT, own, None
    match = re.fullmatch(r"ef-model-(male|female)-adult-v3", path.stem)
    if match:
        original = V2 / "source/body-references" / f"ef-r-{match[1]}-waist-v2.png"
        return V2, required(original.with_suffix(".generation.json")), required(original)
    match = re.fullmatch(r"ef-face-(m02|f02)-adult-v3", path.stem)
    if match:
        sex = "male" if match[1] == "m02" else "female"
        original = PROOF / "source" / f"ef-face-only-{sex}-v3.png"
        return PROOF, required(original.with_suffix(".generation.json")), required(original)
    raise ValueError(f"No generation sidecar or explicit copied-source mapping: {path.stem}")


def original_check(metadata, digest, asset_id):
    original = next((metadata[key] for key in ORIGINAL_KEYS
                     if isinstance(metadata.get(key), str)
                     and "generated_images" in metadata[key]), None)
    if original is None:
        raise ValueError(f"Missing original tool-file pointer: {asset_id}")
    original_path = Path(original)
    record = {"toolOriginalPath": original,
              "toolOriginalAvailable": original_path.is_file(),
              "originalCopyExact": None}
    if original_path.is_file():
        original_hash = sha(original_path)
        if original_hash != digest:
            raise ValueError(f"PNG differs from original image-generation output: {asset_id}")
        record.update(toolOriginalSha256=original_hash, originalCopyExact=True)
    return record


def references(metadata, metadata_root):
    candidates = []
    for key in ("reference", "referencePath"):
        if isinstance(metadata.get(key), str):
            candidates.append(metadata[key])
    for key in ("references", "referencePaths", "refs"):
        if isinstance(metadata.get(key), list):
            candidates.extend(value for value in metadata[key] if isinstance(value, str))
    result = []
    for value in candidates:
        path = Path(value)
        if not path.is_absolute():
            path = metadata_root / path
        result.append(rel(required(path)))
    return list(dict.fromkeys(result))


def index_png(path, kind, dependency=False):
    asset_id = path.stem
    if dependency:
        metadata_root, sidecar, copied_source = V2, required(path.with_suffix(".generation.json")), None
    else:
        metadata_root, sidecar, copied_source = metadata_source(path)
    metadata = read_json(sidecar)
    metadata_id = metadata.get("id", metadata.get("assetId"))
    if copied_source is None and metadata_id != asset_id:
        raise ValueError(f"Generation sidecar ID mismatch: {asset_id}")
    prompt_value = metadata.get("promptPath", metadata.get("prompt"))
    if not isinstance(prompt_value, str):
        raise ValueError(f"Missing exact prompt path: {asset_id}")
    prompt = Path(prompt_value)
    if not prompt.is_absolute():
        prompt = metadata_root / prompt
    required(prompt)
    if copied_source is None and metadata_root == ROOT:
        expected = ROOT / "source/prompts" / f"{asset_id}-prompt.txt"
        if prompt.resolve() != expected.resolve():
            raise ValueError(f"V3 asset prompt must use its exact stable ID: {asset_id}")
    digest = sha(path)
    if copied_source is not None and sha(copied_source) != digest:
        raise ValueError(f"Copied adult source differs from preserved earlier raw source: {asset_id}")
    with Image.open(path) as image:
        image.load()
        if image.mode != "RGBA":
            raise ValueError(f"Source PNG must preserve RGBA: {asset_id}")
        alpha = image.getchannel("A")
        extrema = alpha.getextrema()
        bounds = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
        if extrema[0] != 0 or extrema[1] < 128 or bounds is None:
            raise ValueError(f"Source PNG lacks a usable transparent cutout: {asset_id}")
        record = {
            "id": asset_id, "kind": kind,
            "role": "reused-wardrobe-dependency" if dependency else
                    "continuous-whole-person-age-model" if kind == "models" else
                    "clothing-only-overlay-on-canonical-adult-model" if kind == "wardrobe" else
                    "internal-face-feature-edit-on-whole-model",
            "path": rel(path), "sha256": digest,
            "size": list(image.size), "mode": image.mode,
            "alphaExtrema": list(extrema), "visibleBoundsAlpha128": list(bounds),
            "fullyOpaquePixelsPresent": extrema[1] == 255,
            "prompt": rel(prompt), "promptSha256": sha(prompt), "promptLocalOnly": True,
            "provenance": [rel(sidecar)], "provenanceSha256": sha(sidecar),
            "provenanceAssetId": metadata_id,
            "referencePaths": references(metadata, metadata_root),
            "sourceStatus": "reused-dependency" if dependency else
                            "copied-preserved-original" if copied_source else "new-generated",
            "generator": "built-in image_gen",
        }
    if copied_source is not None:
        record.update(copiedFrom=rel(copied_source), copyMatchesPreservedSource=True)
    if kind == "models":
        match = re.fullmatch(r"ef-model-(male|female)-(" + "|".join(STAGES) + r")-v3", asset_id)
        if not match:
            raise ValueError(f"Unknown continuous-model ID: {asset_id}")
        record.update(sex=match[1], stage=match[2], noManualHeadOrNeckCut=True)
    elif kind == "faces":
        match = re.fullmatch(r"ef-face-([mf]0[23])-(" + "|".join(STAGES) + r")-v3", asset_id)
        if not match:
            raise ValueError(f"Unknown internal-feature identity ID: {asset_id}")
        sex = "male" if match[1].startswith("m") else "female"
        model = required(ROOT / "source/models" / f"ef-model-{sex}-{match[2]}-v3.png")
        record.update(identityId=match[1], sex=sex, stage=match[2],
                      canonicalModel=rel(model),
                      preservationPolicy="Use only the interior face from this raw edit; canonical complete model remains authoritative outside that face region. Never cut or substitute the head/neck.")
    elif kind == "wardrobe":
        match = re.fullmatch(r"ef-w-(male|female)-(.+)-(v[23])", asset_id)
        expected_version = "v2" if dependency else "v3"
        expected_families = WARDROBES if dependency else NEW_WARDROBES
        if not match or match[2] not in expected_families or match[3] != expected_version:
            raise ValueError(f"Unknown wardrobe source/dependency: {asset_id}")
        record.update(sex=match[1], wardrobeId=match[2],
                      dependencyUse="Recorded raw wardrobe source; infant wrap retained as a dependency even when the continuous infant model's swaddle is used instead." if dependency else
                                    "New clothing-only royalty/aristocrat overlay; does not create or replace a body model.")
        if not dependency:
            model = required(ROOT / "source/models" / f"ef-model-{match[1]}-adult-v3.png")
            record.update(canonicalModel=rel(model),
                          fitPolicy="Original adult canonical model is the body authority. Clothing-only overlay, requested original native-frame placement; register and verify fit in derived pipeline.")
    record.update(original_check(metadata, digest, asset_id))
    return record


def main():
    assets = []
    for kind, expected in (("models", 12), ("faces", 24), ("wardrobe", 4)):
        paths = sorted((ROOT / "source" / kind).glob("*.png"))
        if len(paths) != expected:
            raise ValueError(f"Expected {expected} {kind} source PNGs; found {len(paths)}")
        assets.extend(index_png(path, kind) for path in paths)
    expected_model_ids = {f"ef-model-{sex}-{stage}-v3" for sex in ("male", "female") for stage in STAGES}
    expected_face_ids = {f"ef-face-{identity}-{stage}-v3" for identity in ("m02", "m03", "f02", "f03") for stage in STAGES}
    expected_wardrobe_ids = {f"ef-w-{sex}-{family}-v3" for sex in ("male", "female") for family in NEW_WARDROBES}
    if {record["id"] for record in assets} != expected_model_ids | expected_face_ids | expected_wardrobe_ids:
        raise ValueError("V3 model/identity-stage/new-wardrobe source coverage is incomplete")
    dependencies = []
    for sex in ("male", "female"):
        for family in WARDROBES:
            source = required(V2 / "source/wardrobe" / f"ef-w-{sex}-{family}-v2.png")
            dependencies.append(index_png(source, "wardrobe", dependency=True))
    all_records = assets + dependencies
    unavailable = [record["id"] for record in all_records if record["originalCopyExact"] is None]
    result = {
        "schemaVersion": 1, "libraryId": "everfolk-ordinary-portraits-v3",
        "indexer": "scripts/index-sources.py", "generator": "built-in image_gen",
        "counts": {"models": 12, "internalFaceEdits": 24, "newWardrobeSources": 4, "sourcePNGs": 40,
                   "wardrobeDependencies": 16, "wrapDependencies": 2, "dependencyPNGs": 18,
                   "totalIndexedPNGs": 58,
                   "copiedAdultOriginals": sum(record["sourceStatus"] == "copied-preserved-original" for record in assets)},
        "sourcePolicy": "All PNGs are immutable raw image-generation outputs or exact copies. Project paths are portable relative pointers within artwork/portraits; absolute toolOriginalPath fields preserve original external tool provenance. Exact prompts remain local and ignored. No source image, prompt or sidecar is modified by this indexer.",
        "anatomyPolicy": "Each sex/age model is a continuously painted complete person. Face edits supply interior facial features only; preserve the complete canonical head, jaw, neck, shoulders and body outside the internal-face region.",
        "assets": assets, "dependencies": dependencies,
        "audit": {"status": "passed" if not unavailable else "passed-with-unavailable-tool-files",
                  "sourcePNGsIndexed": len(assets), "dependenciesIndexed": len(dependencies),
                  "exactPromptsLocated": len(all_records), "generationSidecarsLocated": len(all_records),
                  "originalCopiesVerified": sum(record["originalCopyExact"] is True for record in all_records),
                  "originalToolFilesUnavailable": unavailable, "copyMismatches": [],
                  "sourcesWithoutAlpha255": [record["id"] for record in all_records
                                             if not record["fullyOpaquePixelsPresent"]],
                  "allSourcePNGAlphaVerified": True, "sourceImagesModified": False,
                  "copiedAdultPromptsAndSidecars": "Portable pointers to original v2 complete-body and v3-neck-proof raw-edit provenance."},
    }
    destination = ROOT / "source-index.json"
    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sourceIndex": str(destination), "counts": result["counts"], "audit": result["audit"]}))


if __name__ == "__main__":
    main()
