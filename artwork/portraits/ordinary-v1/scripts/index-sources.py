#!/usr/bin/env python3
"""Index immutable generated originals, local prompts and their provenance."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    assets = []
    for folder in ("heads", "wardrobe"):
        for path in sorted((ROOT / "source" / folder).glob("*.png")):
            asset_id = path.stem
            prompt = ROOT / "source/prompts" / (asset_id + "-prompt.txt")
            if not prompt.is_file():
                raise FileNotFoundError(prompt)
            provenance = sorted((ROOT / "source").rglob(asset_id + "*.json"))
            if not provenance:
                raise ValueError("Missing source provenance: " + asset_id)
            original = None
            for metadata_path in provenance:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
                for key in ("generatedOriginal", "originalGeneratedPath", "generatedPath", "sourcePath", "originalPath", "toolFile"):
                    value = metadata.get(key)
                    if isinstance(value, str) and "generated_images" in value:
                        original = Path(value)
                        break
                if original:
                    break
            with Image.open(path) as im:
                if im.mode != "RGBA":
                    raise ValueError("Not an alpha component: " + str(path))
                alpha = im.getchannel("A")
                if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] < 128:
                    raise ValueError("No meaningful alpha cutout: " + str(path))
                record = {"id": asset_id, "kind": folder, "path": path.relative_to(ROOT).as_posix(), "sha256": sha(path), "size": list(im.size), "mode": im.mode, "alphaExtrema": list(alpha.getextrema()), "visibleBoundsAlpha128": list(alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()), "prompt": prompt.relative_to(ROOT).as_posix(), "promptSha256": sha(prompt), "promptLocalOnly": True, "provenance": [p.relative_to(ROOT).as_posix() for p in provenance]}
            if original:
                record["toolOriginalPath"] = str(original)
                record["originalCopyExact"] = original.is_file() and sha(original) == record["sha256"]
                if not record["originalCopyExact"]:
                    raise ValueError("Generated original copy differs: " + asset_id)
            assets.append(record)
    counts = {kind: sum(asset["kind"] == kind for asset in assets) for kind in ("heads", "wardrobe")}
    if counts != {"heads": 36, "wardrobe": 11}:
        raise ValueError("Unexpected source counts: " + str(counts))
    index = {"schemaVersion": 1, "libraryId": "everfolk-ordinary-portraits-v1", "generator": "built-in image_gen", "counts": counts, "sourcePolicy": "Original PNGs are immutable. Cropping and registration occur in derived components; prompt text remains local and ignored.", "assets": assets}
    destination = ROOT / "source-index.json"
    destination.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sourceIndex": str(destination), "counts": counts, "provenanceLocated": len(assets), "originalCopiesVerified": sum(asset.get("originalCopyExact", False) for asset in assets)}))


if __name__ == "__main__":
    main()
