#!/usr/bin/env python3
"""Read-only cross-check of the library, source provenance and live content map."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def asset_path(relative):
    path = (ROOT / relative).resolve(strict=True)
    if not path.is_relative_to(ROOT):
        raise ValueError("Asset reference escapes library: " + relative)
    return path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    manifest = read(ROOT / "manifest.json")
    sources = read(ROOT / "source-index.json")
    mappings = read(ROOT / "mappings.json")
    world = read(REPO / "worlds/alexandria-sample.json")
    require(manifest["runtimeIntegrated"] is False, "Review runtime status before applying this authoring audit")
    require(world["version"] == mappings["worldVersion"], "World version drifted; review content mappings")
    jobs = {job["id"]: job for job in world["character"]["jobs"]}
    require(set(jobs) == {job["id"] for job in mappings["jobs"]}, "Job map does not exactly cover live jobs")
    for job in mappings["jobs"]:
        require((job["title"], job["minAge"]) == (jobs[job["id"]]["title"], jobs[job["id"]]["minAge"]), "Job title/age drift: " + job["id"])
    require({o["id"] for o in world["origins"]} == {o["id"] for o in mappings["origins"]}, "Origin map is incomplete")
    require({p["id"] for p in world["character"]["partners"]} == {p["id"] for p in mappings["encounters"]}, "Encounter map is incomplete")
    for item in sources["assets"]:
        require(sha(asset_path(item["path"])) == item["sha256"], "Generated source changed: " + item["id"])
        for provenance in item["provenance"]:
            asset_path(provenance)
        require(item.get("originalCopyExact") is True, "Original-copy provenance is incomplete: " + item["id"])
    require(sources["counts"] == {"heads": 36, "wardrobe": 11}, "Wrong generated source counts")
    seen = set()
    for portrait in manifest["portraits"]:
        require(portrait["id"] not in seen, "Duplicate portrait ID")
        seen.add(portrait["id"])
        for key, digest in (("path", "sha256"), ("logical", "logicalSha256"), ("assembled", "assembledSha256")):
            require(sha(asset_path(portrait[key])) == portrait[digest], "Portrait hash differs: " + portrait["id"])
        with Image.open(asset_path(portrait["path"])) as im:
            require(im.mode == "RGB" and im.size == (384, 480), "Wrong portrait mode/size: " + portrait["id"])
        qa = read(asset_path(portrait["qa"]))
        require(all(qa[check] for check in ("deterministic", "exactIntegerBlocks", "pngReadbackExact", "opaqueSource", "sourceUnchanged")), "Failed pixel QA: " + portrait["id"])
    require(len(seen) == 192, "Wrong final portrait count")
    for component in manifest["heads"] + manifest["garments"]:
        path = asset_path(component["path"])
        require(sha(path) == component["sha256"], "Component hash differs")
        with Image.open(path) as im:
            require(im.mode == "RGBA" and im.size == (800, 1000) and im.getchannel("A").getextrema()[0] == 0, "Invalid alpha component")
    for bridge in manifest["legacySlotBridges"]:
        require(bridge["portraitId"] in seen, "Dangling legacy portrait slot")
        require((REPO / "public" / bridge["legacyPath"].lstrip("/")).is_file(), "Existing compatibility SVG is missing")
    require(len(manifest["legacySlotBridges"]) == 288, "Wrong bridge count")
    defaults = manifest["defaultWardrobes"]
    for job in mappings["jobs"]:
        age = job["minAge"]
        stage = "infant" if age < 3 else "child" if age < 13 else "youth" if age < 18 else "adult" if age < 40 else "middle" if age < 60 else "elder"
        wardrobe = defaults[stage] if job["wardrobeId"] == "everyday" else job["wardrobeId"]
        for identity in manifest["identities"]:
            require(f'ef-p-{identity["id"]}-{stage}-{wardrobe}-v1' in seen, "No portrait at job eligibility: " + job["id"])
    for entry in ("README.md", "AGENT_MAP.md", "source-index.json", "review/index.html", "review/lifetimes-6x6.png", "review/adult-wardrobe-6x8.png", "review/actual-size-48x60.png", "references/credits.json"):
        asset_path(entry)
    result = {"status": "passed", "worldVersion": world["version"], "generatedHeads": 36, "generatedGarments": 11, "verifiedSourceOriginals": 47, "portraits": len(seen), "headComponents": len(manifest["heads"]), "garmentPlacements": len(manifest["garments"]), "legacyBridges": 288, "jobs": len(jobs), "origins": len(mappings["origins"]), "encounters": len(mappings["encounters"]), "jobEligibilityCoverage": True, "hashesMatch": True, "pixelQAPassed": True, "runtimeIntegrated": False}
    (ROOT / "qa/library-audit.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
