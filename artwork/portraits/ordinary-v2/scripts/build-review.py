#!/usr/bin/env python3
"""Build an offline, searchable review gallery from the completed manifest."""
from pathlib import Path
import hashlib
import html
import json

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    references = [
        {"id": "met-child-shirt", "title": "Child's Shirt · 25.3.215", "date": "650–400 BCE", "path": "references/met-child-shirt-25.3.215-original.jpg", "url": "https://www.metmuseum.org/art/collection/search/548288", "imageUrl": "https://collectionapi.metmuseum.org/api/collection/v1/iiif/548288/1408188/main-image", "credit": "The Metropolitan Museum of Art, Rogers Fund, 1925. Public Domain.", "use": "Egyptian linen and simple shirt construction; earlier adjacent-period comparator. Not an exact pattern for our garment."},
        {"id": "met-wrapped-man", "title": "Standing man · 30.8.98", "date": "600–200 BCE", "path": "references/met-wrapped-man-30.8.98-original.jpg", "url": "https://www.metmuseum.org/art/collection/search/587739", "imageUrl": "https://collectionapi.metmuseum.org/api/collection/v1/iiif/587739/1212609/main-image", "credit": "The Metropolitan Museum of Art, Theodore M. Davis Collection, Bequest of Theodore M. Davis, 1915. Public Domain.", "use": "Wrapped/fringed garment context. A metal figure is not evidence for the generated cloth's material or color; possible priest identification is uncertain."},
        {"id": "met-family-stele", "title": "Family grave stele · 11.100.2", "date": "About 360 BCE · Greek, Attic", "path": "references/met-family-stele-original.jpg", "url": "https://www.metmuseum.org/art/collection/search/248483", "imageUrl": "https://collectionapi.metmuseum.org/api/collection/v1/iiif/248483/538344/main-image", "credit": "The Metropolitan Museum of Art, Rogers Fund, 1911. Public Domain.", "use": "Comparative draped-cloth forms. Marble surface is not a textile/color claim or a likeness reference for the fictional cast."},
    ]
    for ref in references:
        path = ROOT / ref["path"]
        if not path.is_file():
            raise FileNotFoundError(path)
        ref["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        ref["unmodifiedDownload"] = True
    (ROOT / "references/credits.json").write_text(json.dumps(references, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    portraits = manifest["portraits"]
    # Small delivery overview uses the exact generated pixel files, resized
    # with nearest-neighbour solely for this labelled review sheet.
    from PIL import Image, ImageDraw, ImageFont
    overview = Image.new("RGB", (960, 840), "#e4d8bc")
    draw = ImageDraw.Draw(overview)
    font_path = Path("C:/Windows/Fonts/segoeui.ttf")
    font = ImageFont.truetype(str(font_path), 15) if font_path.is_file() else ImageFont.load_default()
    for index, identity in enumerate(manifest["identities"]):
        portrait = next(p for p in portraits if p["identityId"] == identity["id"] and p["stage"] == "adult" and p["wardrobeId"] == "everyday")
        x, y = (index % 3) * 320, (index // 3) * 420
        with Image.open(ROOT / portrait["path"]) as im:
            overview.paste(im.resize((312, 390), Image.Resampling.NEAREST), (x + 4, y + 4))
        draw.text((x + 8, y + 398), identity["id"] + " / shared " + identity["sex"] + " body", font=font, fill="#263b36")
    overview.save(ROOT / "review/adult-identities.png")
    cards = []
    for portrait in portraits:
        path = ROOT / portrait["path"]
        if not path.is_file():
            raise FileNotFoundError(path)
        attrs = " ".join(f'data-{key}="{html.escape(portrait[field])}"' for key, field in (("identity", "identityId"), ("stage", "stage"), ("wardrobe", "wardrobeId")))
        cards.append(f'<figure class="portrait" {attrs}><a href="../{html.escape(portrait["path"])}"><img loading="lazy" src="../{html.escape(portrait["path"])}" width="192" height="240" alt="{html.escape(portrait["id"])}"></a><figcaption><strong>{portrait["identityId"]} · {portrait["stage"]}</strong><span>{portrait["wardrobeId"]}</span><code>{portrait["id"]}</code></figcaption></figure>')
    reference_cards = []
    for ref in references:
        reference_cards.append(f'<figure class="reference"><a href="../{ref["path"]}"><img src="../{ref["path"]}" alt="Actual unmodified museum photograph: {html.escape(ref["title"])}"></a><figcaption><a href="{ref["url"]}"><strong>{html.escape(ref["title"])}</strong></a><span>{html.escape(ref["date"])}</span><p>{html.escape(ref["use"])}</p><small>{html.escape(ref["credit"])}</small></figcaption></figure>')
    examples = []
    for identity, wardrobe in (("m01", "everyday"), ("f01", "work"), ("f02", "scholarly")):
        p = next(p for p in portraits if p["identityId"] == identity and p["stage"] == "adult" and p["wardrobeId"] == wardrobe)
        examples.append(f'<figure class="portrait"><img src="../{p["path"]}" width="192" height="240" alt="Generated interpretation {p["id"]}"><figcaption><strong>Generated interpretation</strong><span>{identity} / {wardrobe}</span><small>Fictional face, authored colors and clothing group. Reference forms are interpreted, not reproduced.</small></figcaption></figure>')
    def options(values):
        return '<option value="all">All</option>' + ''.join(f'<option value="{v}">{v}</option>' for v in values)
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Everfolk · ordinary portraits v2</title>
<style>
:root{font-family:Segoe UI,Arial,sans-serif;color:#263b36;background:#f2eddf}*{box-sizing:border-box}body{max-width:1500px;margin:0 auto;padding:40px}h1{font-family:Georgia,serif;font-size:42px;font-weight:500;margin:8px 0 16px}h2{font-family:Georgia,serif;font-weight:500;font-size:28px;margin:40px 0 18px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#6a755f}p{max-width:900px;line-height:1.65}a{color:#426b57}.summary{display:flex;flex-wrap:wrap;gap:20px;padding:18px 0;border-top:1px solid #d1c8b3;border-bottom:1px solid #d1c8b3}.summary span{font-size:14px}.summary strong{font-size:22px;margin-right:7px}.controls{position:sticky;top:0;background:#f2eddfed;backdrop-filter:blur(8px);padding:15px 0;display:flex;gap:15px;flex-wrap:wrap;align-items:end;z-index:2}label{display:grid;gap:5px;font-size:12px}select{padding:9px;min-width:140px;border:1px solid #b9baa5;background:#fffdf5;color:#263b36}#count{padding:10px;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(192px,1fr));gap:22px}.portrait,.reference{margin:0}.portrait>a,.portrait>img{display:block}.portrait img{width:100%;height:auto;aspect-ratio:4/5;image-rendering:pixelated;object-fit:contain;background:#263b36}.portrait figcaption{padding:10px 0 18px;display:grid;gap:5px;font-size:13px}code{font-size:10px;overflow-wrap:anywhere;color:#657162}.refgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.reference img{width:100%;height:260px;object-fit:contain;background:white}.reference figcaption{font-size:12px;line-height:1.55;padding:10px 0}.reference span,.reference small{display:block}.reference p{margin:8px 0}.comparison{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:24px}.comparison .portrait{max-width:220px;justify-self:center}.sheets{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}.sheets a{padding:10px 14px;border:1px solid #c5c6af;text-decoration:none}.note{font-size:13px;color:#596855}figure[hidden]{display:none!important}@media(max-width:750px){body{padding:20px}.refgrid,.comparison{grid-template-columns:1fr}h1{font-size:34px}.controls{position:static}}
</style><body><div class="eyebrow">Everfolk · production asset library · 13 November 2026</div><h1>Complete bodies, consistent fit.</h1>
<p>Player, NPC and relationship portraits in the agreed painterly anime / chiaroscuro language, with shared M/F bodies, matched skin shades and the agreed coarse/fine PixelOE finish. These files are staged in the artwork library; the live game has not been switched to them.</p>
<div class="summary"><span><strong>2</strong>shared body types</span><span><strong>6</strong>skin identities</span><span><strong>36</strong>age-specific heads</span><span><strong>18</strong>fitted garments</span><span><strong>192</strong>portrait combinations</span><span><strong>33</strong>job mappings</span></div>
<div class="sheets"><a href="../AGENT_MAP.md">Agent map</a><a href="../manifest.json">Manifest + hashes</a><a href="../../ordinary-v1/mappings.json">Jobs + origins</a><a href="lifetimes-6x6.png">Lifetime sheet</a><a href="adult-wardrobe-6x8.png">Clothing sheet</a><a href="actual-size-48x60.png">Actual-size preview</a></div>
<h2>Find a portrait</h2><div class="controls"><label>Identity<select id="identity">IDENTITY_OPTIONS</select></label><label>Age stage<select id="stage">STAGE_OPTIONS</select></label><label>Clothing<select id="wardrobe">WARDROBE_OPTIONS</select></label><span id="count"></span></div><div class="grid" id="portraits">PORTRAIT_CARDS</div>
<h2>Actual references beside interpretations</h2><p class="note">Top row: genuine museum photographs, kept unchanged. Bottom row: generated interpretations. Colors, facial designs and occupational grouping are creative choices; these are not exact reconstructions or attested professional uniforms.</p><div class="refgrid">REFERENCE_CARDS</div><div class="comparison">EXAMPLE_CARDS</div>
<p class="note">The shared M/F physical bodies, skin-only colour variants, fitted garment layers, preserved face identities, exact local prompts, source provenance and mixed-grid pixel QA are indexed from the manifest and agent map. Open an image to inspect its full-resolution file.</p>
<script>const controls=["identity","stage","wardrobe"].map(id=>document.getElementById(id));const cards=[...document.querySelectorAll("#portraits .portrait")];function filter(){let count=0;for(const card of cards){const show=controls.every(control=>control.value==="all"||card.dataset[control.id]===control.value);card.hidden=!show;if(show)count++}document.getElementById("count").textContent=count+" of "+cards.length+" portraits"}controls[1].value="adult";controls[2].value="everyday";for(const control of controls)control.addEventListener("change",filter);filter();</script></body></html>'''
    replacements = {
        "IDENTITY_OPTIONS": options([i["id"] for i in manifest["identities"]]),
        "STAGE_OPTIONS": options(manifest.get("stages", ["infant", "child", "youth", "adult", "middle", "elder"])),
        "WARDROBE_OPTIONS": options(list(dict.fromkeys(p["wardrobeId"] for p in portraits))),
        "PORTRAIT_CARDS": ''.join(cards), "REFERENCE_CARDS": ''.join(reference_cards), "EXAMPLE_CARDS": ''.join(examples),
    }
    for key, value in replacements.items():
        page = page.replace(key, value)
    destination = ROOT / "review/index.html"
    destination.write_text(page, encoding="utf-8")
    print(json.dumps({"gallery": str(destination), "portraitCards": len(portraits), "unmodifiedReferences": len(references)}))


if __name__ == "__main__":
    main()
