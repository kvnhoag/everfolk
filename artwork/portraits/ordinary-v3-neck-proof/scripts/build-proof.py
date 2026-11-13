"""Bounded face-only proof; the original model's neck is never cut."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT.parent / "ordinary-v2/source/body-references"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    records = []
    for sex, box, protected_y in (("male", (409, 175, 715, 445), 455), ("female", (410, 184, 714, 466), 480)):
        source = BASE / f"ef-r-{sex}-waist-v2.png"
        edit = ROOT / "source" / f"ef-face-only-{sex}-v3.png"
        original = Image.open(source).convert("RGBA")
        generated = Image.open(edit).convert("RGBA")
        if generated.size != original.size:
            raise ValueError("Generator changed canvas; register facial landmarks before using this proof")
        # Facial features only. All neck, jaw contour, hair and body alpha stay
        # in the original whole painting. No separate head or neck layer exists.
        mask = Image.new("L", original.size, 0)
        ImageDraw.Draw(mask).ellipse(box, fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(7))
        mask_array = np.asarray(mask).copy()
        mask_array[:145] = 0
        mask_array[protected_y:] = 0
        mask_array[mask_array < 3] = 0
        mask = Image.fromarray(mask_array, "L")
        result = Image.composite(generated, original, mask)
        # Alpha is geometry: even within the facial patch the original model's
        # silhouette is retained, so no new jaw/neck outline can be introduced.
        result.putalpha(original.getchannel("A"))
        output = ROOT / "source" / f"ef-model-{sex}-face-variant-v3.png"
        mask_path = ROOT / "qa" / f"face-feature-mask-{sex}.png"
        result.save(output)
        mask.save(mask_path)
        source_pixels, output_pixels = np.asarray(original), np.asarray(result)
        outside = mask_array == 0
        if not np.array_equal(source_pixels[outside], output_pixels[outside]):
            raise ValueError("Pixels outside the facial feature mask changed")
        if not np.array_equal(source_pixels[protected_y:], output_pixels[protected_y:]):
            raise ValueError("Protected jaw/neck/body pixels changed")
        # The review background is assembled behind the original alpha. This
        # does not trim, warp or otherwise modify any part of the model.
        flat = Image.new("RGBA", original.size, "#35483e")
        flat.alpha_composite(result)
        opaque = ROOT / "source" / f"ef-model-{sex}-opaque-v3.png"
        flat.convert("RGB").save(opaque)
        before_flat = Image.new("RGBA", original.size, "#35483e")
        before_flat.alpha_composite(original)
        panel = Image.new("RGB", (800, 535), "#e4d8bc")
        for index, image in enumerate((before_flat, flat)):
            panel.paste(image.convert("RGB").resize((400, 500), Image.Resampling.LANCZOS), (index * 400, 0))
        draw = ImageDraw.Draw(panel)
        draw.text((10, 510), "Original complete model", fill="#263b36")
        draw.text((410, 510), "Face features changed; original neck/body", fill="#263b36")
        panel.save(ROOT / "review" / f"{sex}-model-preservation.png")
        records.append({"sex": sex, "baseline": str(source), "baselineSha256": sha(source), "generatedEdit": str(edit), "generatedEditSha256": sha(edit), "faceFeatureMask": str(mask_path), "faceFeatureBoxNative": list(box), "protectedFromNativeRow": protected_y, "allPixelsOutsideFaceUnchanged": True, "neckShouldersTorsoRGBAExact": True, "originalAlphaExact": True, "neckCutOrWarpApplied": False, "result": str(output), "resultSha256": sha(output), "opaqueSource": str(opaque), "opaqueSourceSha256": sha(opaque), "status": "bounded proof; no 192-image rebuild claimed"})
    (ROOT / "qa/model-preservation.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"proofs": len(records), "protectedNeckBodyExact": True}))


if __name__ == "__main__":
    main()
