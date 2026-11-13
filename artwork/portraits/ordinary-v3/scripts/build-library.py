#!/usr/bin/env python3
"""Complete-model V3 library. Never cuts/reconstructs a head, neck or body.

--proof builds inexpensive smooth36 lifetimes plus60 adult clothing views.
--proof --available works only on ready annotated source/face frames.
--proof --pixel makes a bounded mixed3/2 PixelOE preview.
--build explicitly creates the complete240 selected mixed-grid portraits.
--proof-roles-youth reuses the reviewed228 inputs for twelve smooth additions.
--extend verifies and retains all228 existing outputs, then renders only12.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT.parent / "ordinary-v1"
V2 = ROOT.parent / "ordinary-v2"
REPO = ROOT.parents[2]
engine_spec = importlib.util.spec_from_file_location("everfolk_pixel_engine_v1", V1 / "scripts/build-library.py")
engine = importlib.util.module_from_spec(engine_spec)
engine_spec.loader.exec_module(engine)
engine.ROOT = ROOT
IDENTITIES, STAGES = engine.IDENTITIES, engine.STAGES
ADULT_WARDROBES = tuple(engine.ADULT_WARDROBES) + ("aristocrat","royalty")
STAGE_WARDROBES = {stage:ADULT_WARDROBES if stage in ("adult","middle","elder") else tuple(engine.STAGE_WARDROBES[stage]) for stage in STAGES}
STAGE_WARDROBES["youth"] += ("aristocrat","royalty")
EXPECTED_PORTRAITS = sum(len(STAGE_WARDROBES[stage]) for stage in STAGES)*len(IDENTITIES)
REVIEWED_228 = "qa/review-inputs/manifest-228-reviewed.json"
REVIEWED_228_SHA256 = "f22fa774ebc06d78f83b98ca6aafb8432fd51302ef0500964d977e53d65a3e5f"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rel(path):
    return Path(os.path.relpath(path, ROOT)).as_posix()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def pid(identity, stage, wardrobe):
    return f"ef-p-{identity}-{stage}-{wardrobe}-v3"


def sex_of(identity):
    return "male" if identity.startswith("m") else "female"


class CompleteModelLibrary(engine.LibraryBuilder):
    def __init__(self, args):
        self.args = args
        sys.path.insert(0, str(args.runtime.resolve(strict=True)))
        global Image, ImageDraw, ImageFilter, ImageFont, np, cv2, torch
        from PIL import Image, ImageDraw, ImageFilter, ImageFont
        import numpy as np
        import cv2
        import torch
        from pixeloe.legacy.pixelize import pixelize
        from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale
        for name, value in {"Image":Image,"ImageDraw":ImageDraw,"ImageFont":ImageFont,"np":np,"cv2":cv2,"torch":torch}.items():
            setattr(engine,name,value)
        cv2.setNumThreads(args.threads)
        torch.set_num_threads(args.threads)
        self.pixelize, self.downscale = pixelize, contrast_based_downscale
        regional_path = V2 / "scripts/regional-finish.py"
        regional_spec = importlib.util.spec_from_file_location("everfolk_regional_finish_only", regional_path)
        self.regional = importlib.util.module_from_spec(regional_spec)
        regional_spec.loader.exec_module(self.regional)
        self.contract = read_json(ROOT / "contract.json")
        self.mappings = read_json(ROOT / self.contract["mappings"])
        annotation_file = ROOT / self.contract["annotations"]
        annotation_bytes = annotation_file.read_bytes()
        self.annotation_data = json.loads(annotation_bytes.decode("utf-8-sig"))
        if args.proof:
            # Other age annotations may be authored while an adult-only proof
            # runs. Keep the exact input snapshot actually used by this proof.
            annotation_guard = ROOT/"qa/input-snapshots"/f'model-annotations-{hashlib.sha256(annotation_bytes).hexdigest()[:16]}.json'
            engine.write_bytes(annotation_guard,annotation_bytes,args.overwrite)
        else:
            annotation_guard = annotation_file
        self.annotation_snapshot = rel(annotation_guard)
        self.annotations = {(m["sex"],m["stage"]):m for m in self.annotation_data["models"]}
        self.skin_targets = {(s["identityId"],s["stage"]):s for s in self.annotation_data["skinTargets"]}
        self.protected = {}
        for path in (ROOT/"contract.json",annotation_guard,ROOT/self.contract["mappings"],V1/"scripts/build-library.py",regional_path):
            self.protect(path)
        self.face_registrations = {}
        registration_path = ROOT / self.contract["faceRegistrationPath"]
        if registration_path.exists():
            self.protect(registration_path)
            self.face_registrations = {(r["identityId"],r["stage"]):r for r in read_json(registration_path).get("edits",[])}
        self.wardrobe_anchors = {}
        wardrobe_annotations = ROOT / self.contract["wardrobeSourceAnnotations"]
        if wardrobe_annotations.exists():
            self.protect(wardrobe_annotations)
            self.wardrobe_anchors = {(g["sex"],g["wardrobeId"]):g for g in read_json(wardrobe_annotations).get("garments",[])}
        new_wardrobe_annotations=ROOT/self.contract.get("additionalWardrobeSourceAnnotations","wardrobe-anchors.json")
        if new_wardrobe_annotations.exists():
            self.protect(new_wardrobe_annotations)
            self.wardrobe_anchors.update({(g["sex"],g["wardrobeId"]):g for g in read_json(new_wardrobe_annotations).get("garments",[])})
        role_path=ROOT/"role-wardrobe-bindings.json"
        self.role_bindings=read_json(role_path) if role_path.exists() else {"bindings":[]}
        self.role_bindings_path=role_path if role_path.exists() else None
        if self.role_bindings_path:
            self.protect(self.role_bindings_path)
        self.compatibility_path=ROOT/"content-compatibility.json"
        self.compatibility=read_json(self.compatibility_path) if self.compatibility_path.exists() else None
        if self.compatibility:
            self.protect(self.compatibility_path)
        self.models, self.feature_models, self.palettes, self.garments = {}, {}, {}, {}
        self.composites, self.portraits = {}, []
        self.preservation = []
        self.reuse_report=None
        self.reused_final_hashes={}
        self.versions = {"opencv":cv2.__version__,"numpy":np.__version__,"torch":torch.__version__}
        try:
            self.versions["pixeloe"] = importlib.metadata.version("pixeloe")
        except importlib.metadata.PackageNotFoundError:
            self.versions["pixeloe"] = "unavailable"

    def protect(self, path):
        path = Path(path).resolve(strict=True)
        actual=sha(path)
        if path in self.protected and self.protected[path]!=actual:
            raise RuntimeError(f"Previously protected input changed: {path}")
        self.protected[path] = actual
        return path

    def load_verified_baseline(self, retain_portraits):
        """Reuse only hash-verified source/components/passes; never rerender228."""
        baseline_path=ROOT/self.args.reuse_verified
        if sha(baseline_path)!=REVIEWED_228_SHA256:
            raise ValueError("Reuse requires the immutable independently reviewed228 manifest")
        self.protect(baseline_path)
        baseline=read_json(baseline_path)
        counts={k:len(baseline[k]) for k in ("completeModels","featureModels","skinPaletteModels","assemblies","portraits")}
        if counts!={"completeModels":12,"featureModels":36,"skinPaletteModels":36,"assemblies":228,"portraits":228}:
            raise ValueError(f"Reviewed baseline cardinalities differ: {counts}")
        expected={pid(i,s,w) for i in IDENTITIES for s in STAGES for w in STAGE_WARDROBES[s]}
        old_ids={p["id"] for p in baseline["portraits"]}
        additions={pid(i,"youth",w) for i in IDENTITIES for w in ("aristocrat","royalty")}
        if len(old_ids)!=228 or old_ids!=expected-additions:
            raise ValueError("Reviewed228 IDs are not exactly the retained subset of240")
        verified={}
        def verify_file(value,expected_hash):
            path=(ROOT/value).resolve(strict=True)
            if not expected_hash or len(expected_hash)!=64:
                raise ValueError(f"Missing SHA256 for retained file: {value}")
            if path in verified and verified[path]!=expected_hash:
                raise ValueError(f"Conflicting retained hash: {value}")
            if path not in verified:
                actual=sha(path)
                if actual!=expected_hash:
                    raise ValueError(f"Retained file hash mismatch: {value}")
                verified[path]=actual
                self.protected[path]=actual
        pairs=(("path","sha256"),("source","sourceSha256"),("skinMask","skinMaskSha256"),("featureMask","featureMaskSha256"),("generatedEdit","generatedEditSha256"),("skinReference","skinReferenceSha256"),("nativeOutfit","nativeOutfitSha256"),("assembled","assembledSha256"),("logical","logicalSha256"))
        def verify_records(value):
            if isinstance(value,dict):
                for field,hash_field in pairs:
                    if value.get(field) and value.get(hash_field):
                        verify_file(value[field],value[hash_field])
                for child in value.values():
                    verify_records(child)
            elif isinstance(value,list):
                for child in value:
                    verify_records(child)
        for field in counts.keys()|{"clothingSources"}:
            verify_records(baseline[field])
        for p in baseline["portraits"]:
            self.reused_final_hashes[p["id"]]=(p["path"],p["sha256"])
            for field in ("coarsePass","finePass"):
                record=p[field]
                qa_path=self.protect(ROOT/record["qa"])
                q=read_json(qa_path)
                for flag in ("deterministic","exactIntegerBlocks","pngReadbackExact","opaqueSource","sourceUnchanged"):
                    if q.get(flag) is not True:
                        raise ValueError(f"Retained PixelOE pass failed {flag}: {record['id']}")
                for key,hkey in (("source","sourceSha256"),("logicalPath","logicalSha256"),("outputPath","outputSha256")):
                    verify_file(q[key],q[hkey])
                if q["sourceSha256"]!=p["assembledSha256"] or q["outputSha256"]!=record["sha256"] or q["options"]["thickness"]!=0:
                    raise ValueError(f"Retained pass/source metadata mismatch: {record['id']}")
            mixed_qa=self.protect(ROOT/p["qa"])
            q=read_json(mixed_qa)
            for flag in ("deterministic","pngReadbackExact","sourceUnchanged","sourceBaseFineFilesUnchanged","wholeCommonCells","registeredExactIntegerBlocks"):
                if q.get(flag) is not True:
                    raise ValueError(f"Retained regional QA failed {flag}: {p['id']}")
            for key,hkey in (("source","sourceSha256"),("coarsePath","coarseSha256"),("finePath","fineSha256"),("outputPath","outputSha256"),("maskPath","maskSha256"),("configPath","configSha256")):
                verify_file(q[key],q[hkey])
            if q["outputSha256"]!=p["sha256"] or q["sourceSha256"]!=p["assembledSha256"]:
                raise ValueError(f"Retained mixed/source metadata mismatch: {p['id']}")
            # Recompose existing verified passes, without any PixelOE work.
            with Image.open(ROOT/p["coarsePass"]["path"]) as im:
                coarse=np.asarray(im.convert("RGB")).copy()
            with Image.open(ROOT/p["finePass"]["path"]) as im:
                fine=np.asarray(im.convert("RGB")).copy()
            recomposed,mask,_,_=self.regional.compose_registered(coarse,fine,p["eyeTarget"],p["chinTarget"])
            with Image.open(ROOT/p["path"]) as im:
                if im.mode!="RGB" or im.size!=(384,480) or not np.array_equal(recomposed,np.asarray(im)):
                    raise ValueError(f"Retained mixed PNG differs from registered passes: {p['id']}")
            with Image.open(ROOT/p["regionalMask"]) as im:
                if not np.array_equal(mask,np.asarray(im)>0):
                    raise ValueError(f"Retained region mask differs: {p['id']}")
        for r in baseline["completeModels"]:
            key=(r["sex"],r["stage"])
            ann=self.annotations[key]
            if ann["source"]!=r["source"] or ann["skinMaskPath"]!=r["skinMask"] or ann["sourceDimensions"]!=r["nativeSize"]:
                raise ValueError(f"Complete model annotations changed: {key}")
            self.models[key]=(None,None,ann,r)
        for r in baseline["featureModels"]:
            key=(r["identityId"],r["stage"])
            self.feature_models[key]=(None,None,self.annotations[(sex_of(key[0]),key[1])],r)
        for r in baseline["skinPaletteModels"]:
            key=(r["identityId"],r["stage"])
            self.palettes[key]=(None,None,self.annotations[(sex_of(key[0]),key[1])],r)
        if retain_portraits:
            for r in baseline["clothingSources"]:
                self.garments[(r["sex"],r["stage"],r["wardrobeId"])]=(None,r)
            self.composites={(r["identityId"],r["stage"],r["wardrobeId"]):(None,r) for r in baseline["assemblies"]}
            self.portraits=list(baseline["portraits"])
            self.preservation=list(baseline["preservation"])
        self.reuse_report={"baselineManifest":rel(baseline_path),"baselineManifestSha256":REVIEWED_228_SHA256,"retainedPortraitCount":228,"newPortraitCount":12,"verifiedImageInputAndPassFiles":len(verified),"retainedMixedRecompositionVerified":228,"originalModelsFeaturesPalettesReusedExactly":True,"oldFinalPngsUnchanged":True,"newCasesOnly":[{"identityId":i,"stage":"youth","wardrobeId":w} for i in IDENTITIES for w in ("aristocrat","royalty")]}
        print(json.dumps({"verifiedReuse":228,"imageInputAndPassFiles":len(verified),"renderNewOnly":12}),flush=True)

    def verify_retained_outputs(self):
        records=[]
        for asset,(path,expected) in self.reused_final_hashes.items():
            actual=sha(ROOT/path)
            if actual!=expected:
                raise RuntimeError(f"Old228 final PNG changed during extension: {asset}")
            records.append({"id":asset,"path":path,"beforeSha256":expected,"afterSha256":actual,"unchanged":True})
        if self.reuse_report is not None:
            self.reuse_report["retainedFinalPngs"]=records

    def rgba(self,path):
        path = self.protect(path)
        with Image.open(path) as opened:
            if opened.mode != "RGBA":
                raise ValueError(f"Native RGBA complete model/edit required: {path}")
            return opened.copy()

    def mask(self,path,size):
        path = self.protect(path)
        with Image.open(path) as opened:
            result = opened.convert("L")
        if result.size != size:
            raise ValueError(f"Mask is not in its model's native frame: {path}, expected{size}")
        return result

    def save(self,image,path):
        engine.save_png(image,path,self.args.overwrite)
        with Image.open(path) as opened:
            if not np.array_equal(np.asarray(opened),np.asarray(image)):
                raise RuntimeError(f"PNG readback differs: {path}")

    def model(self,sex,stage):
        key = (sex,stage)
        if key in self.models:
            return self.models[key]
        if key not in self.annotations:
            raise ValueError(f"Complete model annotation missing: {sex}/{stage}")
        ann = self.annotations[key]
        source = ROOT / ann["source"]
        image = self.rgba(source)
        if list(image.size) != ann["sourceDimensions"]:
            raise ValueError(f"Model canvas differs from reviewed annotations: {source}")
        if image.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Complete model needs original transparent silhouette: {source}")
        skin = self.mask(ROOT/ann["skinMaskPath"],image.size)
        record = {"id":f"ef-model-{sex}-{stage}-v3","sex":sex,"stage":stage,"source":rel(source),"sourceSha256":sha(source),"nativeSize":list(image.size),"skinMask":ann["skinMaskPath"],"skinMaskSha256":sha(ROOT/ann["skinMaskPath"]),"completePainting":True,"independentHeadOrNeckLayer":False}
        self.models[key] = (image,skin,ann,record)
        return self.models[key]

    def feature_model(self,identity,stage):
        key = (identity,stage)
        if key in self.feature_models:
            return self.feature_models[key]
        original,skin,ann,model_record = self.model(sex_of(identity),stage)
        source_pixels = np.asarray(original)
        feature_mask = Image.new("L",original.size,0)
        edit_path = None
        colour_match = {"applied":False,"pairedMedianLabOffset":[0,0,0],"thresholdDeltaE":2.0}
        foreground_trimmed=0
        if identity.endswith("01"):
            result = original.copy()
        else:
            edit_path = ROOT/"source/faces"/f"ef-face-{identity}-{stage}-v3.png"
            generated = self.rgba(edit_path)
            registration = self.face_registrations.get(key)
            if registration:
                source_points = np.float32(registration["sourcePoints"])
                target_points = np.float32(registration["targetPoints"])
                matrix = cv2.getAffineTransform(source_points,target_points)
                generated = Image.fromarray(cv2.warpAffine(np.asarray(generated),matrix,original.size,flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_CONSTANT,borderValue=0),"RGBA")
            elif generated.size != original.size:
                raise ValueError(f"Face edit canvas changed; internal-feature landmark registration required: {edit_path}, {generated.size} vs{original.size}")
            ImageDraw.Draw(feature_mask).ellipse(tuple(ann["faceFeatureBox"]),fill=255)
            feature_mask = feature_mask.filter(ImageFilter.GaussianBlur(ann.get("faceFeatherPixels",7)))
            mask_array = np.asarray(feature_mask).copy()
            mask_array[:ann.get("featureTopLimit",0)] = 0
            mask_array[ann["protectedNeckFromRow"]:] = 0
            mask_array[mask_array<3] = 0
            foreground=(source_pixels[:,:,3]>=128).astype(np.uint8)
            safe_foreground=cv2.erode(foreground,np.ones((7,7),np.uint8))>0
            core=mask_array>=128
            overrun=core & ~safe_foreground
            if int(overrun.sum())>max(32,int(core.sum()*.01)):
                raise ValueError(f"Feature oval substantially crosses original head silhouette; remeasure annotation: {identity}/{stage}")
            foreground_trimmed=int(np.count_nonzero((mask_array>0)&~safe_foreground))
            mask_array[~safe_foreground]=0
            feature_mask = Image.fromarray(mask_array,"L")
            # An edited complete frame may carry a lighter/darker donor skin
            # baseline. Remove a meaningful constant bias only inside skin;
            # retain the donor's painted relative lighting and every feature.
            native_skin=np.asarray(skin)
            valid=(native_skin>200)&(mask_array>200)
            if np.count_nonzero(valid)>32:
                original_rgb=np.asarray(original.convert("RGB"),dtype=np.float32)/255
                donor_rgb=np.asarray(generated.convert("RGB"),dtype=np.float32)/255
                original_lab=cv2.cvtColor(original_rgb,cv2.COLOR_RGB2LAB)
                donor_lab=cv2.cvtColor(donor_rgb,cv2.COLOR_RGB2LAB)
                offset=np.median((original_lab-donor_lab)[valid],axis=0)
                applied=float(np.linalg.norm(offset))>2.0
                colour_match={"applied":applied,"pairedMedianLabOffset":offset.tolist(),"thresholdDeltaE":2.0,"samplePixels":int(valid.sum()),"method":"constant paired-median skin Lab correction before internal-oval blend; no geometry change"}
                if applied:
                    corrected=cv2.cvtColor(donor_lab+offset[None,None,:],cv2.COLOR_LAB2RGB)
                    weight=native_skin.astype(np.float32)[:,:,None]/255
                    donor_pixels=np.asarray(generated).copy()
                    donor_pixels[:,:,:3]=np.clip(np.round((donor_rgb*(1-weight)+corrected*weight)*255),0,255).astype(np.uint8)
                    generated=Image.fromarray(donor_pixels,"RGBA")
            result = Image.composite(generated,original,feature_mask)
            result.putalpha(original.getchannel("A"))
        result_pixels = np.asarray(result)
        outside = np.asarray(feature_mask)==0
        protected_y = ann["protectedNeckFromRow"]
        if not np.array_equal(source_pixels[outside],result_pixels[outside]):
            raise RuntimeError("Feature blend changed pixels outside its internal ellipse")
        if not np.array_equal(source_pixels[protected_y:],result_pixels[protected_y:]):
            raise RuntimeError("Feature blend changed the original jaw/neck/body")
        if not np.array_equal(source_pixels[:,:,3],result_pixels[:,:,3]):
            raise RuntimeError("Feature blend changed original complete-model alpha")
        path = ROOT/"components/feature-models"/f"ef-features-{identity}-{stage}-v3.png"
        mask_path = ROOT/"components/feature-masks"/f"ef-features-{identity}-{stage}-v3.png"
        self.save(result,path)
        self.save(feature_mask,mask_path)
        record = {"identityId":identity,"stage":stage,"modelId":model_record["id"],"path":rel(path),"sha256":sha(path),"featureMask":rel(mask_path),"featureMaskSha256":sha(mask_path),"generatedEdit":rel(edit_path) if edit_path else None,"generatedEditSha256":sha(edit_path) if edit_path else None,"donorSkinColourMatch":colour_match,"featureMaskForegroundMarginNativePx":3,"featureMaskPixelsConfinedToOriginalForeground":foreground_trimmed,"originalAlphaExact":True,"outsideFeaturePixelsExact":True,"originalNeckBodyExactBeforePalette":True,"protectedFromNativeRow":protected_y,"headOrNeckCutApplied":False,"anatomicalWarpApplied":False}
        self.feature_models[key] = (result,skin,ann,record)
        return self.feature_models[key]

    def palette_model(self,identity,stage):
        key = (identity,stage)
        if key in self.palettes:
            if self.palettes[key][0] is None:
                _,_,ann,record=self.palettes[key]
                image=self.rgba(ROOT/record["path"])
                skin=self.mask(ROOT/record["skinMask"],image.size)
                self.palettes[key]=(image,skin,ann,record)
            return self.palettes[key]
        feature,skin,ann,feature_record = self.feature_model(identity,stage)
        if key not in self.skin_targets:
            raise ValueError(f"Skin target sample missing: {identity}/{stage}")
        target = self.skin_targets[key]
        reference_path = ROOT/target["source"]
        reference = self.rgba(reference_path)
        def median_lab(image,box):
            rgb = np.asarray(image.crop(tuple(box)).convert("RGB"),dtype=np.float32)/255
            return np.median(cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB).reshape(-1,3),axis=0)
        source_lab = median_lab(feature,ann["skinSampleBox"])
        target_lab = median_lab(reference,target["skinSampleBox"])
        delta = target_lab-source_lab
        rgb = np.asarray(feature.convert("RGB"),dtype=np.float32)/255
        lab = cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB)
        shifted = cv2.cvtColor(lab+delta[None,None,:],cv2.COLOR_LAB2RGB)
        weight = np.asarray(skin,dtype=np.float32)[:,:,None]/255
        colours = np.clip(np.round((rgb*(1-weight)+shifted*weight)*255),0,255).astype(np.uint8)
        original_pixels = np.asarray(feature)
        result = Image.fromarray(np.dstack([colours,original_pixels[:,:,3]]),"RGBA")
        outside = np.asarray(skin)==0
        if not np.array_equal(np.asarray(result)[outside],original_pixels[outside]):
            raise RuntimeError("Palette changed pixels outside reviewed skin mask")
        if not np.array_equal(np.asarray(result)[:,:,3],original_pixels[:,:,3]):
            raise RuntimeError("Palette changed original model silhouette")
        path = ROOT/"components/models"/f"ef-model-{identity}-{stage}-v3.png"
        self.save(result,path)
        record = {"id":path.stem,"identityId":identity,"sex":sex_of(identity),"stage":stage,"path":rel(path),"sha256":sha(path),"featureModel":feature_record,"skinReference":rel(reference_path),"skinReferenceSha256":sha(reference_path),"sourceSampleLab":source_lab.tolist(),"targetSampleLab":target_lab.tolist(),"labOffset":delta.tolist(),"skinMask":ann["skinMaskPath"],"paletteOnlyInsideSkinMask":True,"outsideSkinMaskExact":True,"originalAlphaExact":True,"originalAnatomicalGeometryUnchanged":True}
        self.palettes[key] = (result,skin,ann,record)
        return self.palettes[key]

    def garment(self,sex,stage,wardrobe,model_size,ann):
        key = (sex,stage,wardrobe)
        if key in self.garments:
            return self.garments[key]
        source_pattern = self.contract.get("wardrobeSourceOverrides",{}).get(wardrobe,self.contract["wardrobeSources"])
        source = ROOT/source_pattern.format(sex=sex,wardrobeId=wardrobe)
        image = self.rgba(source)
        adult_ann = self.annotations[(sex,"adult")]
        if stage in ("adult","middle","elder") and image.size==model_size and ann["garmentTargetPoints"]==adult_ann["garmentTargetPoints"]:
            matrix = np.float32([[1,0,0],[0,1,0]])
            fitted = image
            policy = "shared complete original canvas; no independent bounding-box fit"
        else:
            source_ann = self.wardrobe_anchors.get((sex,wardrobe))
            points = ("leftShoulder","rightShoulder","waistCenter")
            if source_ann and source_ann.get("suggestedClothingOnlyAffine"):
                matrix=np.asarray(source_ann["suggestedClothingOnlyAffine"],dtype=np.float64)
                if ann["garmentTargetPoints"]!=adult_ann["garmentTargetPoints"]:
                    adult_points=np.float32([adult_ann["garmentTargetPoints"][p] for p in points])
                    age_points=np.float32([ann["garmentTargetPoints"][p] for p in points])
                    age_matrix=cv2.getAffineTransform(adult_points,age_points)
                    matrix=(np.vstack([age_matrix,[0,0,1]])@np.vstack([matrix,[0,0,1]]))[:2]
                fitted=Image.fromarray(cv2.warpAffine(np.asarray(image),matrix,model_size,flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_CONSTANT,borderValue=0),"RGBA")
                policy="reviewed clothing-only collar/belt affine; optional complete-age garment tailoring, no model anatomy warp"
                record={"id":f"ef-w-{sex}-{stage}-{wardrobe}-v3","sex":sex,"stage":stage,"wardrobeId":wardrobe,"source":rel(source),"sourceSha256":sha(source),"matrix":matrix.tolist(),"registration":policy}
                self.garments[key]=(fitted,record)
                return self.garments[key]
            if source_ann:
                observations=source_ann.get("sourcePoints",source_ann)
                source_points = np.float32([observations[p] for p in points])
            elif list(image.size)==adult_ann["sourceDimensions"]:
                source_points = np.float32([adult_ann["garmentTargetPoints"][p] for p in points])
            else:
                raise ValueError(f"Clothing source landmark registration missing: {source}")
            target_points = np.float32([ann["garmentTargetPoints"][p] for p in points])
            matrix = cv2.getAffineTransform(source_points,target_points)
            fitted = Image.fromarray(cv2.warpAffine(np.asarray(image),matrix,model_size,flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_CONSTANT,borderValue=0),"RGBA")
            policy = "clothing-only shoulder/waist affine tailoring; model anatomy never warped"
        record = {"id":f"ef-w-{sex}-{stage}-{wardrobe}-v3","sex":sex,"stage":stage,"wardrobeId":wardrobe,"source":rel(source),"sourceSha256":sha(source),"matrix":matrix.tolist(),"registration":policy}
        self.garments[key] = (fitted,record)
        return self.garments[key]

    def assemble(self,identity,stage,wardrobe):
        key = (identity,stage,wardrobe)
        if key in self.composites:
            return self.composites[key]
        baseline,skin,ann,palette_record = self.palette_model(identity,stage)
        original_pixels = np.asarray(baseline)
        default = engine.default_wardrobe(stage)
        garment_record = None
        if wardrobe==default:
            native = baseline.copy()
        else:
            garment,garment_record = self.garment(sex_of(identity),stage,wardrobe,baseline.size,ann)
            pixels = np.asarray(garment).copy()
            # The whole original skin surface, including every reviewed neck
            # pixel, remains the original complete painting after its palette.
            protected_skin = np.asarray(skin)>0
            pixels[:,:,3][protected_skin] = 0
            pixels[:ann["protectedNeckFromRow"],:,3] = 0
            pixels[:,:,3] = np.minimum(pixels[:,:,3],original_pixels[:,:,3])
            fitted_layer = Image.fromarray(pixels,"RGBA")
            layer_path = ROOT/"components/wardrobe"/f'{garment_record["id"]}.png'
            self.save(fitted_layer,layer_path)
            native = baseline.copy()
            native.alpha_composite(fitted_layer)
            native.putalpha(baseline.getchannel("A"))
            if not np.array_equal(np.asarray(native)[protected_skin],original_pixels[protected_skin]):
                raise RuntimeError(f"Clothing altered original skin/neck pixels: {key}")
            if not np.array_equal(np.asarray(native)[:ann["protectedNeckFromRow"]],original_pixels[:ann["protectedNeckFromRow"]]):
                raise RuntimeError(f"Clothing altered original upper head/jaw: {key}")
            garment_record = dict(garment_record,path=rel(layer_path),sha256=sha(layer_path))
        if not np.array_equal(np.asarray(native)[:,:,3],original_pixels[:,:,3]):
            raise RuntimeError(f"Outfit changed original complete-model alpha: {key}")
        native_path = ROOT/"components/outfits"/f"{pid(*key)}.png"
        self.save(native,native_path)
        factor = min(800/native.width,1000/native.height)
        size = (round(native.width*factor),round(native.height*factor))
        position = ((800-size[0])//2,(1000-size[1])//2)
        resized = native.resize(size,Image.Resampling.LANCZOS)
        flat = Image.new("RGBA",(800,1000),self.contract["background"])
        flat.alpha_composite(resized,position)
        opaque = flat.convert("RGB")
        source = ROOT/"portraits/assembled"/f"{pid(*key)}.png"
        self.save(opaque,source)
        eye = [position[0]+ann["eyeMidpoint"][0]*factor,position[1]+ann["eyeMidpoint"][1]*factor]
        chin = [position[0]+ann["chin"][0]*factor,position[1]+ann["chin"][1]*factor]
        check = {"id":pid(*key),"identityId":identity,"stage":stage,"wardrobeId":wardrobe,"originalCompleteModelAlphaExact":True,"headOrNeckCutApplied":False,"anatomyWarpApplied":False,"allSkinPixelsProtectedFromClothes":True,"originalHeadJawProtectedFromClothes":True,"paletteOnlySkin":True,"normalization":"one complete-canvas uniform scale and letterbox"}
        self.preservation.append(check)
        record = {"id":pid(*key),"identityId":identity,"sex":sex_of(identity),"stage":stage,"wardrobeId":wardrobe,"ageExample":self.contract["ageExamples"][stage],"completeModelId":palette_record["id"],"nativeOutfit":rel(native_path),"nativeOutfitSha256":sha(native_path),"garment":garment_record,"assembled":rel(source),"assembledSha256":sha(source),"sourceCanvas":[800,1000],"opaque":True,"wholeModelUniformScale":factor,"wholeModelPlacedSize":list(size),"wholeModelPlacedAt":list(position),"eyeTarget":eye,"chinTarget":chin,"preservation":check}
        self.composites[key] = (opaque,record)
        return self.composites[key]

    def pixel_render(self,identity,stage,wardrobe):
        before = len(self.portraits)
        coarse = engine.LibraryBuilder.pixel_render(self,identity,stage,wardrobe,128,160,3)
        fine = engine.LibraryBuilder.pixel_render(self,identity,stage,wardrobe,192,240,2)
        self.portraits = self.portraits[:before]
        with Image.open(ROOT/coarse["path"]) as im:
            coarse_rgb = np.asarray(im.convert("RGB")).copy()
        with Image.open(ROOT/fine["path"]) as im:
            fine_rgb = np.asarray(im.convert("RGB")).copy()
        mixed,mask,config,selection = self.regional.compose_registered(coarse_rgb,fine_rgb,coarse["eyeTarget"],coarse["chinTarget"])
        repeated,repeat_mask,_,_ = self.regional.compose_registered(coarse_rgb,fine_rgb,coarse["eyeTarget"],coarse["chinTarget"])
        if not np.array_equal(mixed,repeated) or not np.array_equal(mask,repeat_mask):
            raise RuntimeError("Regional composition repeat differs")
        asset = pid(identity,stage,wardrobe)
        output = ROOT/"portraits/mixed-3px-body-2px-face"/f"{asset}.png"
        mask_path = ROOT/"qa/regional-masks"/f"{asset}.png"
        config_path = ROOT/"qa/regions"/f"{asset}.json"
        qa_path = ROOT/"qa/mixed"/f"{asset}.json"
        self.save(Image.fromarray(mixed,"RGB"),output)
        self.save(Image.fromarray(mask.astype(np.uint8)*255,"L"),mask_path)
        engine.write_json(config_path,config,self.args.overwrite)
        source = ROOT/coarse["assembled"]
        if sha(source)!=coarse["assembledSha256"] or sha(ROOT/coarse["path"])!=coarse["sha256"] or sha(ROOT/fine["path"])!=fine["sha256"]:
            raise RuntimeError("Regional source/base/fine files changed")
        qa = dict(selection,id=asset,source=rel(source),sourceSha256=sha(source),coarsePath=coarse["path"],coarseSha256=coarse["sha256"],coarseQA=coarse["qa"],finePath=fine["path"],fineSha256=fine["sha256"],fineQA=fine["qa"],outputPath=rel(output),outputSha256=sha(output),maskPath=rel(mask_path),maskSha256=sha(mask_path),configPath=rel(config_path),configSha256=sha(config_path),deterministic=True,pngReadbackExact=True,sourceUnchanged=True,sourceBaseFineFilesUnchanged=True,uniformLogicalGrid=False,faceRegionFrom="measured eye/chin on the complete original model after one uniform whole-canvas scale")
        engine.write_json(qa_path,qa,self.args.overwrite)
        record = dict(coarse,path=rel(output),sha256=sha(output),qa=rel(qa_path),gridType="mixed-grid: coarse3px body / fine2px face, aligned6px common cells",profile="mixed-3px-body-2px-face",logical=None,logicalSha256=None,logicalSize=None,coarsePass=coarse,finePass=fine,regionalMask=rel(mask_path),regionalConfig=rel(config_path))
        self.portraits.append(record)
        print(json.dumps({"mixed":asset,"outsideFaceCoarseExact":True}),flush=True)
        return record

    def ready(self,identity,stage):
        ann = self.annotations.get((sex_of(identity),stage))
        if not ann or not (ROOT/ann["source"]).exists():
            return False
        return identity.endswith("01") or (ROOT/"source/faces"/f"ef-face-{identity}-{stage}-v3.png").exists()

    def manifest(self,proof):
        identities = [{"id":i,"sex":sex_of(i),"avatarVariant":int(i[1:])-1} for i in IDENTITIES]
        bridges = [{"legacyPath":f'/assets/pixel/portraits/{origin}/{i["sex"]}/{stage}-{i["avatarVariant"]}.svg',"identityId":i["id"],"stage":stage,"portraitId":pid(i["id"],stage,engine.default_wardrobe(stage))} for origin in engine.LEGACY_ORIGINS for i in identities for stage in STAGES]
        result={"schemaVersion":3,"libraryId":self.contract["libraryId"],"scope":"bounded-smooth-proof" if proof else "complete240-complete-anatomy-library","expectedPortraitCount":EXPECTED_PORTRAITS,"adultWardrobeFamilies":list(ADULT_WARDROBES),"stageWardrobes":STAGE_WARDROBES,"roleWardrobeBindings":self.role_bindings.get("bindings",[]),"roleWardrobeBindingsSource":rel(self.role_bindings_path) if self.role_bindings_path else None,"roleWardrobeBindingsSha256":sha(self.role_bindings_path) if self.role_bindings_path else None,"userReviewStatus":"awaiting-user-review","anatomicalApproval":False,"runtimeIntegrated":False,"canvas":[800,1000],"anatomyAuthority":"twelve complete source paintings; no V2 anatomical reconstruction","modelAnnotationsUsed":self.annotation_snapshot,"completeModelCount":len(self.models),"completeModels":[r for _,_,_,r in self.models.values()],"identities":identities,"featureModels":[r for _,_,_,r in self.feature_models.values()],"skinPaletteModels":[r for _,_,_,r in self.palettes.values()],"clothingSources":[r for _,r in self.garments.values()],"assemblies":[r for _,r in self.composites.values()],"portraits":self.portraits,"preservation":self.preservation,"legacySlotBridges":bridges if not proof else [],"originSelectors":self.mappings["origins"],"jobWardrobeBindings":self.mappings["jobs"],"encounterWardrobeBindings":self.mappings["encounters"],"pixelProfile":self.contract["pixelProfile"],"sourceIntegrity":{"allProtectedInputsUnchanged":True,"inputCount":len(self.protected)},"dependencies":{"pixelEngineOnly":"../ordinary-v1/scripts/build-library.py","regionalSelectionOnly":"../ordinary-v2/scripts/regional-finish.py","V2AnatomicalAssemblyUsed":False},"limitations":["Exact native alpha preservation protects existing source anatomy; it does not certify newly generated source model anatomy without visual review.","Skin RGB intentionally changes only inside reviewed palette masks; neck geometry and original painted lighting planes are retained.","Clothing colours and shapes are authored game groupings, not certified occupational uniforms."]}
        if self.compatibility:
            result.update(contentCompatibility=self.compatibility,contentCompatibilitySource=rel(self.compatibility_path),contentCompatibilitySha256=sha(self.compatibility_path))
        if self.reuse_report:
            result["incrementalReuse"]=self.reuse_report
        return result

    def proof_sheets(self):
        cells = [(ROOT/r["assembled"],f'{r["identityId"]} {r["stage"]} {r["wardrobeId"]}') for _,r in self.composites.values()]
        self.grid_sheet(ROOT/"review/proof/complete-models.png",cells,6,(160,224),(144,180))
        lookup = {key:ROOT/r["assembled"] for key,(_,r) in self.composites.items()}
        lifetime_keys = [(i,s,engine.default_wardrobe(s)) for i in IDENTITIES for s in STAGES]
        if all(k in lookup for k in lifetime_keys):
            self.grid_sheet(ROOT/"review/proof/smooth-lifetimes-6x6.png",[(lookup[k],f"{k[0]} / {k[1]}") for k in lifetime_keys],6,(160,224),(144,180))
        adult_keys = [(i,"adult",w) for w in ADULT_WARDROBES for i in IDENTITIES]
        if all(k in lookup for k in adult_keys):
            self.grid_sheet(ROOT/"review/proof/smooth-adult-wardrobe-6x10.png",[(lookup[k],f"{k[0]} / {k[2]}") for k in adult_keys],6,(160,224),(144,180))
        for wardrobe in ("aristocrat","royalty"):
            keys=[(i,"youth",wardrobe) for i in IDENTITIES]
            if all(k in lookup for k in keys):
                self.grid_sheet(ROOT/f"review/proof/smooth-youth-{wardrobe}-6.png",[(lookup[k],f"{k[0]} / {k[2]}") for k in keys],6,(200,280),(192,240))
        if self.portraits:
            self.grid_sheet(ROOT/"review/proof/mixed-pixel-preview.png",[(ROOT/p["path"],f'{p["identityId"]} {p["stage"]} {p["wardrobeId"]}') for p in self.portraits],2,(400,520),(384,480))

    def run(self):
        complete=self.args.build or self.args.extend
        if self.args.extend or self.args.proof_roles_youth:
            self.load_verified_baseline(retain_portraits=self.args.extend)
            cases=[(i,"youth",w) for i in IDENTITIES for w in ("aristocrat","royalty")]
        elif self.args.build:
            missing = [(i,s) for i in IDENTITIES for s in STAGES if not self.ready(i,s)]
            if missing:
                raise ValueError(f"Missing complete model/annotation or generated face frame: {missing}")
            if len(self.annotations)!=12:
                raise ValueError("Full build requires twelve complete-model annotations")
            cases = [(i,s,w) for i in IDENTITIES for s in STAGES for w in STAGE_WARDROBES[s]]
        else:
            cases = [(i,s,engine.default_wardrobe(s)) for i in IDENTITIES for s in STAGES]
            if not self.args.models_only:
                cases += [(i,"adult",w) for w in ADULT_WARDROBES for i in IDENTITIES]
            cases = list(dict.fromkeys(cases))
            if self.args.proof_stage:
                cases = [k for k in cases if k[1]==self.args.proof_stage]
            if self.args.available:
                cases = [k for k in cases if self.ready(k[0],k[1])]
            missing = [(i,s) for i,s,_ in cases if not self.ready(i,s)]
            if missing:
                raise ValueError(f"Sources not ready; use --available only for a partial bounded proof: {missing}")
        if not cases:
            raise ValueError("No ready annotated complete models/feature frames")
        for identity,stage,wardrobe in cases:
            self.assemble(identity,stage,wardrobe)
            if complete or (self.args.pixel and (self.args.proof_roles_youth or wardrobe==engine.default_wardrobe(stage))):
                self.pixel_render(identity,stage,wardrobe)
            else:
                print(json.dumps({"assembled":pid(identity,stage,wardrobe)}),flush=True)
        self.assert_sources_unchanged()
        self.verify_retained_outputs()
        if complete:
            if len(self.portraits)!=EXPECTED_PORTRAITS or len(self.palettes)!=36 or len(self.models)!=12:
                raise RuntimeError("Full240/36palette/12model cardinality failed")
            expected={pid(i,s,w) for i in IDENTITIES for s in STAGES for w in STAGE_WARDROBES[s]}
            if {p["id"] for p in self.portraits}!=expected or len(self.composites)!=EXPECTED_PORTRAITS or len(self.feature_models)!=36:
                raise RuntimeError("Complete240 ID/assembly/feature coverage failed")
            self.review_sheets(proof=False)
        else:
            self.proof_sheets()
        destination = ROOT/("manifest.json" if complete else "qa/proof-youth-roles-manifest.json" if self.args.proof_roles_youth else "qa/proof-manifest.json")
        engine.write_json(destination,self.manifest(proof=not complete),self.args.overwrite)
        preservation_path="qa/proof-youth-roles-preservation.json" if self.args.proof_roles_youth else "qa/model-preservation.json"
        engine.write_json(ROOT/preservation_path,self.preservation,self.args.overwrite)
        if self.reuse_report:
            report_path="qa/incremental-reuse-240.json" if complete else "qa/proof-youth-reuse.json"
            engine.write_json(ROOT/report_path,self.reuse_report,self.args.overwrite)
        print(json.dumps({"manifest":rel(destination),"completeModels":len(self.models),"featurePalettes":len(self.palettes),"assemblies":len(self.composites),"selectedPixels":len(self.portraits),"originalSourceAnatomyPreserved":True,"sourcesUnchanged":True}),flush=True)

    def review_sheets(self,proof=False):
        lookup={(p["identityId"],p["stage"],p["wardrobeId"]):ROOT/p["path"] for p in self.portraits}
        lifetime=[(lookup[(i,s,engine.default_wardrobe(s))],f"{i} / {s}") for i in IDENTITIES for s in STAGES]
        self.grid_sheet(ROOT/"review/lifetimes-6x6.png",lifetime,6,(160,224),(144,180))
        outfits=[(lookup[(i,"adult",w)],f"{i} / {w}") for w in ADULT_WARDROBES for i in IDENTITIES]
        self.grid_sheet(ROOT/"review/adult-wardrobe-6x10.png",outfits,6,(160,224),(144,180))
        for width,height in ((64,80),(48,60),(40,50)):
            self.grid_sheet(ROOT/f"review/actual-size-{width}x{height}.png",lifetime,6,(120,height+40),(width,height))


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--proof",action="store_true")
    mode.add_argument("--build",action="store_true")
    mode.add_argument("--extend",action="store_true",help="Verify archived228 and render only12 new youth role portraits")
    parser.add_argument("--available",action="store_true")
    parser.add_argument("--models-only",action="store_true")
    parser.add_argument("--pixel",action="store_true",help="Pixel only age-default portraits in a bounded proof; professional outfits remain smooth for review")
    parser.add_argument("--proof-stage",choices=STAGES,help="Restrict a bounded palette/feature proof to one age")
    parser.add_argument("--proof-roles-youth",action="store_true",help="Only12 smooth new youth role cases, reusing verified reviewed palettes")
    parser.add_argument("--reuse-verified",type=Path,default=Path(REVIEWED_228),help="Immutable independently reviewed228 baseline manifest")
    parser.add_argument("--runtime",type=Path,default=REPO/"artifacts/pixeloe-runtime/site-packages")
    parser.add_argument("--threads",type=int,default=4)
    parser.add_argument("--overwrite",action="store_true")
    args = parser.parse_args()
    args.thickness = 0
    if args.threads<=0:
        parser.error("--threads must be positive")
    if (args.build or args.extend) and (args.available or args.models_only or args.proof_stage or args.proof_roles_youth):
        parser.error("--build cannot be partial or models-only")
    if args.proof_roles_youth and not args.proof:
        parser.error("--proof-roles-youth requires --proof")
    return args


if __name__=="__main__":
    try:
        CompleteModelLibrary(arguments()).run()
    except (ValueError,RuntimeError,OSError,KeyError) as error:
        print(f"V3 complete-model build-library.py: {error}",file=sys.stderr)
        raise SystemExit(1)
