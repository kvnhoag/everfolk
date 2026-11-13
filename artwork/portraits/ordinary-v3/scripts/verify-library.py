#!/usr/bin/env python3
"""Independently read back all V3 sources, preserved models, maps and pixels."""
from pathlib import Path
import hashlib
import json
import re
from content_signature import relevant_signature
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]


def read(p):
    return json.loads(Path(p).read_text(encoding="utf-8-sig"))


def need(ok, message):
    if not ok:
        raise ValueError(message)


def path(value):
    p = (ROOT / value).resolve(strict=True)
    need(p.is_relative_to(ROOT.parent), "Path escapes portrait libraries: " + value)
    return p


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def pixels(value, mode="RGBA"):
    with Image.open(path(value)) as im:
        return np.asarray(im.convert(mode)).copy()


PAIRS = [("path", "sha256"), ("source", "sourceSha256"),
         ("assembled", "assembledSha256"), ("logical", "logicalSha256"),
         ("nativeOutfit", "nativeOutfitSha256"), ("featureMask", "featureMaskSha256"),
         ("skinMask", "skinMaskSha256"), ("generatedEdit", "generatedEditSha256"),
         ("skinReference", "skinReferenceSha256"), ("roleWardrobeBindingsSource", "roleWardrobeBindingsSha256"),
         ("contentCompatibilitySource", "contentCompatibilitySha256")]


def hashes(record):
    if isinstance(record, list):
        for item in record:
            hashes(item)
    elif isinstance(record, dict):
        for name, digest in PAIRS:
            if isinstance(record.get(name), str) and isinstance(record.get(digest), str):
                need(sha(path(record[name])) == record[digest], "SHA mismatch: " + record[name])
        for value in record.values():
            if isinstance(value, (dict, list)):
                hashes(value)


