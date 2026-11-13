"""Reproduce the original 38 QA sheets for the reviewed 228-output scope.

This never edits sources, masks, annotations, assemblies or portrait outputs.
Rendering a sheet is evidence preparation, not a claim of visual approval.
The later twelve youth-role additions are reviewed on separate appended sheets.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
snapshot_path = ROOT / "qa/review-inputs/manifest-228-reviewed.json"
manifest_path = snapshot_path if snapshot_path.exists() else ROOT / "manifest.json"
manifest_bytes = manifest_path.read_bytes()
manifest = json.loads(manifest_bytes)
portraits = manifest["portraits"]
if len(portraits) != 228:
    raise ValueError("Review only the completed 228-output manifest")
if len({p["id"] for p in portraits}) != 228:
    raise ValueError("Duplicate portrait IDs in the completed manifest")
output = ROOT / "qa/independent-review-sheets"
output.mkdir(exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 16)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 13)
pages = []
for stage in ("infant", "child", "youth", "adult", "middle", "elder"):
    cards = [p for p in portraits if p["stage"] == stage]
    cards.sort(key=lambda p: (p["wardrobeId"], p["identityId"]))
    for start in range(0, len(cards), 6):
        group = cards[start:start+6]
        sheet = Image.new("RGB", (900, 840), (236, 232, 221))
        draw = ImageDraw.Draw(sheet)
        for index, item in enumerate(group):
            x, y = index % 3 * 300, index // 3 * 420
            portrait_path = ROOT / item["path"]
            if hashlib.sha256(portrait_path.read_bytes()).hexdigest() != item["sha256"]:
                raise ValueError(f'Portrait differs from manifest: {item["id"]}')
            with Image.open(portrait_path) as raw:
                image = raw.convert("RGB")
                image.thumbnail((288, 360), Image.Resampling.NEAREST)
            sheet.paste(image, (x + (300-image.width)//2, y+8))
            draw.text((x+8,y+372), f'{item["identityId"]} / {stage}', font=font, fill=(24,24,24))
            draw.text((x+8,y+395), item["wardrobeId"], font=small, fill=(24,24,24))
        name = f'{stage}-{start//6+1:02d}.png'
        path = output / name
        sheet.save(path)
        pages.append({"path":str(path.relative_to(ROOT)).replace("\\","/"),
                      "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                      "portraitIds":[p["id"] for p in group],
                      "portraitDisplayPixels":[288,360],"reviewed":False})
index = {"manifestSha256":hashlib.sha256(manifest_bytes).hexdigest(),
         "portraitCount":len(portraits),"sheets":pages,
         "note":"QA contact sheets prepared only; reviewer records actual inspection separately."}
(output / "index.json").write_text(json.dumps(index,indent=2)+"\n")
print(json.dumps({"portraits":len(portraits),"reviewSheets":len(pages),"folder":str(output)}))
