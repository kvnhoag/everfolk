"""Bounded semantic skin-mask refinement; raw complete models are never edited."""
from pathlib import Path
import argparse, json, hashlib, sys
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / 'artifacts/pixeloe-runtime/site-packages'))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
cv2.setNumThreads(4)

def polys(size, items):
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    for p in items:
        draw.polygon([tuple(q) for q in p], fill=255)
    return np.asarray(mask).copy()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--sex',required=True);ap.add_argument('--stage',default='adult');a=ap.parse_args()
    doc=json.loads((ROOT/'model-annotations.json').read_text()); m=next(x for x in doc['models'] if x['sex']==a.sex and x['stage']==a.stage)
    raw=Image.open(ROOT/m['source']).convert('RGBA'); data=np.asarray(raw); rgb=data[:,:,:3]; alpha=data[:,:,3]
    base=polys(raw.size,m['skinPolygons']); ex=polys(raw.size,m['skinExclusionPolygons']);base[ex>0]=0;base[alpha<128]=0
    sure=cv2.erode(base,np.ones((23,23),np.uint8));allowed=cv2.dilate(base,np.ones((101,101),np.uint8));allowed[alpha<128]=0
    labels=np.full(base.shape,cv2.GC_BGD,np.uint8);labels[allowed>0]=cv2.GC_PR_BGD;labels[base>0]=cv2.GC_PR_FGD;labels[sure>0]=cv2.GC_FGD
    f=rgb.astype(np.float32)/255; hsv=cv2.cvtColor(f,cv2.COLOR_RGB2HSV);light=cv2.cvtColor(f,cv2.COLOR_RGB2GRAY)*255
    exclusion_core=cv2.erode(ex,np.ones((5,5),np.uint8))>0
    hair_or_eyes=(light<64)|((light>108)&(hsv[:,:,1]<.32))
    labels[exclusion_core & hair_or_eyes]=cv2.GC_BGD
    # Lip pigment is not skin; exclude only a tight manually labelled lip ROI.
    if a.sex=='female':
        lip=polys(raw.size,[m['skinExclusionPolygons'][4]])
    else:
        eye=np.asarray(m['eyeMidpoint'],float);chin=np.asarray(m['chin'],float);distance=chin[1]-eye[1]
        cy=round(eye[1]+distance*.52);cx=round(eye[0]);wx=round(distance*.23);hy=round(distance*.065)
        lip=polys(raw.size,[[[cx-wx,cy-hy],[cx+wx,cy-hy],[cx+wx,cy+hy],[cx-wx,cy+hy]]])
    labels[cv2.erode(lip,np.ones((5,5),np.uint8))>0]=cv2.GC_BGD
    bg=np.zeros((1,65),np.float64);fg=np.zeros((1,65),np.float64)
    cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),labels,None,bg,fg,5,cv2.GC_INIT_WITH_MASK)
    hard=np.where((labels==cv2.GC_FGD)|(labels==cv2.GC_PR_FGD),255,0).astype(np.uint8);hard[alpha<128]=0
    # Inward-only feather: no pixel outside selected semantic skin is tinted.
    feather=np.asarray(Image.fromarray(hard,'L').filter(ImageFilter.GaussianBlur(3))).copy();feather=np.minimum(feather,hard)
    out=ROOT/'qa/segmented-skin-candidates';out.mkdir(exist_ok=True)
    path=out/f'skin-{a.sex}-{a.stage}-v3.png';Image.fromarray(feather,'L').save(path)
    overlay=data.copy();w=feather[:,:,None]/255*.45;overlay[:,:,:3]=np.round(rgb*(1-w)+np.array([30,210,100])*w).astype(np.uint8)
    im=Image.new('RGBA',raw.size,(230,224,207,255));im.alpha_composite(Image.fromarray(overlay,'RGBA'));im.thumbnail((560,700));im.convert('RGB').save(out/f'overlay-{a.sex}-{a.stage}.png')
    source_lab=cv2.cvtColor(f,cv2.COLOR_RGB2LAB);sample=source_lab[m['skinSampleBox'][1]:m['skinSampleBox'][3],m['skinSampleBox'][0]:m['skinSampleBox'][2]];base_lab=np.median(sample.reshape(-1,3),axis=0)
    target=next(t for t in doc['skinTargets'] if t['identityId']==('m03' if a.sex=='male' else 'f03') and t['stage']==a.stage);targetim=np.asarray(Image.open(ROOT/target['source']).convert('RGB'),np.float32)/255;tlab=cv2.cvtColor(targetim,cv2.COLOR_RGB2LAB);x0,y0,x1,y1=target['skinSampleBox'];target_lab=np.median(tlab[y0:y1,x0:x1].reshape(-1,3),axis=0)
    shifted=cv2.cvtColor(source_lab+(target_lab-base_lab)[None,None,:],cv2.COLOR_LAB2RGB);weight=feather[:,:,None]/255;paint=np.clip(np.round((f*(1-weight)+shifted*weight)*255),0,255).astype(np.uint8);result=Image.fromarray(np.dstack([paint,alpha]),'RGBA');flat=Image.new('RGBA',raw.size,(53,72,62,255));flat.alpha_composite(result);flat.thumbnail((560,700));flat.convert('RGB').save(out/f'deep-palette-{a.sex}-{a.stage}.png')
    print(json.dumps({'mask':str(path),'semanticPixels':int((hard>0).sum()),'sourceUnchanged':hashlib.sha256((ROOT/m['source']).read_bytes()).hexdigest()==m['sourceSha256']}))

if __name__=='__main__':main()