def main():
    m = read(ROOT / "manifest.json")
    annotations = read(ROOT / "model-annotations.json")
    source_index = read(ROOT / "source-index.json")
    world = read(REPO / "worlds/alexandria-sample.json")
    mappings = read(path("../ordinary-v1/mappings.json"))
    need(m["scope"] == "complete240-complete-anatomy-library", "Partial proof supplied as full library")
    need(m["completeModelCount"] == len(m["completeModels"]) == 12, "Need twelve complete paintings")
    need(len(m["featureModels"]) == len(m["skinPaletteModels"]) == 36, "Need 36 identity/age variants")
    need(m["dependencies"]["V2AnatomicalAssemblyUsed"] is False, "Rejected V2 assembly used")
    adult_groups = {"everyday", "work", "maritime", "commerce", "scholarly", "military", "elite", "performance", "aristocrat", "royalty"}
    need(set(m["adultWardrobeFamilies"]) == adult_groups, "Royalty/aristocrat/scholar/warrior clothing coverage differs")
    roles = read(path("role-wardrobe-bindings.json"))
    need({r["roleAlias"]: r["wardrobeId"] for r in roles["bindings"]} == {"scholar": "scholarly", "warrior": "military", "aristocrat": "aristocrat", "royalty": "royalty"}, "Explicit role wardrobe map differs")
    need(not m["runtimeIntegrated"], "Unexpected runtime mutation")
    hashes(m)
    hashes(source_index)
    need(len(source_index["assets"]) == 40 and len(source_index["dependencies"]) == 18, "Original source index coverage differs")
    for original in source_index["assets"] + source_index["dependencies"]:
        need(sha(path(original["prompt"])) == original["promptSha256"], "Exact prompt changed")
        need(len(original["provenance"]) == 1 and sha(path(original["provenance"][0])) == original["provenanceSha256"], "Generation sidecar changed")
        for reference in original["referencePaths"]:
            path(reference)
    models = {r["id"]: r for r in m["completeModels"]}
    ann = {(a["sex"], a["stage"]): a for a in annotations["models"]}
    need(len(ann) == 12, "Incomplete native annotations")
    features = {}
    palettes = {}
    for model in models.values():
        a = ann[(model["sex"], model["stage"])]
        need(model["source"] == a["source"] and model["skinMask"] == a["skinMaskPath"], "Build differs from published model annotations")
        original = pixels(model["source"])
        need(list(original.shape[1::-1]) == a["sourceDimensions"], "Native dimensions differ")
        need(sha(path(model["source"])) == a["sourceSha256"], "Reviewed source changed")
        need(original[:, :, 3].min() == 0 and original[:, :, 3].max() >= 128, "Missing genuine transparent model")
    for f in m["featureModels"]:
        original = pixels(models[f["modelId"]]["source"])
        result = pixels(f["path"])
        mask = pixels(f["featureMask"], "L") > 0
        y = f["protectedFromNativeRow"]
        need(np.array_equal(original[:, :, 3], result[:, :, 3]), "Face changed original alpha")
        need(np.array_equal(original[~mask], result[~mask]), "Face changed pixels outside internal feature mask")
        need(np.array_equal(original[y:], result[y:]), "Face changed original neck/body")
        need(not f["headOrNeckCutApplied"] and not f["anatomicalWarpApplied"], "Anatomy cut or warped")
        features[(f["identityId"], f["stage"])] = result
    for p in m["skinPaletteModels"]:
        key = (p["identityId"], p["stage"])
        before = features[key]
        after = pixels(p["path"])
        mask = pixels(p["skinMask"], "L") > 0
        need(np.array_equal(before[:, :, 3], after[:, :, 3]), "Palette changed anatomy alpha")
        need(np.array_equal(before[~mask], after[~mask]), "Palette changed pixels outside skin mask")
        palettes[key] = (after, mask)
    for a in m["assemblies"]:
        key = (a["identityId"], a["stage"])
        before, skin = palettes[key]
        outfit = pixels(a["nativeOutfit"])
        y = ann[(a["sex"], a["stage"])]["protectedNeckFromRow"]
        need(np.array_equal(before[:, :, 3], outfit[:, :, 3]), "Clothing changed model alpha")
        need(np.array_equal(before[skin], outfit[skin]), "Clothing changed original skin/neck")
        need(np.array_equal(before[:y], outfit[:y]), "Clothing changed head/jaw")
        expected = min(800 / before.shape[1], 1000 / before.shape[0])
        need(abs(a["wholeModelUniformScale"] - expected) < 1e-12, "Nonuniform complete-model framing")
    portraits = m["portraits"]
    ids = {p["id"] for p in portraits}
    need(len(portraits) == len(ids) == len(m["assemblies"]) == 240, "Portrait count or uniqueness differs")
    for stage in ("adult", "middle", "elder"):
        expected = {(i["id"], w) for i in m["identities"] for w in adult_groups}
        actual = {(p["identityId"], p["wardrobeId"]) for p in portraits if p["stage"] == stage}
        need(actual == expected, "Missing role/identity coverage: " + stage)
    youth_groups = {"youth", "work", "maritime", "scholarly", "performance", "aristocrat", "royalty"}
    need({(p["identityId"], p["wardrobeId"]) for p in portraits if p["stage"] == "youth"} == {(i["id"], w) for i in m["identities"] for w in youth_groups}, "Age16–17 role clothing coverage incomplete")
    for p in portraits:
        with Image.open(path(p["path"])) as im:
            need(im.mode == "RGB" and im.size == (384, 480), "Incorrect final canvas")
        need(p["logical"] is None and p["profile"] == "mixed-3px-body-2px-face", "Mixed grid mislabelled")
        q = read(path(p["qa"]))
        need(q["basePixelSize"] == 3 and q["detailPixelSize"] == 2 and q["commonCellSize"] == 6, "Pixel brush profile drift")
        need(q["uniformLogicalGrid"] is False, "Incorrect single-grid claim")
        for name, digest in [("coarsePath", "coarseSha256"), ("finePath", "fineSha256"),
                             ("maskPath", "maskSha256"), ("configPath", "configSha256"),
                             ("outputPath", "outputSha256")]:
            need(sha(path(q[name])) == q[digest], "Mixed pixel dependency hash differs")
        coarse, fine = pixels(q["coarsePath"], "RGB"), pixels(q["finePath"], "RGB")
        mask = pixels(q["maskPath"], "L") == 255
        out = pixels(p["path"], "RGB")
        need(np.array_equal(out[~mask], coarse[~mask]) and np.array_equal(out[mask], fine[mask]), "Selected pixels differ")
        cells = mask.reshape(80, 6, 64, 6)
        need(np.array_equal(cells.any(axis=(1, 3)), cells.all(axis=(1, 3))), "Regional selection splits 6px cells")
        for rgb, block in [(coarse, 3), (fine, 2)]:
            blocks = rgb.reshape(480 // block, block, 384 // block, block, 3)
            need(np.array_equal(blocks, np.broadcast_to(blocks[:, :1, :, :1, :], blocks.shape)), "Interpolated pixel blocks")
        for critical in q["criticalCoverage"]:
            x0, y0, x1, y1 = critical["box"]
            need(mask[y0:y1, x0:x1].all(), "Finer eye detail absent")
        for name in ["coarseQA", "fineQA"]:
            pq = read(path(q[name]))
            need(all(pq[k] for k in ["deterministic", "exactIntegerBlocks", "pngReadbackExact", "sourceUnchanged"]), "PixelOE render validation failed")
    compatibility = read(path("qa/content-compatibility-current.json"))
    need(compatibility["status"] == "compatible" and compatibility["portraitRelevantContentSha256"] == relevant_signature(world), "Portrait-relevant world content has not been semantically revalidated")
    need(compatibility["authoredMapSha256"] == sha(path("../ordinary-v1/mappings.json")), "Retained source map changed")
    need(compatibility["jobIdsTitlesMinimumAgesMatch"] and compatibility["originIdCoverageMatch"] and compatibility["encounterIdsOccupationsMatch"], "Semantic content mapping drift")
    for route in compatibility["privilegedRoutes"]:
        need(route["routeMinAge"] == 16 and route["wardrobeId"] in ("royalty", "aristocrat"), "Role age coverage changed")
        need(world[route["worldField"]]["originId"] == route["originId"] and world[route["worldField"]]["minAge"] == route["routeMinAge"], "Role selection data changed")
    need({x["id"] for x in world["character"]["jobs"]} == {x["id"] for x in m["jobWardrobeBindings"]}, "Job mapping drift")
    need({x["id"] for x in world["character"]["partners"]} == {x["id"] for x in m["encounterWardrobeBindings"]}, "Encounter mapping drift")
    need(len(m["originSelectors"]) == 16 and len(m["legacySlotBridges"]) == 288, "Origin/legacy coverage drift")
    need(len(m["jobWardrobeBindings"]) == 33 and len(m["encounterWardrobeBindings"]) == 16, "Job/encounter coverage drift")
    need(all(b["portraitId"] in ids for b in m["legacySlotBridges"]), "Dangling legacy portrait bridge")
    need(m["sourceIntegrity"]["allProtectedInputsUnchanged"], "Protected input changed")
    for name in ["README.md", "AGENT_MAP.md", "contract.json", "source-index.json", "model-annotations.json",
                 "review/index.html", "review/adult-identities.png", "review/lifetimes-6x6.png",
                 "review/adult-wardrobe-6x10.png", "review/role-clothing-comparison.png", "references/credits.json", "role-wardrobe-bindings.json", "content-compatibility.json", "qa/content-compatibility-current.json"]:
        path(name)
    page = (ROOT / "review/index.html").read_text(encoding="utf-8")
    for value in re.findall(r'(?:href|src)="([^"]+)"', page):
        if not value.startswith(("https:", "http:", "#")):
            need((ROOT / "review" / value).resolve().is_file(), "Dangling gallery link: " + value)
    result = {"status": "passed", "completeAnatomicalModels": 12, "identityAgeModels": 36,
              "portraits": 240, "worldVersionVerified": world["version"], "authoredMapVersion": mappings["worldVersion"], "adultClothingGroups": 10, "indexedSourcePNGs": 58, "retainedColourReferencePNGs": 36, "explicitRoyalAristocratScholarWarriorCoverage": True, "roleYouth16To17Covered": True, "internalFaceOnlyPreservationReadback": True,
              "neckBodyGeometryAndSourceAlphaPreserved": True, "skinOnlyRecolourReadback": True,
              "clothingPreservesOriginalSkin": True, "pixelProfile": "3px body / 2px face / whole 6px cells",
              "deterministicPixelPasses": True, "allSelectedPixelsExact": True,
              "jobs": 33, "origins": 16, "encounters": 16, "legacyBridges": 288,
              "allPathsAndHashes": True, "runtimeIntegrated": False,
              "visualReview": "See qa/anatomy-visual-review.json; numeric preservation alone does not certify anatomy or colour quality."}
    (ROOT / "qa/library-audit.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
