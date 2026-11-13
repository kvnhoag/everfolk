#!/usr/bin/env python3
"""Make V3 the local authoring library only after complete independent readback."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT.parent / "libraries.json"
library_id = "everfolk-ordinary-portraits-v3"
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
audit = json.loads((ROOT / "qa/library-audit.json").read_text(encoding="utf-8"))
visual = json.loads((ROOT / "qa/anatomy-visual-review.json").read_text(encoding="utf-8"))
if visual.get("status") != "reviewed" or visual.get("finalPortraitsReviewed") != 240:
    raise ValueError("Complete and document visual inspection before registration")
if visual.get("manifestSha256") != hashlib.sha256((ROOT / "manifest.json").read_bytes()).hexdigest():
    raise ValueError("Visual review does not match the current complete manifest")
if audit.get("status") != "passed" or audit.get("portraits") != 240 or len(manifest["portraits"]) != 240:
    raise ValueError("Register only a complete, independently verified 240-portrait library")
if manifest.get("userReviewStatus") != "awaiting-user-review" or manifest.get("anatomicalApproval") is not False:
    raise ValueError("Do not imply user approval of the rebuilt set")
registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
registry["currentAuthoringLibraryId"] = library_id
registry["lastCompleteLibraryId"] = library_id
registry["activeProofLibraryId"] = None
registry["runtimeIntegrated"] = False
registry["statusNote"] = "V3 complete-model rebuild: 240 exported portraits, independent readback and documented visual review. Awaiting user review. V2 remains rejected for neck anatomy. Runtime unchanged."
entry = {"id": library_id, "root": "ordinary-v3", "status": "rebuilt-awaiting-user-review",
         "readme": "ordinary-v3/README.md", "agentMap": "ordinary-v3/AGENT_MAP.md",
         "manifest": "ordinary-v3/manifest.json", "sourceIndex": "ordinary-v3/source-index.json",
         "gallery": "ordinary-v3/review/index.html", "verification": "ordinary-v3/qa/library-audit.json",
         "visualReview": "ordinary-v3/qa/anatomy-visual-review.json", "portraits": 240,
         "completeAnatomicalModels": 12, "userReviewStatus": "awaiting-user-review",
         "anatomicalApproval": False}
others = [x for x in registry["libraries"] if x["id"] != library_id]
for old in others:
    if old["id"] == "everfolk-ordinary-portraits-v1":
        old["replacement"] = library_id
    elif old["id"] == "everfolk-ordinary-portraits-v2":
        old["replacement"] = library_id
    elif old["id"] == "everfolk-ordinary-v3-face-only-proof":
        old["status"] = "approved-method-proof-retained"
        old["fullLibraryRebuilt"] = True
        old["fullLibrary"] = library_id
registry["libraries"] = [entry] + others
REGISTRY.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
(ROOT.parent / "README.md").write_text('''# Everfolk portrait libraries

The current authoring library is [ordinary-v3](ordinary-v3/README.md): **240 rebuilt player, ordinary NPC and relationship portraits** from 12 complete anatomical age models. The set has independent readback and documented visual review and is awaiting the user's review. Historical figures, titles and TCG art remain in the separate card workflow.

Start with [ordinary-v3/AGENT_MAP.md](ordinary-v3/AGENT_MAP.md). The [version registry](libraries.json) identifies the current library programmatically. Use the [manifest](ordinary-v3/manifest.json) for actual final paths and dependencies.

| Authority | Location |
| --- | --- |
| Scope and portrait report | [ordinary-v3/README.md](ordinary-v3/README.md) |
| Complete-model and style contract | [ordinary-v3/contract.json](ordinary-v3/contract.json) |
| Native face regions, skin masks and garment landmarks | [ordinary-v3/model-annotations.json](ordinary-v3/model-annotations.json) |
| Original PNGs, exact local prompts and provenance | [ordinary-v3/source-index.json](ordinary-v3/source-index.json) |
| Selected final portraits | [ordinary-v3/portraits/mixed-3px-body-2px-face](ordinary-v3/portraits/mixed-3px-body-2px-face/) |
| Filterable gallery | [ordinary-v3/review/index.html](ordinary-v3/review/index.html) |
| Source, anatomy-preservation and pixel readback | [ordinary-v3/qa/library-audit.json](ordinary-v3/qa/library-audit.json) |
| Visual review scope and limits | [ordinary-v3/qa/anatomy-visual-review.json](ordinary-v3/qa/anatomy-visual-review.json) |
| Shared jobs, origins and encounter mapping | [ordinary-v1/mappings.json](ordinary-v1/mappings.json) |
| Scholar, warrior, aristocrat and royalty wardrobe aliases | [ordinary-v3/role-wardrobe-bindings.json](ordinary-v3/role-wardrobe-bindings.json) |
| Current world and privileged-route compatibility | [ordinary-v3/qa/content-compatibility-current.json](ordinary-v3/qa/content-compatibility-current.json) |

V3 keeps the original whole model's jaw, neck, shoulders and body together. Generated variants contribute internal face features; matching skin colours and fitted clothing follow, then the agreed PixelOE 3px body / 2px face finish. The native source silhouette is preserved. Pixel and hash checks complement visual inspection; they do not establish user acceptance.

The [v3 two-model proof](ordinary-v3-neck-proof/README.md) records the approved method. [V2](ordinary-v2/README.md) remains rejected for neck anatomy. V1 final exports are superseded. Keep both older directories because V3 uses their raw face/colour references, clothing, mappings, PixelOE engine and regional selection helper. Their anatomical assembly is excluded.

This is an artwork library. Runtime selectors, game saves and live assets were not changed by this rebuild.
''', encoding="utf-8")
print(json.dumps({"currentAuthoringLibraryId": library_id, "status": entry["status"], "portraits": 240}))
