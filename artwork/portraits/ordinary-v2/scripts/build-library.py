#!/usr/bin/env python3
"""V2 body rig: two immutable M/F silhouettes; fitted collars; preserved faces.

--proof assembles complete adult portraits without a pixel conversion.
--proof --pixel also makes the bounded PixelOE proof. --build is explicit.
V1 source images and the proven PixelOE engine are read-only dependencies.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT.parent / "ordinary-v1"
REPO = ROOT.parents[2]
spec = importlib.util.spec_from_file_location("everfolk_v1_pixel_engine", V1 / "scripts/build-library.py")
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
engine.ROOT = ROOT  # Redirect derived output paths in inherited PixelOE/export helpers only.
IDENTITIES, STAGES = engine.IDENTITIES, engine.STAGES
STAGE_WARDROBES = engine.STAGE_WARDROBES


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rel(path):
    import os
    return Path(os.path.relpath(path, ROOT)).as_posix()


def pid(identity, stage, wardrobe):
    return f"ef-p-{identity}-{stage}-{wardrobe}-v2"


class BodyLibrary(engine.LibraryBuilder):
    def __init__(self, args):
        self.args = args
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(args.runtime.resolve(strict=True)))
        global Image, ImageDraw, ImageFilter, np, cv2, torch
        from PIL import Image, ImageDraw, ImageFilter, ImageFont
        import numpy as np
        import cv2
        import torch
        from pixeloe.legacy.pixelize import pixelize
        from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale
        for name, value in {"Image": Image, "ImageDraw": ImageDraw, "ImageFont": ImageFont, "np": np, "cv2": cv2, "torch": torch}.items():
            setattr(engine, name, value)
        cv2.setNumThreads(args.threads)
        torch.set_num_threads(args.threads)
        self.pixelize, self.downscale = pixelize, contrast_based_downscale
        regional_spec=importlib.util.spec_from_file_location("everfolk_regional_finish",ROOT/"scripts/regional-finish.py")
        self.regional=importlib.util.module_from_spec(regional_spec)
        regional_spec.loader.exec_module(self.regional)
        self.contract = read_json(ROOT / "contract.json")
        self.mappings = read_json(ROOT / self.contract["mappingPath"])
        self.anchor_data = read_json(ROOT / self.contract["headAnchorsPath"])
        self.anchors = {(h["identityId"], h["stage"]): h for h in self.anchor_data["heads"]}
        self.protected = {}
        for path in (ROOT / "contract.json", ROOT / self.contract["mappingPath"], ROOT / self.contract["headAnchorsPath"], V1 / "scripts/build-library.py"):
            self.protect(path)
        self.protect(ROOT/"scripts/regional-finish.py")
        self.wardrobe_anchors = {}
        for path in (ROOT / "wardrobe-anchors.json", ROOT / "female-wardrobe-anchors.json", ROOT / "male-wardrobe-anchors.json"):
            if path.exists():
                self.protect(path)
                data = read_json(path)
                for item in data.get("garments", []):
                    self.wardrobe_anchors[(item["sex"], item["wardrobeId"])] = item
        self.heads, self.garments, self.composites, self.portraits = {}, {}, {}, []
        self.bodies, self.body_placements, self.front_hair, self.join_qa = {}, {}, {}, []
        self.canonical_geometry, self.body_masks, self.skin_masks = {}, {}, {}
        self.background = self.make_background()
        self.versions = {"opencv": cv2.__version__, "numpy": np.__version__, "torch": torch.__version__}
        try:
            self.versions["pixeloe"] = importlib.metadata.version("pixeloe")
        except importlib.metadata.PackageNotFoundError:
            self.versions["pixeloe"] = "unavailable"

    def protect(self, path):
        path = Path(path).resolve(strict=True)
        self.protected[path] = sha(path)
        return path

    def load_rgba(self, path):
        path = self.protect(path)
        with Image.open(path) as opened:
            if opened.mode != "RGBA":
                raise ValueError(f"Real RGBA component required: {path}")
            image = opened.copy()
        low, high = image.getchannel("A").getextrema()
        if low != 0 or high < 128:
            raise ValueError(f"Meaningful alpha required: {path}, range={(low, high)}")
        return image

    def save(self, image, path):
        engine.save_png(image, path, self.args.overwrite)
        with Image.open(path) as opened:
            if not np.array_equal(np.asarray(opened), np.asarray(image)):
                raise RuntimeError(f"Lossless image readback differs: {path}")

    def polygon_mask(self, size, polygons):
        result = Image.new("L", size, 0)
        draw = ImageDraw.Draw(result)
        for polygon in polygons:
            draw.polygon([tuple(point) for point in polygon], fill=255)
        return result

    def warp(self, image, matrix, size=(800, 1000)):
        raw = np.asarray(image)
        result = cv2.warpAffine(raw, np.asarray(matrix, dtype=np.float32), size, flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        return Image.fromarray(result, image.mode)

    def body_geometry(self, sex):
        if sex in self.canonical_geometry:
            return self.canonical_geometry[sex]
        config = self.contract["bodies"][sex]
        source = ROOT / config["path"]
        raw = self.load_rgba(source)
        if list(raw.size) != config["sourceCanvas"]:
            raise ValueError(f"Body master canvas changed; remeasure registration: {source}")
        # One complete registered frame: no alpha bounding-box fitting.
        canonical = raw.resize((800, 1000), Image.Resampling.LANCZOS)
        # Fixed sex-specific smooth cervical contours fit behind the jaw.
        # The upper neck is narrower than the master's flat extraction cut;
        # cubic easing restores its natural width without a diagonal ledge.
        neck_y = config["neckTop"][1]
        top_half = 45 if sex == "male" else 38
        yy,xx=np.mgrid[0:1000,0:800]
        # Restore before the highest back collar begins. An 80px cap would
        # erase the male shirt/clavicle and create a horizontal green band.
        restore_height = 36 if sex == "male" else 56
        fraction=np.clip((yy-neck_y)/restore_height,0,1)
        ease=fraction*fraction*(3-2*fraction)
        original_alpha=np.asarray(canonical.getchannel("A"))
        seed_y=next(y for y in range(neck_y,neck_y+8) if np.any(original_alpha[y,200:600]>=128))
        top_x=np.flatnonzero(original_alpha[seed_y]>=128)
        inset=max(0,(top_x[-1]-top_x[0]-2*top_half)/2)
        # A first antialiased extraction row may have no solid pixels at all.
        # Treat it as empty; a full-width default would retain a ghost stripe.
        row_left=np.full(1000,400,dtype=float)
        row_right=np.full(1000,400,dtype=float)
        for y in range(neck_y,neck_y+restore_height):
            visible_x=np.flatnonzero(original_alpha[y]>=128)
            if len(visible_x):
                row_left[y]=visible_x[0]
                row_right[y]=visible_x[-1]
        neck_left=row_left[:,None]+inset*(1-ease)
        neck_right=row_right[:,None]-inset*(1-ease)
        keep=((yy>=neck_y)&(xx>=neck_left)&(xx<=neck_right)) | (yy>=neck_y+restore_height)
        cap_mask=Image.fromarray((keep*255).astype(np.uint8),"L").filter(ImageFilter.GaussianBlur(.6))
        pixels=np.asarray(canonical).copy()
        pixels[:,:,3]=np.minimum(pixels[:,:,3],np.asarray(cap_mask))
        canonical=Image.fromarray(pixels,"RGBA")
        skin = self.polygon_mask(raw.size, config["skinPolygons"])
        skin = Image.fromarray(np.minimum(np.asarray(skin), np.asarray(raw.getchannel("A"))), "L")
        skin = skin.resize((800, 1000), Image.Resampling.LANCZOS)
        skin = Image.fromarray(np.minimum(np.asarray(skin), np.asarray(canonical.getchannel("A"))), "L")
        path = ROOT / "components/body-geometry" / f"ef-b-{sex}-canonical-v2.png"
        mask_path = ROOT / "components/masks" / f"ef-b-{sex}-skin-v2.png"
        self.save(canonical, path)
        self.save(skin, mask_path)
        self.body_masks[sex], self.skin_masks[sex] = canonical.getchannel("A"), skin
        record = {"id": f"ef-b-{sex}-canonical-v2", "sex": sex, "source": rel(source), "sourceSha256": sha(source), "path": rel(path), "sha256": sha(path), "skinMask": rel(mask_path), "skinMaskSha256": sha(mask_path), "canvas": [800, 1000], "geometryChangesBetweenIdentities": False}
        self.canonical_geometry[sex] = (canonical, raw, record)
        return self.canonical_geometry[sex]

    def identity_body(self, identity, stage):
        palette_key = (identity, stage)
        if palette_key in self.bodies:
            return self.bodies[palette_key]
        sex = "male" if identity.startswith("m") else "female"
        canonical, native, geometry = self.body_geometry(sex)
        anchor = self.anchors[(identity, stage)]
        head_path = ROOT / anchor["source"]
        reference = self.load_rgba(head_path)
        def median_lab(image, box):
            crop = np.asarray(image.crop(tuple(box)).convert("RGB"), dtype=np.float32) / 255
            return np.median(cv2.cvtColor(crop, cv2.COLOR_RGB2LAB).reshape(-1, 3), axis=0)
        source_lab = median_lab(native, self.contract["bodies"][sex]["sourceSkinSampleBox"])
        target_lab = median_lab(reference, anchor["skinSampleBox"])
        delta = target_lab - source_lab
        rgb = np.asarray(canonical.convert("RGB"), dtype=np.float32) / 255
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        shifted = cv2.cvtColor(lab + delta[None, None, :], cv2.COLOR_LAB2RGB)
        weight = np.asarray(self.skin_masks[sex], dtype=np.float32)[:, :, None] / 255
        new_rgb = np.clip(np.round((rgb * (1 - weight) + shifted * weight) * 255), 0, 255).astype(np.uint8)
        if stage == "infant":
            # Preserve the approved scaled geometry while softening adult
            # clavicle paint contrast beneath the infant wrap opening.
            neck=self.polygon_mask(native.size,self.contract["bodies"][sex]["skinPolygons"][:1]).resize((800,1000),Image.Resampling.LANCZOS)
            neck=Image.fromarray(np.minimum(np.asarray(neck),np.asarray(self.skin_masks[sex])),"L")
            neck_weight=np.asarray(neck,dtype=np.float32)[:,:,None]/255
            smooth=np.asarray(Image.fromarray(new_rgb,"RGB").filter(ImageFilter.GaussianBlur(4)),dtype=np.float32)/255
            lab_infant=cv2.cvtColor(smooth,cv2.COLOR_RGB2LAB)
            chosen=np.asarray(neck)>=128
            if np.any(chosen):
                mid=float(np.median(lab_infant[:,:,0][chosen]))
                lab_infant[:,:,0]=mid+.45*(lab_infant[:,:,0]-mid)
            softened=cv2.cvtColor(lab_infant,cv2.COLOR_LAB2RGB)*255
            new_rgb=np.clip(np.round(new_rgb*(1-neck_weight*.85)+softened*(neck_weight*.85)),0,255).astype(np.uint8)
        if stage in ("child", "youth"):
            # Age the surface treatment, not the body geometry: soften the
            # canonical adult forearm's muscular contrast inside arm masks.
            arm = self.polygon_mask(native.size, self.contract["bodies"][sex]["skinPolygons"][1:]).resize((800,1000),Image.Resampling.LANCZOS)
            arm=Image.fromarray(np.minimum(np.asarray(arm),np.asarray(self.skin_masks[sex])),"L")
            arm_weight=np.asarray(arm,dtype=np.float32)[:,:,None]/255
            soft=np.asarray(Image.fromarray(new_rgb,"RGB").filter(ImageFilter.GaussianBlur(3 if stage=="child" else 1.5)),dtype=np.float32)
            lab_age=cv2.cvtColor(soft/255,cv2.COLOR_RGB2LAB)
            selected=np.asarray(arm)>=128
            if np.any(selected):
                mid=float(np.median(lab_age[:,:,0][selected]))
                lab_age[:,:,0]=mid+(lab_age[:,:,0]-mid)*(.65 if stage=="child" else .85)
            softened=cv2.cvtColor(lab_age,cv2.COLOR_LAB2RGB)*255
            strength=.75 if stage=="child" else .45
            new_rgb=np.clip(np.round(new_rgb*(1-arm_weight*strength)+softened*(arm_weight*strength)),0,255).astype(np.uint8)
        tinted = Image.fromarray(np.dstack([new_rgb, np.asarray(canonical.getchannel("A"))]), "RGBA")
        if not np.array_equal(np.asarray(tinted.getchannel("A")), np.asarray(canonical.getchannel("A"))):
            raise RuntimeError("Skin calibration changed body geometry")
        outside = np.asarray(self.skin_masks[sex]) == 0
        if np.any(np.asarray(tinted)[:, :, :3][outside] != np.asarray(canonical)[:, :, :3][outside]):
            raise RuntimeError("Skin calibration changed clothing outside explicit skin mask")
        path = ROOT / "components/body-palettes" / f"ef-b-{identity}-{stage}-v2.png"
        self.save(tinted, path)
        record = {"id": f"ef-b-{identity}-{stage}-v2", "identityId": identity, "stage": stage, "sex": sex, "geometryId": geometry["id"], "path": rel(path), "sha256": sha(path), "sourceSkinSampleLab": source_lab.tolist(), "targetSkinSampleLab": target_lab.tolist(), "labOffset": delta.tolist(), "skinReference": rel(head_path), "skinReferenceBox": anchor["skinSampleBox"], "bodyAlphaUnchanged": True, "outsideSkinMaskPixelsUnchanged": True}
        self.bodies[palette_key] = (tinted, record)
        return self.bodies[palette_key]

    def age_matrix(self, sex, stage):
        config = self.contract["ageProfiles"][stage]
        scale = config["bodyScale"]
        original_y = self.contract["bodies"][sex]["neckTop"][1]
        neck_y = config.get("neckTopY", original_y)
        return np.array([[scale, 0, 400 * (1 - scale)], [0, scale, neck_y - original_y * scale]], dtype=np.float32)

    def age_body(self, identity, stage):
        placement = stage if stage in ("infant", "child", "youth") else "adult"
        key = (identity, stage)
        if key not in self.body_placements:
            body, base = self.identity_body(identity, stage)
            matrix = self.age_matrix(base["sex"], placement)
            placed = self.warp(body, matrix)
            path = ROOT / "components/bodies" / f"ef-b-{identity}-{stage}-placed-v2.png"
            self.save(placed, path)
            self.body_placements[key] = (placed, {"id": path.stem, "identityId": identity, "placementStage": placement, "paletteBodyId": base["id"], "path": rel(path), "sha256": sha(path), "ageMatrix": matrix.tolist(), "sameSexAndAgeSilhouetteAcrossIdentities": True})
        return self.body_placements[key]

    def head(self, identity, stage):
        key = (identity, stage)
        if key in self.heads:
            return self.heads[key]
        if key not in self.anchors:
            raise ValueError(f"Measured native head anchors missing: {identity}/{stage}")
        config = self.anchors[key]
        source = ROOT / config["source"]
        raw = self.load_rgba(source)
        if list(raw.size) != config["sourceDimensions"]:
            raise ValueError(f"Head dimensions changed: {source}")
        # Keep only a short anatomical throat overlap below the measured jaw.
        # Removing exactly at the jaw exposes the flat cut corners of the body
        # master. The retained ~25-40px overlap joins the physical neck and is
        # well above the foreground collar; the long source neck is removed.
        throat_overlap_native = 15
        boundary = [[x, min(raw.height, y + throat_overlap_native)] for x, y in config["neckRemovalPolygon"]]
        removal_image = self.polygon_mask(raw.size, [boundary]).filter(ImageFilter.GaussianBlur(6))
        removal = np.asarray(removal_image, dtype=np.uint8)
        protection = np.asarray(self.polygon_mask(raw.size, config.get("hairProtectionPolygons", [])), dtype=np.uint8)
        removal = np.minimum(removal, 255 - protection)
        trimmed = np.asarray(raw).copy()
        trimmed[:, :, 3] = np.round(trimmed[:, :, 3].astype(np.float32) * (1 - removal / 255)).astype(np.uint8)
        front = np.asarray(raw).copy()
        front[:, :, 3] = np.minimum(front[:, :, 3], protection)
        sex = "male" if identity.startswith("m") else "female"
        body_config = self.contract["bodies"][sex]
        profile = self.contract["ageProfiles"][stage]
        eye = profile.get("eyeTarget", body_config["eyeTarget"])
        chin = profile.get("chinTarget", body_config["chinTarget"])
        scale = (chin[1] - eye[1]) / (config["chin"][1] - config["eyeMidpoint"][1])
        matrix = [[scale, 0, eye[0] - scale * config["eyeMidpoint"][0]], [0, scale, eye[1] - scale * config["eyeMidpoint"][1]]]
        image = self.warp(Image.fromarray(trimmed, "RGBA"), matrix)
        hair = self.warp(Image.fromarray(front, "RGBA"), matrix)
        # A short retained throat patch may not introduce its own neck sides.
        # Below the measured jaw, it stays within the fixed physical body.
        original_below=self.warp(self.polygon_mask(raw.size,[config["neckRemovalPolygon"]]),matrix)
        body,_=self.age_body(identity,stage)
        pixels=np.asarray(image).copy()
        below=np.asarray(original_below)>=128
        protected=np.asarray(hair.getchannel("A"))>=32
        clip=below & ~protected
        pixels[:,:,3][clip]=np.minimum(pixels[:,:,3][clip],np.asarray(body.getchannel("A"))[clip])
        image=Image.fromarray(pixels,"RGBA")
        path = ROOT / "components/heads" / f"ef-h-{identity}-{stage}-v2.png"
        hair_path = ROOT / "components/hair-front" / f"ef-hair-{identity}-{stage}-v2.png"
        self.save(image, path)
        self.save(hair, hair_path)
        record = {"id": path.stem, "identityId": identity, "stage": stage, "source": rel(source), "sourceSha256": sha(source), "path": rel(path), "sha256": sha(path), "frontHairPath": rel(hair_path), "frontHairSha256": sha(hair_path), "longSourceNeckRemoved": True, "neckRemovalPolygon": config["neckRemovalPolygon"], "throatOverlapNativePixels": throat_overlap_native, "throatEdgeFeatherNativePixels": 6, "hairProtectionPolygons": config.get("hairProtectionPolygons", []), "eyeTarget": eye, "chinTarget": chin, "matrix": matrix, "faceAspectPreserved": True, "annotationStatus": "Manual source measurements; requires smooth anatomical seam review"}
        self.heads[key], self.front_hair[key] = (image, record), hair
        return self.heads[key]

    def garment(self, sex, wardrobe, stage):
        placement = stage if stage in ("infant", "child", "youth") else "adult"
        family = "infant" if stage == "infant" else "everyday" if wardrobe in ("child", "youth") else wardrobe
        key = (sex, family, placement)
        if key in self.garments:
            return self.garments[key]
        source = ROOT / "source/wardrobe" / f"ef-w-{sex}-{family}-v2.png"
        self.body_geometry(sex)
        raw = self.load_rgba(source)
        body_config = self.contract["bodies"][sex]
        annotation = self.wardrobe_anchors.get((sex, family))
        if annotation:
            points = ("leftShoulder", "rightShoulder", "waistCenter")
            source_points = np.float32([annotation[p] for p in points])
            native_target = np.float32([body_config["sourceLandmarks"][p] for p in points])
            native_target *= np.float32([800 / body_config["sourceCanvas"][0], 1000 / body_config["sourceCanvas"][1]])
            matrix = cv2.getAffineTransform(source_points, native_target)
            registration = "measured shoulder/waist affine tailoring to fixed canonical body"
        elif list(raw.size) == body_config["sourceCanvas"]:
            matrix = np.float32([[800 / raw.width, 0, 0], [0, 1000 / raw.height, 0]])
            registration = "shared full canonical canvas; no bounding-box fitting"
        else:
            raise ValueError(f"Garment needs measured registration; source canvas differs from body: {source}, {raw.size}")
        canonical = self.warp(raw, matrix)
        if family != "infant":
            # Fixed body is authoritative: fitted clothing cannot invent shoulders or arms.
            array = np.asarray(canonical).copy()
            array[:, :, 3] = np.minimum(array[:, :, 3], np.asarray(self.body_masks[sex]))
            canonical = Image.fromarray(array, "RGBA")
        placed = self.warp(canonical, self.age_matrix(sex, placement))
        path = ROOT / "components/wardrobe" / f"ef-w-{sex}-{family}-{placement}-v2.png"
        self.save(placed, path)
        record = {"id": path.stem, "sex": sex, "wardrobeId": family, "placementStage": placement, "source": rel(source), "sourceSha256": sha(source), "path": rel(path), "sha256": sha(path), "registration": registration, "registrationMatrix": np.asarray(matrix).tolist(), "bodyEnvelopeClipped": family != "infant", "occlusion": "foreground clothing and collar, below protected braid"}
        self.garments[key] = (placed, record)
        return self.garments[key]

    def assemble(self, identity, stage, wardrobe):
        key = (identity, stage, wardrobe)
        if key in self.composites:
            return self.composites[key]
        sex = "male" if identity.startswith("m") else "female"
        body, body_record = self.age_body(identity, stage)
        head, head_record = self.head(identity, stage)
        clothing, clothing_record = self.garment(sex, wardrobe, stage)
        if stage == "infant":
            # A wrap occludes the complete underlying torso and forearms.
            # Retain the physical neck behind its opening, but do not expose
            # adult cream sleeves/arms beside a narrower wrapped silhouette.
            raw_body = np.asarray(body).copy()
            wrap_alpha = np.asarray(clothing.getchannel("A"))
            ys,xs=np.nonzero(wrap_alpha>=32)
            if not len(xs):
                raise RuntimeError("Empty infant wrap")
            hull=cv2.convexHull(np.column_stack([xs,ys]).astype(np.int32))
            outer=np.zeros((1000,800),dtype=np.uint8)
            cv2.fillConvexPoly(outer,hull,255)
            visible=outer>0
            # The open U neckline belongs inside the wrap's outer contour;
            # keep its real clavicles filled, and retain neck above the wrap.
            visible[:int(ys.min())+3,300:500] = True
            raw_body[:,:,3] = np.where(visible,raw_body[:,:,3],0)
            body = Image.fromarray(raw_body,"RGBA")
        b, h, c = [np.asarray(layer.getchannel("A")) for layer in (body, head, clothing)]
        union = np.maximum(b, h)
        overlap = int(np.count_nonzero((b >= 128) & (h >= 128)))
        if overlap < self.contract["validation"]["minimumHeadBodyOverlapPixels"]:
            raise RuntimeError(f"Physical head/body intersection too small: {key}, overlap={overlap}")
        chin_y = head_record["chinTarget"][1]
        cap_y0,cap_y1=round(chin_y-25),round(chin_y-5)
        exposed_cap=int(np.count_nonzero((b[cap_y0:cap_y1,250:550]>=128)&(h[cap_y0:cap_y1,250:550]<128)))
        scale = self.contract["ageProfiles"][stage]["bodyScale"]
        half_width = max(8, round(18 * scale))
        y0, y1 = round(chin_y - 5), round(chin_y + 70 * scale)
        corridor = union[y0:y1, 400 - half_width:400 + half_width]
        coverage = float(np.mean(corridor >= 128))
        if coverage < self.contract["validation"]["minimumNeckCorridorCoverage"]:
            raise RuntimeError(f"Unfilled anatomical neck corridor: {key}, coverage={coverage}")
        outside = int(np.count_nonzero((c >= 128) & (b < 32))) if stage != "infant" else 0
        if outside:
            raise RuntimeError(f"Garment invents a second body outline: {key}, pixels={outside}")
        joined = self.background.convert("RGBA")
        for layer in (body, head, clothing, self.front_hair[(identity, stage)]):
            joined.alpha_composite(layer)
        if joined.getchannel("A").getextrema() != (255, 255):
            raise RuntimeError("Complete source must be opaque before PixelOE")
        assembled = joined.convert("RGB")
        source = ROOT / "portraits/assembled" / f"{pid(*key)}.png"
        self.save(assembled, source)
        seam = {"id": pid(*key), "identityId": identity, "sex": sex, "stage": stage, "wardrobeId": wardrobe,
                "bodyId": body_record["id"], "headBodyOverlapPixels": overlap, "neckCorridorCoverage": coverage,
                "upperCapPixelsNotCoveredByJawDiagnostic": exposed_cap,
                "garmentPixelsOutsideCanonicalBody": outside, "frontCollarAfterHead": True,
                "protectedBraidAfterCollar": True, "headAspectPreserved": True,
                "meaning": "Geometric acceptance only; 100% smooth neck/collar image review remains required."}
        self.join_qa.append(seam)
        record = {"id": pid(*key), "identityId": identity, "sex": sex, "stage": stage, "ageExample": self.contract["ageExamples"][stage], "wardrobeId": wardrobe, "bodyId": body_record["id"], "headId": head_record["id"], "garmentId": clothing_record["id"], "assembled": rel(source), "assembledSha256": sha(source), "opaque": True, "sourceCanvas": [800, 1000], "layerOrder": self.contract["layerOrder"], "joinQA": seam}
        self.composites[key] = (assembled, record)
        return self.composites[key]

    def manifest(self, proof=False):
        identities = [{"id": identity, "sex": "male" if identity.startswith("m") else "female", "avatarVariant": int(identity[1:]) - 1} for identity in IDENTITIES]
        bridges = [{"legacyPath": f'/assets/pixel/portraits/{origin}/{item["sex"]}/{stage}-{item["avatarVariant"]}.svg', "identityId": item["id"], "stage": stage, "portraitId": pid(item["id"], stage, engine.default_wardrobe(stage))} for origin in engine.LEGACY_ORIGINS for item in identities for stage in STAGES]
        return {"schemaVersion": 2, "libraryId": self.contract["libraryId"], "scope": "bounded-complete-body-proof" if proof else "complete-body-library", "runtimeIntegrated": False, "canvas": [800,1000], "canonicalBodyGeometryCount": 2, "canonicalBodies": [r for _,_,r in self.canonical_geometry.values()], "skinPaletteBodies": [r for _,r in self.bodies.values()], "ageBodyPlacements": [r for _,r in self.body_placements.values()], "identities": identities, "heads": [r for _,r in self.heads.values()], "garments": [r for _,r in self.garments.values()], "assemblies": [r for _,r in self.composites.values()], "portraits": self.portraits, "joins": self.join_qa, "legacySlotBridges": bridges if not proof else [], "originSelectors": self.mappings["origins"], "jobWardrobeBindings": self.mappings["jobs"], "encounterWardrobeBindings": self.mappings["encounters"], "sourceIntegrity": {"allProtectedInputsUnchanged": True, "inputCount": len(self.protected)}, "sourceDependencies": {"headSourcesAndPixelEngine": "../ordinary-v1", "mappings": self.contract["mappingPath"]}, "physicalBodyPresentInEveryAssembly": True, "smoothSeamReviewRequired": True}

    def pixel_render(self, identity, stage, wardrobe, width=128,height=160,scale=3):
        """Keep the agreed coarse3px body and select fine2px face cells."""
        before=len(self.portraits)
        coarse=engine.LibraryBuilder.pixel_render(self,identity,stage,wardrobe,128,160,3)
        fine=engine.LibraryBuilder.pixel_render(self,identity,stage,wardrobe,192,240,2)
        self.portraits=self.portraits[:before]
        with Image.open(ROOT/coarse["path"]) as opened:
            coarse_rgb=np.asarray(opened.convert("RGB")).copy()
        with Image.open(ROOT/fine["path"]) as opened:
            fine_rgb=np.asarray(opened.convert("RGB")).copy()
        head=self.heads[(identity,stage)][1]
        mixed,mask,config,selection_qa=self.regional.compose_registered(coarse_rgb,fine_rgb,head["eyeTarget"],head["chinTarget"])
        repeated,repeat_mask,_,_=self.regional.compose_registered(coarse_rgb,fine_rgb,head["eyeTarget"],head["chinTarget"])
        if not np.array_equal(mixed,repeated) or not np.array_equal(mask,repeat_mask):
            raise RuntimeError("Regional composition repeat differs")
        asset=pid(identity,stage,wardrobe)
        output=ROOT/"portraits/mixed-3px-body-2px-face"/f"{asset}.png"
        mask_path=ROOT/"qa/regional-masks"/f"{asset}.png"
        config_path=ROOT/"qa/regions"/f"{asset}.json"
        qa_path=ROOT/"qa/mixed"/f"{asset}.json"
        self.save(Image.fromarray(mixed,"RGB"),output)
        self.save(Image.fromarray(mask.astype(np.uint8)*255,"L"),mask_path)
        engine.write_json(config_path,config,self.args.overwrite)
        source=ROOT/coarse["assembled"]
        if sha(source)!=coarse["assembledSha256"] or sha(ROOT/coarse["path"])!=coarse["sha256"] or sha(ROOT/fine["path"])!=fine["sha256"]:
            raise RuntimeError("Regional source/base/fine file changed")
        qa=dict(selection_qa, id=asset,source=rel(source),sourceSha256=sha(source),
                coarsePath=coarse["path"],coarseSha256=coarse["sha256"],coarseQA=coarse["qa"],
                finePath=fine["path"],fineSha256=fine["sha256"],fineQA=fine["qa"],
                outputPath=rel(output),outputSha256=sha(output),maskPath=rel(mask_path),maskSha256=sha(mask_path),
                configPath=rel(config_path),configSha256=sha(config_path),
                deterministic=True,pngReadbackExact=True,sourceUnchanged=True,
                sourceBaseFineFilesUnchanged=True,uniformLogicalGrid=False,
                faceRegionFrom="This portrait's source head eye/chin registration; no reused card coordinates")
        engine.write_json(qa_path,qa,self.args.overwrite)
        record=dict(coarse,path=rel(output),sha256=sha(output),qa=rel(qa_path),
                    gridType="mixed-grid: coarse3px body / fine2px face, aligned6px common cells",
                    profile="mixed-3px-body-2px-face",logical=None,logicalSha256=None,logicalSize=None,
                    coarsePass=coarse,finePass=fine,regionalMask=rel(mask_path),regionalConfig=rel(config_path))
        self.portraits.append(record)
        print(json.dumps({"mixed":asset,"fineFacePixels":int(mask.sum()),"outsideFaceCoarseExact":True}),flush=True)
        return record

    def proof_sheets(self):
        cells = [(ROOT / record["assembled"], f'{record["identityId"]} {record["stage"]} {record["wardrobeId"]}') for _, record in self.composites.values()]
        self.grid_sheet(ROOT / "review/proof/complete-portraits.png", cells, 4, (220, 310), (216, 270))
        # These crops retain one source pixel per review pixel; never hide a neck seam in thumbnails.
        closeups = []
        for image, record in self.composites.values():
            target = self.heads[(record["identityId"], record["stage"])][1]["chinTarget"]
            top = max(0, round(target[1] - 80))
            path = ROOT / "review/proof/necks-100pct" / f'{record["id"]}.png'
            self.save(image.crop((200, top, 600, min(1000, top + 300))), path)
            closeups.append((path, f'{record["identityId"]} {record["stage"]} {record["wardrobeId"]}'))
        self.grid_sheet(ROOT / "review/proof/neck-seams-100pct.png", closeups, 3, (410, 340), (400, 300))
        if self.portraits:
            pixel_cells=[(ROOT/p["path"],f'{p["identityId"]} {p["stage"]} {p["wardrobeId"]} / mixed3-2') for p in self.portraits]
            self.grid_sheet(ROOT/"review/proof/mixed-pixel-comparison.png",pixel_cells,2,(400,520),(384,480))
            adults={p["identityId"]:p for p in self.portraits if p["stage"]=="adult" and p["wardrobeId"]=="everyday"}
            if len(adults)==6:
                cells=[(ROOT/adults[i]["path"],f'{i} / mixed3-2') for i in IDENTITIES]
                self.grid_sheet(ROOT/"review/proof/mixed-adult-six.png",cells,6,(160,224),(144,180))
                for width,height in ((64,80),(48,60),(40,50)):
                    self.grid_sheet(ROOT/f"review/proof/mixed-adult-{width}x{height}.png",cells,6,(120,height+40),(width,height))

    def run(self):
        if self.args.proof:
            cases = [(identity, "adult", "everyday") for identity in IDENTITIES]
            if self.args.review_all:
                cases=[(identity,stage,engine.default_wardrobe(stage)) for identity in IDENTITIES for stage in STAGES]
                cases += [(identity,"adult",wardrobe) for wardrobe in engine.ADULT_WARDROBES for identity in IDENTITIES]
            if self.args.proof_ages:
                cases += [(identity, stage, engine.default_wardrobe(stage)) for identity in ("m01", "f01") for stage in ("infant", "child", "youth")]
            for identity in ("m01", "f01"):
                sex = "male" if identity.startswith("m") else "female"
                path = ROOT / "source/wardrobe" / f"ef-w-{sex}-work-v2.png"
                if path.exists() and (Image.open(path).size == tuple(self.contract["bodies"][sex]["sourceCanvas"]) or (sex,"work") in self.wardrobe_anchors):
                    cases.append((identity, "adult", "work"))
        else:
            if len(self.anchors) != 36:
                raise ValueError("Full build requires all36 measured head anchors")
            cases = [(identity, stage, wardrobe) for identity in IDENTITIES for stage in STAGES for wardrobe in STAGE_WARDROBES[stage]]
        cases=list(dict.fromkeys(cases))
        for identity, stage, wardrobe in cases:
            self.assemble(identity, stage, wardrobe)
            if self.args.pixel or self.args.build:
                self.pixel_render(identity, stage, wardrobe, self.args.logical_width, self.args.logical_height, self.args.scale)
            else:
                print(json.dumps({"assembled": pid(identity, stage, wardrobe)}), flush=True)
        self.assert_sources_unchanged()
        self.proof_sheets()
        if self.args.build:
            if len(self.portraits) != 192:
                raise RuntimeError("Full192 output cardinality failed")
            self.review_sheets(proof=False)
        manifest = self.manifest(proof=self.args.proof)
        engine.write_json(ROOT / ("qa/proof-manifest.json" if self.args.proof else "manifest.json"), manifest, self.args.overwrite)
        engine.write_json(ROOT / "qa/body-neck-joins.json", self.join_qa, self.args.overwrite)
        print(json.dumps({"assemblies": len(self.composites), "pixels": len(self.portraits), "canonicalGeometries": len(self.canonical_geometry), "sourcesUnchanged": True}), flush=True)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--proof", action="store_true")
    mode.add_argument("--build", action="store_true")
    parser.add_argument("--proof-ages", action="store_true")
    parser.add_argument("--review-all",action="store_true",help="All36 age defaults and48 adult wardrobe assemblies for smooth anatomical review")
    parser.add_argument("--pixel", action="store_true", help="PixelOE bounded proofs only after complete smooth sources are inspected")
    parser.add_argument("--runtime", type=Path, default=REPO / "artifacts/pixeloe-runtime/site-packages")
    parser.add_argument("--logical-width", type=int, default=128)
    parser.add_argument("--logical-height", type=int, default=160)
    parser.add_argument("--scale", type=int, default=3)
    parser.add_argument("--thickness", type=int, default=0)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.logical_width * 5 != args.logical_height * 4 or min(args.logical_width,args.logical_height,args.scale,args.threads) <= 0 or args.thickness < 0:
        parser.error("Require positive4:5 pixelgrid/scale/threads and nonnegative thickness")
    if (args.logical_width,args.logical_height,args.scale,args.thickness)!=(128,160,3,0):
        parser.error("The agreed mixed-grid profile requires base128x160scale3thickness0; fine192x240scale2 is selected automatically")
    return args


if __name__ == "__main__":
    try:
        BodyLibrary(arguments()).run()
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print(f"v2 build-library.py: {error}", file=sys.stderr)
        raise SystemExit(1)
