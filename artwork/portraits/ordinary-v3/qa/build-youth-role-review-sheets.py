"""Append QA sheets for twelve youth role outfits; preserve the old 228 sheets."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

old_path = ROOT / "qa/review-inputs/manifest-228-reviewed.json"
new_path = ROOT / "manifest.json"
old = json.loads(old_path.read_text())
new = json.loads(new_path.read_text())
assert len(old["portraits"]) == 228 and len(new["portraits"]) == 240
old_map = {p["id"]:p for p in old["portraits"]}
new_map = {p["id"]:p for p in new["portraits"]}
unchanged = []
for key, before in old_map.items():
    after = new_map[key]
    actual = digest(ROOT / after["path"])
    assert before["sha256"] == after["sha256"] == actual
    unchanged.append({"portraitId":key,"sha256":actual})
added = [p for p in new["portraits"] if p["id"] not in old_map]
assert len(added) == 12 and all(p["stage"] == "youth" and p["wardrobeId"] in ("aristocrat","royalty") for p in added)
folder = ROOT / "qa/independent-review-sheets"
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf",16)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf",13)
sheets = []
for wardrobe in ("aristocrat","royalty"):
    cards = sorted([p for p in added if p["wardrobeId"] == wardrobe],key=lambda p:p["identityId"])
    assert len(cards) == 6
    for kind, field in (("smooth","assembled"),("pixel","path")):
        sheet = Image.new("RGB",(900,840),(236,232,221))
        draw = ImageDraw.Draw(sheet)
        for n, item in enumerate(cards):
            path = ROOT / item[field]
            expected = item["sha256"] if field == "path" else item["assembledSha256"]
            assert digest(path) == expected
            with Image.open(path) as raw:
                image = raw.convert("RGB")
                image.thumbnail((288,360),Image.Resampling.NEAREST if kind == "pixel" else Image.Resampling.LANCZOS)
            x,y=n%3*300,n//3*420
            sheet.paste(image,(x+(300-image.width)//2,y+8))
            draw.text((x+8,y+372),f'{item["identityId"]} / youth',font=font,fill=(24,24,24))
            draw.text((x+8,y+395),f'{wardrobe} / {kind}',font=small,fill=(24,24,24))
        path = folder / f'youth-added-{wardrobe}-{kind}.png'
        sheet.save(path)
        sheets.append({"path":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":digest(path),"kind":kind,"portraitIds":[p["id"] for p in cards],"portraitDisplayPixels":[288,360],"reviewed":False})
evidence={"oldReviewedManifest":"qa/review-inputs/manifest-228-reviewed.json","oldManifestSha256":digest(old_path),"currentManifestSha256":digest(new_path),"old228FinalPngHashesUnchanged":True,"unchangedPortraits":unchanged,"newPortraits":[{"id":p["id"],"path":p["path"],"sha256":p["sha256"]} for p in added],"sheets":sheets,"note":"Sheet preparation and hash continuity only; actual visual review is recorded separately."}
destination = folder / "youth-roles-index.json"
destination.write_text(json.dumps(evidence,indent=2)+"\n")
print(json.dumps({"unchanged":228,"added":12,"smoothSheets":2,"pixelSheets":2,"index":str(destination)}))
