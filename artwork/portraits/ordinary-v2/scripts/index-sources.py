#!/usr/bin/env python3
"""Index immutable v2 sources and reused v1 heads without rebuilding artwork.

Run with the project's existing Python/Pillow environment. This script writes
only source-index.json and qa/source-index-audit.json beside this script's
library. It never changes source images, prompts, sidecars or v1 files.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
import re

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT.parent
V1 = PORTRAITS / "ordinary-v1"
EXPECTED_NEW = {"body-references": 2, "bodies": 2, "wardrobe": 18}
ORIGINAL_KEYS = (
    "toolOriginalPath", "generatedOriginal", "originalGeneratedPath",
    "generatedPath", "sourcePath", "originalPath", "toolFile",
)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative(path: Path) -> str:
    """Keep project asset pointers portable and inside the portraits tree."""
    resolved = path.resolve()
    if not resolved.is_relative_to(PORTRAITS.resolve()):
        raise ValueError(f"Project source path escapes portraits: {path}")
    return Path(os.path.relpath(resolved, ROOT)).as_posix()


def required(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def find_original(metadata: dict) -> str | None:
    for key in ORIGINAL_KEYS:
        value = metadata.get(key)
        if isinstance(value, str) and "generated_images" in value:
            return value
    return None


def check_original(original: str | None, digest: str, asset_id: str) -> dict:
    if not original:
        raise ValueError(f"Missing original tool-file provenance: {asset_id}")
    original_path = Path(original)
    if not original_path.is_file():
        return {
            "toolOriginalPath": original,
            "toolOriginalAvailable": False,
            "originalCopyExact": None,
            "originalCopyCheck": "unavailable",
        }
    original_digest = sha(original_path)
    if original_digest != digest:
        raise ValueError(f"Source differs from original tool PNG: {asset_id}")
    return {
        "toolOriginalPath": original,
        "toolOriginalAvailable": True,
        "toolOriginalSha256": original_digest,
        "originalCopyExact": True,
        "originalCopyCheck": "verified",
    }


def reference_paths(metadata: dict) -> list[str]:
    candidates = []
    if isinstance(metadata.get("referencePath"), str):
        candidates.append(metadata["referencePath"])
    for field in ("referencePaths", "refs"):
        if isinstance(metadata.get(field), list):
            candidates.extend(value for value in metadata[field] if isinstance(value, str))
    result = []
    for value in candidates:
        path = Path(value)
        if not path.is_absolute():
            path = ROOT / path
        result.append(relative(required(path)))
    return list(dict.fromkeys(result))


def index_new(path: Path, kind: str) -> dict:
    asset_id = path.stem
    prompt = required(ROOT / "source" / "prompts" / f"{asset_id}-prompt.txt")
    sidecar = required(path.with_suffix(".generation.json"))
    metadata = read_json(sidecar)
    recorded_id = metadata.get("assetId", metadata.get("id"))
    if recorded_id != asset_id:
        raise ValueError(f"Sidecar asset ID mismatch: {asset_id}")
    digest = sha(path)
    with Image.open(path) as image:
        image.load()
        if image.mode != "RGBA":
            raise ValueError(f"Source must retain RGBA: {asset_id}")
        alpha = image.getchannel("A")
        extrema = alpha.getextrema()
        bounds = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
        if extrema != (0, 255) or bounds is None:
            raise ValueError(f"Missing usable transparency or fabric/body: {asset_id}")
        record = {
            "id": asset_id,
            "kind": kind,
            "sourceStatus": "new-generated",
            "role": {
                "body-references": "complete-body-reference",
                "bodies": "default-body",
                "wardrobe": "default-wardrobe",
            }[kind],
            "path": relative(path),
            "sha256": digest,
            "size": list(image.size),
            "mode": image.mode,
            "alphaExtrema": list(extrema),
            "visibleBoundsAlpha128": list(bounds),
            "prompt": relative(prompt),
            "promptSha256": sha(prompt),
            "promptLocalOnly": True,
            "provenance": [relative(sidecar)],
            "provenanceSha256": sha(sidecar),
            "referencePaths": reference_paths(metadata),
            "generator": "built-in image_gen",
        }
    sex = re.search(r"^ef-[rbw]-(female|male)(?:-|$)", asset_id)
    if not sex:
        raise ValueError(f"Unrecognized source sex/ID: {asset_id}")
    record["sex"] = sex.group(1)
    if kind == "wardrobe":
        record["wardrobeId"] = asset_id.removeprefix(f"ef-w-{sex.group(1)}-").removesuffix("-v2")
    record.update(check_original(find_original(metadata), digest, asset_id))
    return record


def reused_head(record: dict) -> dict:
    """Retain v1 identity metadata while making all asset pointers v2-relative."""
    result = copy.deepcopy(record)
    asset_id = result["id"]
    path = required(V1 / result["path"])
    digest = sha(path)
    if digest != result["sha256"]:
        raise ValueError(f"Reused head differs from v1 index: {asset_id}")
    result["path"] = relative(path)
    prompt = required(V1 / result["prompt"])
    if sha(prompt) != result["promptSha256"]:
        raise ValueError(f"Reused prompt differs from v1 index: {asset_id}")
    result["prompt"] = relative(prompt)
    result["provenance"] = [relative(required(V1 / value)) for value in result["provenance"]]
    result["sourceStatus"] = "reused"
    result["identityRole"] = "reused"
    result["role"] = "reused-identity-head"
    result["reusedFrom"] = "../ordinary-v1/source-index.json"
    result["reusedOriginalPreserved"] = True
    for field in ("referencePaths",):
        if field in result:
            result[field] = [relative(required(V1 / value)) for value in result[field]]
    result.update(check_original(result.get("toolOriginalPath"), digest, asset_id))
    return result


def main() -> None:
    new_assets = []
    counts = {}
    for kind, expected in EXPECTED_NEW.items():
        paths = sorted((ROOT / "source" / kind).glob("*.png"))
        counts[kind] = len(paths)
        if len(paths) != expected:
            raise ValueError(f"Expected {expected} {kind} PNGs; found {len(paths)}")
        new_assets.extend(index_new(path, kind) for path in paths)
    v1_index = read_json(required(V1 / "source-index.json"))
    v1_heads = [record for record in v1_index["assets"] if record["kind"] == "heads"]
    if len(v1_heads) != 36:
        raise ValueError(f"Expected 36 v1 heads; found {len(v1_heads)}")
    heads = [reused_head(record) for record in v1_heads]
    assets = new_assets + heads
    if len({record["id"] for record in assets}) != 58:
        raise ValueError("Asset IDs must be unique: expected 58")
    counts.update({"newGenerated": 22, "reusedHeads": 36, "total": 58})
    verified = sum(record["originalCopyExact"] is True for record in assets)
    unavailable = [record["id"] for record in assets if record["originalCopyExact"] is None]
    default_ids = [record["id"] for record in new_assets if record["kind"] in ("bodies", "wardrobe")]
    index = {
        "schemaVersion": 1,
        "libraryId": "everfolk-ordinary-portraits-v2",
        "generator": "built-in image_gen",
        "indexer": "scripts/index-sources.py",
        "counts": counts,
        "sourcePolicy": "Immutable originals; project pointers are relative to this library and remain inside artwork/portraits. Absolute toolOriginalPath fields preserve external tool provenance only. Prompt text is local and ignored. Reused v1 heads remain in their original location.",
        "defaultSourceAssetIds": default_ids,
        "completeBodyReferenceIds": [record["id"] for record in new_assets if record["kind"] == "body-references"],
        "reusedHeadSourceIndex": "../ordinary-v1/source-index.json",
        "originalCopiesVerified": verified,
        "originalToolFilesUnavailable": unavailable,
        "assets": assets,
    }
    audit = {
        "schemaVersion": 1,
        "sourceIndex": "source-index.json",
        "status": "passed" if not unavailable else "passed-with-unavailable-tool-files",
        "counts": counts,
        "defaultSourceAssetCount": len(default_ids),
        "expectedDefaultSourceAssets": {"bodies": 2, "wardrobe": 18},
        "promptsLocated": len(assets),
        "sourceProvenanceLocated": len(assets),
        "originalCopiesVerified": verified,
        "originalToolFilesUnavailable": unavailable,
        "copyMismatches": [],
        "reusedHeadsMatchV1Index": len(heads),
        "sourceImagesModified": False,
        "checks": ["22 new PNGs and 36 reused heads", "new sources retain real RGBA alpha", "exact prompt path and prompt hash", "per-asset provenance", "available original-tool PNG hash equality", "reused head and prompt hashes match v1 index", "portable project paths remain inside portraits"],
    }
    destination = ROOT / "source-index.json"
    destination.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    audit["sourceIndexSha256"] = sha(destination)
    (ROOT / "qa").mkdir(exist_ok=True)
    (ROOT / "qa" / "source-index-audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sourceIndex": str(destination), "counts": counts, "originalCopiesVerified": verified, "originalToolFilesUnavailable": len(unavailable)}))


if __name__ == "__main__":
    main()
