"""Fingerprint only world fields that affect portrait coverage and selection."""
import hashlib
import json


def relevant_signature(world):
    data = {
        "jobs": sorted((x["id"], x.get("title"), x.get("minAge")) for x in world["character"]["jobs"]),
        "origins": sorted((x["id"], x["title"]) for x in world["origins"]),
        "encounters": sorted((x["id"], x["occupation"]) for x in world["character"]["partners"]),
        "privilegedRoutes": {key: {"originId": world[key]["originId"], "minAge": world[key]["minAge"]} if key in world else None for key in ("royalty", "aristocracy")},
    }
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
