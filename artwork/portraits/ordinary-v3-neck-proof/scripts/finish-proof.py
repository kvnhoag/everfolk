from pathlib import Path
import importlib.util
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
helper = ROOT.parent / "ordinary-v2/scripts/regional-finish.py"
spec = importlib.util.spec_from_file_location("regional_finish", helper)
regional = importlib.util.module_from_spec(spec)
spec.loader.exec_module(regional)
panel = Image.new("RGB", (784, 516), "#e4d8bc")
draw = ImageDraw.Draw(panel)
for index, sex in enumerate(("male", "female")):
    coarse = np.asarray(Image.open(ROOT / f"review/{sex}-coarse.png").convert("RGB"))
    fine = np.asarray(Image.open(ROOT / f"review/{sex}-detail.png").convert("RGB"))
    eye, chin = ([400, 175], [400, 347]) if sex == "male" else ([400, 200], [400, 365])
    mixed, mask, config, qa = regional.compose_registered(coarse, fine, eye, chin)
    output = ROOT / f"review/{sex}-face-only-pixel.png"
    Image.fromarray(mixed).save(output)
    Image.fromarray(mask.astype(np.uint8) * 255).save(ROOT / f"qa/{sex}-fine-region.png")
    (ROOT / f"qa/{sex}-mixed.json").write_text(json.dumps({"selection": qa, "config": config}, indent=2) + "\n", encoding="utf-8")
    panel.paste(Image.fromarray(mixed), (index * 392 + 4, 4))
    draw.text((index * 392 + 8, 494), sex + ": original model / face features only", fill="#263b36")
panel.save(ROOT / "review/face-only-proof.png")
print(json.dumps({"pixelProofs": 2, "profile": "agreed coarse3 / face2, registered6px cells"}))
