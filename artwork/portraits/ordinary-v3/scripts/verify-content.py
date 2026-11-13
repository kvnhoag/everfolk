#!/usr/bin/env python3
"""Validate the retained authored map against the current immutable world pack."""
from pathlib import Path
import hashlib
import json
from content_signature import relevant_signature

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]


def read(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def need(value, message):
    if not value:
        raise ValueError(message)


world_path = REPO / "worlds/alexandria-sample.json"
map_path = ROOT.parent / "ordinary-v1/mappings.json"
w, m = read(world_path), read(map_path)
jobs = {x["id"]: x for x in w["character"]["jobs"]}
mapped_jobs = {x["id"]: x for x in m["jobs"]}
need(jobs.keys() == mapped_jobs.keys(), "Current job IDs differ from the authored wardrobe map")
for key in jobs:
    for field in ("title", "minAge"):
        need(jobs[key].get(field) == mapped_jobs[key].get(field), "Job semantic drift: " + key + "/" + field)
origins = {x["id"]: x for x in w["origins"]}
mapped_origins = {x["id"]: x for x in m["origins"]}
need(origins.keys() == mapped_origins.keys(), "Origin IDs changed")
title_changes = [{"id": k, "authoredTitle": mapped_origins[k]["title"], "currentTitle": origins[k]["title"]} for k in origins if origins[k]["title"] != mapped_origins[k]["title"]]
reviewed_rename = {"id": "estate-household", "authoredTitle": "A landowning estate household", "currentTitle": "An aristocratic estate household"}
need(all(change == reviewed_rename for change in title_changes), "Unreviewed origin title change")
partners = {x["id"]: x for x in w["character"]["partners"]}
mapped_partners = {x["id"]: x for x in m["encounters"]}
need(partners.keys() == mapped_partners.keys(), "Encounter IDs changed")
need(all(partners[k]["occupation"] == mapped_partners[k]["title"] for k in partners), "Encounter occupations changed")
routes = []
for field, wardrobe, module in (("royalty", "royalty", "src/royalty.ts"), ("aristocracy", "aristocrat", "src/aristocracy.ts")):
    route = w.get(field)
    need(route is not None and route["originId"] in origins, "Missing explicit privileged route: " + field)
    need(route["minAge"] == 16, "Privileged route age changed; re-evaluate wardrobe age coverage")
    routes.append({"worldField": field, "wardrobeId": wardrobe, "originId": route["originId"], "routeMinAge": route["minAge"],
                   "availablePortraitStages": ["youth", "adult", "middle", "elder"],
                   "selection": f"Use the life's own world revision. Require world.{field} to be enabled and life.originId == world.{field}.originId; apply the role outfit from age16. Earlier ages retain their age-appropriate complete-model clothes.",
                   "authorityModule": module, "authorityModuleSha256": sha(REPO / module)})
result = {"schemaVersion": 1, "status": "compatible", "scope": "Artwork mapping verification; no runtime selector or simulation state changed.",
          "authoredMap": "../ordinary-v1/mappings.json", "authoredMapSha256": sha(map_path), "authoredMapWorldVersion": m["worldVersion"],
          "validatedWorld": "worlds/alexandria-sample.json", "validatedWorldVersion": w["version"], "validatedWorldSha256": sha(world_path), "portraitRelevantContentSha256": relevant_signature(w),
          "jobs": len(jobs), "origins": len(origins), "encounters": len(partners),
          "jobIdsTitlesMinimumAgesMatch": True, "originIdCoverageMatch": True, "reviewedOriginTitleOverrides": title_changes, "encounterIdsOccupationsMatch": True,
          "snapshotVersionDiffers": m["worldVersion"] != w["version"], "privilegedRoutes": routes,
          "notes": ["The retained0.43 authored map is immutable. Current content adds explicit royal/aristocratic route gates without changing its33jobs,16origin IDs or16encounter occupations. The reviewed estate-origin display-title override is recorded above.", "Royal/aristocrat youth outfits cover the routes' ages16–17; adult/middle/elder outfits continue those roles.", "World opt-in and the life's own world revision matter; do not assign a royal/aristocrat uniform from wealth, a name or an origin alone in older world revisions."]}
(ROOT / "qa/content-compatibility-current.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "authoredMapWorldVersion": m["worldVersion"], "validatedWorldVersion": w["version"], "jobs": len(jobs), "roleMinAge": 16}))
