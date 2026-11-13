#!/usr/bin/env python3
"""Assemble the ordinary portrait library from preserved ImageGen RGBA sources.

Examples (the existing PixelOE runtime is reused; nothing is installed):
  python build-library.py --proof
  python build-library.py --build --logical-width 96
  python build-library.py --build --logical-width 128 --scale 3

Proof renders only m01/adult everyday+work at both grids. Full build is explicit.
No runtime application files or historical-figure/card artwork are modified.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import io
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
STAGES = ("infant", "child", "youth", "adult", "middle", "elder")
IDENTITIES = ("m01", "m02", "m03", "f01", "f02", "f03")
ADULT_WARDROBES = ("everyday", "work", "maritime", "commerce", "scholarly", "military", "elite", "performance")
STAGE_WARDROBES = {
    "infant": ("infant",), "child": ("child", "work"),
    "youth": ("youth", "work", "maritime", "scholarly", "performance"),
    "adult": ADULT_WARDROBES, "middle": ADULT_WARDROBES, "elder": ADULT_WARDROBES,
}
LEGACY_ORIGINS = ("merchant-household", "artisan-household", "harbor-household", "fishing-household", "bakery-household", "clerk-household", "weaver-household", "delta-newcomers")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_bytes(path: Path, data: bytes, overwrite: bool) -> None:
    if path.exists():
        if path.read_bytes() == data:
            return
        if not overwrite:
            raise FileExistsError(f"Different output already exists: {path}; pass --overwrite for task-owned rebuild outputs")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_json(path: Path, data, overwrite: bool) -> None:
    write_bytes(path, (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode("utf-8"), overwrite)


def save_png(image, path: Path, overwrite: bool) -> None:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    write_bytes(path, buffer.getvalue(), overwrite)


def default_wardrobe(stage: str) -> str:
    return stage if stage in ("infant", "child", "youth") else "everyday"


def portrait_id(identity: str, stage: str, wardrobe: str) -> str:
    return f"ef-p-{identity}-{stage}-{wardrobe}-v1"


class LibraryBuilder:
    def __init__(self, args):
        self.args = args
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(args.runtime.resolve(strict=True)))
        global Image, ImageDraw, ImageFont, np, cv2, torch
        from PIL import Image, ImageDraw, ImageFont
        import numpy as np
        import cv2
        import torch
        from pixeloe.legacy.pixelize import pixelize
        from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale
        self.pixelize = pixelize
        self.downscale = contrast_based_downscale
        cv2.setNumThreads(args.threads)
        torch.set_num_threads(args.threads)
        self.contract = read_json(ROOT / "contract.json")
        self.mappings = read_json(ROOT / "mappings.json")
        if self.contract["canvas"] != [800, 1000]:
            raise ValueError("This build version requires the declared 800x1000 component canvas")
        self.protected = {ROOT / name: sha(ROOT / name) for name in ("contract.json", "mappings.json")}
        self.heads = {}
        self.garments = {}
        self.composites = {}
        self.portraits = []
        self.versions = {"opencv": cv2.__version__, "numpy": np.__version__, "torch": torch.__version__}
        try:
            self.versions["pixeloe"] = importlib.metadata.version("pixeloe")
        except importlib.metadata.PackageNotFoundError:
            self.versions["pixeloe"] = "unavailable"
        self.background = self.make_background()

    def make_background(self):
        """Opaque jade/umber painted-light field, with no baked subject shadow."""
        yy, xx = np.mgrid[0:1000, 0:800].astype(np.float32)
        radius = np.clip(np.sqrt(((xx - 310) / 620) ** 2 + ((yy - 330) / 820) ** 2), 0, 1)
        light = np.array([83, 99, 85], dtype=np.float32)
        dark = np.array([31, 43, 37], dtype=np.float32)
        rgb = light[None, None, :] * (1 - radius[:, :, None]) + dark[None, None, :] * radius[:, :, None]
        warmth = np.clip(1 - np.sqrt(((xx - 160) / 480) ** 2 + ((yy - 100) / 670) ** 2), 0, 1)
        rgb += warmth[:, :, None] * np.array([14, 6, -3], dtype=np.float32)
        return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")

    def normalise(self, source: Path, destination: Path, target_box, kind: str):
        if not source.exists():
            raise FileNotFoundError(f"Required generated source missing: {source}")
        self.protected[source] = sha(source)
        with Image.open(source) as opened:
            if opened.mode != "RGBA":
                raise ValueError(f"Source component must have a real RGBA alpha channel: {source}")
            original = opened.copy()
        alpha = original.getchannel("A")
        low, high = alpha.getextrema()
        if low != 0 or high < 128:
            raise ValueError(f"Component requires real transparent surroundings and visible foreground: {source}, alpha={low, high}")
        bbox = alpha.point(lambda value: 255 if value >= self.args.alpha_threshold else 0).getbbox()
        if not bbox:
            raise ValueError(f"Empty component above alpha threshold: {source}")
        if (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) < original.width * original.height * .025:
            raise ValueError(f"Implausibly small visible component: {source}")
        crop = original.crop(bbox)
        x0, y0, x1, y1 = target_box
        factor = min((x1 - x0) / crop.width, (y1 - y0) / crop.height)
        size = (max(1, round(crop.width * factor)), max(1, round(crop.height * factor)))
        resized = crop.resize(size, Image.Resampling.LANCZOS)
        # Common lower neckline is the registration anchor. Never stretch a face.
        position = (round((x0 + x1 - size[0]) / 2), y1 - size[1])
        normalised = Image.new("RGBA", (800, 1000), (0, 0, 0, 0))
        normalised.alpha_composite(resized, position)
        save_png(normalised, destination, self.args.overwrite)
        with Image.open(destination) as readback:
            if not np.array_equal(np.asarray(readback), np.asarray(normalised)):
                raise RuntimeError(f"Component lossless readback differs: {destination}")
        record = {
            "kind": kind, "source": relative(source), "sourceSha256": self.protected[source],
            "sourceSize": list(original.size), "sourceAlphaExtrema": [low, high],
            "sourceCropBox": list(bbox), "cropAlphaThreshold": self.args.alpha_threshold,
            "targetBox": list(target_box), "placedAt": list(position), "placedSize": list(size),
            "uniformScale": factor, "aspectRatioPreserved": True,
            "path": relative(destination), "sha256": sha(destination), "canvas": [800, 1000],
            "rgba": True, "sourceUnchanged": sha(source) == self.protected[source],
            "losslessReadbackExact": True,
        }
        return normalised, record

    def head(self, identity, stage):
        key = (identity, stage)
        if key not in self.heads:
            asset = f"ef-h-{identity}-{stage}-v1"
            box = self.contract["composition"]["headTargetBox"]
            image, record = self.normalise(ROOT / "source/heads" / f"{asset}.png", ROOT / "components/heads" / f"{asset}.png", box, "head-and-neck")
            record.update({"id": asset, "identityId": identity, "stage": stage,
                           "nominalNeckAnchor": [400, 700], "componentBottom": box[3],
                           "anchorNote": "Design registration target; no automatic anatomical landmark detector is claimed."})
            self.heads[key] = (image, record)
        return self.heads[key]

    def garment(self, wardrobe, stage):
        placement = stage if stage in ("infant", "child", "youth") else "adult"
        key = (wardrobe, placement)
        if key not in self.garments:
            widths = {"infant": 560, "child": 600, "youth": 680, "adult": 730}
            width = widths[placement]
            box = [(800 - width) // 2, 625, (800 + width) // 2, 1000]
            asset = f"ef-w-{wardrobe}-{placement}-v1"
            image, record = self.normalise(ROOT / "source/wardrobe" / f"ef-w-{wardrobe}-v1.png", ROOT / "components/wardrobe" / f"{asset}.png", box, "garment")
            record.update({"id": asset, "wardrobeId": wardrobe, "placementStage": placement,
                           "nominalNeckAnchor": [400, 700]})
            self.garments[key] = (image, record)
        return self.garments[key]

    def assemble(self, identity, stage, wardrobe):
        key = (identity, stage, wardrobe)
        if key in self.composites:
            return self.composites[key]
        head, head_record = self.head(identity, stage)
        garment, garment_record = self.garment(wardrobe, stage)
        source = ROOT / "portraits/assembled" / f"{portrait_id(*key)}.png"
        assembled = self.background.convert("RGBA")
        assembled.alpha_composite(garment)
        assembled.alpha_composite(head)
        if assembled.getchannel("A").getextrema() != (255, 255):
            raise RuntimeError("Assembled portrait must be deliberately opaque before PixelOE")
        assembled = assembled.convert("RGB")
        save_png(assembled, source, self.args.overwrite)
        record = {"id": portrait_id(*key), "identityId": identity, "stage": stage,
                  "ageExample": self.contract["ageExamples"][stage], "wardrobeId": wardrobe,
                  "headId": head_record["id"], "garmentId": garment_record["id"],
                  "assembled": relative(source), "assembledSha256": sha(source),
                  "backgroundId": "jade-umber-v1", "layerOrder": ["background", "garment", "head-and-neck"],
                  "opaque": True, "sourceCanvas": [800, 1000]}
        self.composites[key] = (assembled, record)
        return self.composites[key]

    def pixel_render(self, identity, stage, wardrobe, width, height, scale):
        assembled, composition = self.assemble(identity, stage, wardrobe)
        profile = f"{width}x{height}-s{scale}-t{self.args.thickness}"
        pid = composition["id"]
        output = ROOT / "portraits" / profile / f"{pid}.png"
        logical_path = output.with_name(output.stem + ".logical.png")
        qa_path = ROOT / "qa/pixels" / profile / f"{pid}.json"
        image = cv2.cvtColor(np.asarray(assembled), cv2.COLOR_RGB2BGR)
        options = dict(mode="contrast", target_size=(width, height), patch_size=4,
                       pixel_size=scale, thickness=self.args.thickness, color_matching=True,
                       contrast=1.0, saturation=1.0, colors=None, no_upscale=True, no_downscale=True)
        target_area_root = math.sqrt(width * height) + 1e-6

        def render():
            cv2.setRNGSeed(0)
            result = self.downscale(self.pixelize(image.copy(), **options), target_area_root)
            if result.shape != (height, width, 3):
                raise RuntimeError(f"Upstream PixelOE exact grid mismatch: {result.shape}")
            return result

        logical = render()
        if not np.array_equal(logical, render()):
            raise RuntimeError(f"PixelOE repeat render differs for {pid}")
        enlarged = cv2.resize(logical, (width * scale, height * scale), interpolation=cv2.INTER_NEAREST)
        for destination, pixels in ((logical_path, logical), (output, enlarged)):
            ok, encoded = cv2.imencode(".png", pixels)
            if not ok:
                raise RuntimeError(f"Could not encode {destination}")
            write_bytes(destination, encoded.tobytes(), self.args.overwrite)
            decoded = cv2.imread(str(destination), cv2.IMREAD_UNCHANGED)
            if not np.array_equal(decoded, pixels):
                raise RuntimeError(f"PNG readback differs for {destination}")
        if not np.all(enlarged.reshape(height, scale, width, scale, 3) == logical[:, None, :, None, :]):
            raise RuntimeError(f"Noninteger pixel blocks in {output}")
        source = ROOT / composition["assembled"]
        if sha(source) != composition["assembledSha256"]:
            raise RuntimeError("Opaque assembly was modified during pixel conversion")
        qa = {
            "id": pid, "method": "PixelOE legacy outline prepass + upstream contrast_based_downscale",
            "runtime": str(self.args.runtime.resolve()), "versions": self.versions,
            "source": composition["assembled"], "sourceSha256": composition["assembledSha256"],
            "options": options, "logical": [width, height], "scale": scale,
            "output": [width * scale, height * scale], "explicitGridRoundingEpsilon": 1e-6,
            "logicalPath": relative(logical_path), "logicalSha256": sha(logical_path),
            "outputPath": relative(output), "outputSha256": sha(output),
            "logicalPixelSha256": hashlib.sha256(logical.tobytes()).hexdigest(),
            "uniqueColours": int(np.unique(logical.reshape(-1, 3), axis=0).shape[0]),
            "deterministic": True, "exactIntegerBlocks": True, "pngReadbackExact": True,
            "opaqueSource": True, "sourceUnchanged": True, "interpolatingUpscale": False,
        }
        write_json(qa_path, qa, self.args.overwrite)
        record = dict(composition, profile=profile, path=relative(output), sha256=sha(output),
                      logical=relative(logical_path), logicalSha256=sha(logical_path), qa=relative(qa_path),
                      logicalSize=[width, height], outputSize=[width * scale, height * scale])
        self.portraits.append(record)
        print(json.dumps({"rendered": pid, "profile": profile}), flush=True)
        return record

    def assert_sources_unchanged(self):
        for source, expected in self.protected.items():
            if sha(source) != expected:
                raise RuntimeError(f"Protected input changed: {source}")

    def font(self, size=15):
        font = Path("C:/Windows/Fonts/segoeui.ttf")
        return ImageFont.truetype(str(font), size) if font.exists() else ImageFont.load_default()

    def grid_sheet(self, destination, cells, columns, cell_size, image_size):
        rows = math.ceil(len(cells) / columns)
        sheet = Image.new("RGB", (columns * cell_size[0], rows * cell_size[1]), "#e4d8bc")
        draw = ImageDraw.Draw(sheet)
        for index, (path, label) in enumerate(cells):
            x, y = (index % columns) * cell_size[0], (index // columns) * cell_size[1]
            with Image.open(path) as opened:
                thumb = opened.convert("RGB").resize(image_size, Image.Resampling.NEAREST)
            sheet.paste(thumb, (x + (cell_size[0] - image_size[0]) // 2, y + 5))
            draw.text((x + 8, y + image_size[1] + 12), label, fill="#26372f", font=self.font(13))
        save_png(sheet, destination, self.args.overwrite)

    def review_sheets(self, proof=False):
        if proof:
            cells = [(ROOT / p["path"], f'{p["identityId"]} {p["wardrobeId"]} / {p["profile"]}') for p in self.portraits]
            self.grid_sheet(ROOT / "review/proof/profile-comparison.png", cells, 2, (400, 520), (384, 480))
            small = [(ROOT / p["path"], f'{p["identityId"]} {p["wardrobeId"]} {p["logicalSize"][0]}') for p in self.portraits]
            for width, height in ((64, 80), (48, 60), (40, 50)):
                self.grid_sheet(ROOT / f"review/proof/actual-size-{width}x{height}.png", small, 4, (150, height + 40), (width, height))
            adult = {(p["identityId"], p["logicalSize"][0]): p for p in self.portraits if p["wardrobeId"] == "everyday"}
            if all((identity, width) in adult for identity in IDENTITIES for width in (96, 128)):
                cells = [(ROOT / adult[(identity, width)]["path"], f"{identity} / {width}") for width in (96, 128) for identity in IDENTITIES]
                self.grid_sheet(ROOT / "review/proof/adult-six-identities.png", cells, 6, (160, 224), (144, 180))
            return
        lookup = {(p["identityId"], p["stage"], p["wardrobeId"]): ROOT / p["path"] for p in self.portraits}
        lifetime = [(lookup[(identity, stage, default_wardrobe(stage))], f"{identity} / {stage}") for identity in IDENTITIES for stage in STAGES]
        self.grid_sheet(ROOT / "review/lifetimes-6x6.png", lifetime, 6, (160, 224), (144, 180))
        wardrobe = [(lookup[(identity, "adult", garment)], f"{identity} / {garment}") for garment in ADULT_WARDROBES for identity in IDENTITIES]
        self.grid_sheet(ROOT / "review/adult-wardrobe-6x8.png", wardrobe, 6, (160, 224), (144, 180))
        for width, height in ((64, 80), (48, 60), (40, 50)):
            self.grid_sheet(ROOT / f"review/actual-size-{width}x{height}.png", lifetime, 6, (120, height + 40), (width, height))

    def manifest(self, proof=False):
        identities = [{"id": identity, "sex": "male" if identity.startswith("m") else "female", "avatarVariant": int(identity[1:]) - 1} for identity in IDENTITIES]
        result = {
            "schemaVersion": 1, "libraryId": self.contract["libraryId"],
            "agentMapPath": "AGENT_MAP.md", "readmePath": "README.md",
            "sourceIndexPath": "source-index.json", "galleryPath": "review/index.html",
            "referenceCreditsPath": "references/credits.json", "handoffAuditPath": "qa/library-audit.json",
            "scope": "bounded-proof" if proof else "complete-ordinary-portrait-library",
            "canvas": [800, 1000], "style": self.contract["style"],
            "runtimeIntegrated": False, "identities": identities, "stages": list(STAGES),
            "stageWardrobes": STAGE_WARDROBES, "defaultWardrobes": {stage: default_wardrobe(stage) for stage in STAGES},
            "heads": [record for _, record in self.heads.values()],
            "garments": [record for _, record in self.garments.values()], "portraits": self.portraits,
            "mappingPath": "mappings.json", "mappingSha256": sha(ROOT / "mappings.json"),
            "contractPath": "contract.json", "contractSha256": sha(ROOT / "contract.json"),
            "sourceIntegrity": {"allProtectedInputsUnchanged": True, "inputCount": len(self.protected)},
            "limitations": ["Components are generated painterly RGBA, not rigged anatomy or hand-authored brushwork.",
                            "Clothing is an authored visual grouping, not attested occupational uniform.",
                            "Pixel integrity checks do not certify likeness, pupil visibility or anatomical seam quality; inspect review sheets.",
                            "Existing runtime assets remain retained; family/child binding requires the documented identity/UI work."],
        }
        if not proof:
            bridges = []
            for origin in LEGACY_ORIGINS:
                for item in identities:
                    for stage in STAGES:
                        bridges.append({"legacyPath": f'/assets/pixel/portraits/{origin}/{item["sex"]}/{stage}-{item["avatarVariant"]}.svg',
                                        "identityId": item["id"], "stage": stage,
                                        "portraitId": portrait_id(item["id"], stage, default_wardrobe(stage))})
            result["legacySlotBridges"] = bridges
            result["originSelectors"] = [{"originId": origin["id"], "defaultWardrobes": result["defaultWardrobes"],
                                            "identityIds": list(IDENTITIES), "currentOccupationWins": True} for origin in self.mappings["origins"]]
            result["jobWardrobeBindings"] = self.mappings["jobs"]
            result["encounterWardrobeBindings"] = self.mappings["encounters"]
            result["unrecordedIdentityFallbacks"] = {
                "family": "Use recorded sex plus stable presentation-only variant hash; persist or version the mapping before runtime integration.",
                "children": "Existing records lack sex and variant; retain generic compatibility portrait until explicitly recorded.",
                "unknownOccupation": "Use age-stage default wardrobe, never infer a current profession from natal origin.",
                "legacyGeneric18": "Retain current runtime generic paths; this authoring build does not overwrite them.",
            }
            ids = {p["id"] for p in self.portraits}
            if len(self.portraits) != 192 or len(self.heads) != 36 or len(bridges) != 288:
                raise RuntimeError("Full library cardinality contract failed")
            if any(bridge["portraitId"] not in ids for bridge in bridges):
                raise RuntimeError("Dangling legacy portrait bridge")
            if len(result["originSelectors"]) != 16 or len(result["jobWardrobeBindings"]) != 33 or len(result["encounterWardrobeBindings"]) != 16:
                raise RuntimeError("World mapping coverage changed; review mappings before rebuilding")
        return result

    def run(self):
        if self.args.diagnostics:
            for thickness in (0, 1):
                self.args.thickness = thickness
                self.pixel_render("m01", "adult", "everyday", 128, 160, 3)
            cells = [(ROOT / p["path"], f'128x160 / outline {p["profile"].split("-t")[-1]}') for p in self.portraits]
            self.grid_sheet(ROOT / "review/diagnostics/outline-comparison.png", cells, 2, (400, 520), (384, 480))
            for width, height in ((64, 80), (48, 60), (40, 50)):
                self.grid_sheet(ROOT / f"review/diagnostics/outline-{width}x{height}.png", cells, 2, (180, height + 40), (width, height))
            ages = []
            for stage in STAGES:
                _, composition = self.assemble("m01", stage, default_wardrobe(stage))
                ages.append((ROOT / composition["assembled"], f"m01 / {stage}"))
            self.grid_sheet(ROOT / "review/diagnostics/m01-six-age-assemblies.png", ages, 6, (200, 290), (192, 240))
            self.assert_sources_unchanged()
            write_json(ROOT / "qa/diagnostics-manifest.json", self.manifest(proof=True), self.args.overwrite)
            print(json.dumps({"diagnostics": True, "pixelProofs": 2, "ageAssemblies": 6, "sourcesUnchanged": True}), flush=True)
            return
        if self.args.proof:
            cases = [("m01", "adult", "everyday"), ("m01", "adult", "work")]
            if self.args.proof_all_adults:
                cases += [(identity, "adult", "everyday") for identity in IDENTITIES if identity != "m01"]
            for identity, stage, wardrobe in cases:
                for width, height, scale in ((96, 120, 4), (128, 160, 3)):
                    self.pixel_render(identity, stage, wardrobe, width, height, scale)
        else:
            for identity in IDENTITIES:
                for stage in STAGES:
                    for wardrobe in STAGE_WARDROBES[stage]:
                        self.pixel_render(identity, stage, wardrobe, self.args.logical_width, self.args.logical_height, self.args.scale)
        self.assert_sources_unchanged()
        self.review_sheets(proof=self.args.proof)
        destination = ROOT / ("qa/proof-manifest.json" if self.args.proof else "manifest.json")
        write_json(destination, self.manifest(proof=self.args.proof), self.args.overwrite)
        print(json.dumps({"manifest": relative(destination), "portraits": len(self.portraits), "heads": len(self.heads), "garmentPlacements": len(self.garments), "protectedSourcesUnchanged": True}), flush=True)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--proof", action="store_true", help="m01 adult everyday/work at 96x120 and 128x160; never runs full build")
    mode.add_argument("--build", action="store_true", help="Explicit full 192-portrait build at the selected single grid")
    mode.add_argument("--diagnostics", action="store_true", help="m01 outline0/1 comparison plus six-age source-assembly sheet; no full build")
    parser.add_argument("--proof-all-adults", action="store_true", help="Also include the other five adult everyday proofs")
    parser.add_argument("--runtime", type=Path, default=REPO / "artifacts/pixeloe-runtime/site-packages")
    parser.add_argument("--logical-width", type=int, default=128)
    parser.add_argument("--logical-height", type=int)
    parser.add_argument("--scale", type=int)
    parser.add_argument("--thickness", type=int, default=0)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--alpha-threshold", type=int, default=32)
    parser.add_argument("--overwrite", action="store_true", help="Replace only deterministic task-owned outputs; source files remain protected")
    args = parser.parse_args()
    if args.logical_width <= 0 or args.logical_width % 4:
        parser.error("--logical-width must be a positive multiple of four for a 4:5 grid")
    args.logical_height = args.logical_height or args.logical_width * 5 // 4
    args.scale = args.scale or (384 // args.logical_width if 384 % args.logical_width == 0 else 4)
    if args.logical_height * 4 != args.logical_width * 5 or args.scale <= 0 or args.threads <= 0 or args.thickness < 0:
        parser.error("Require a 4:5 grid, positive scale/threads, and nonnegative thickness")
    if not 1 <= args.alpha_threshold <= 127:
        parser.error("--alpha-threshold must be from 1 through 127")
    if args.proof_all_adults and not args.proof:
        parser.error("--proof-all-adults requires --proof")
    return args


if __name__ == "__main__":
    try:
        LibraryBuilder(arguments()).run()
    except (ValueError, RuntimeError, OSError) as error:
        print(f"build-library.py: {error}", file=sys.stderr)
        raise SystemExit(1)
