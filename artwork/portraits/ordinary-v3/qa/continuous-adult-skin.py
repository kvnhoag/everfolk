"""Continuous anatomical skin contours; no raw artwork is changed."""
from pathlib import Path
import json,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[4]/'artifacts/pixeloe-runtime/site-packages'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parents[1]
cv2.setNumThreads(4)

CONTOURS={
'male':[
[[447,125],[464,111],[483,116],[500,126],[520,119],[540,121],[558,118],[578,121],[600,117],[620,125],[640,120],[657,130],[677,150],[690,181],[698,215],[700,250],[715,255],[731,271],[741,291],[738,318],[729,342],[714,358],[698,366],[691,405],[670,444],[639,474],[602,489],[563,495],[525,486],[485,464],[452,436],[434,399],[422,370],[401,363],[381,344],[372,323],[368,297],[376,275],[391,259],[410,254],[417,228],[424,190],[435,155]],
[[431,429],[688,429],[698,495],[730,525],[772,548],[756,589],[720,626],[679,646],[622,659],[565,663],[510,659],[460,648],[407,624],[371,588],[352,551],[391,526],[427,497]],
[[0,975],[57,975],[226,1024],[245,1080],[242,1150],[220,1240],[195,1402],[0,1402]],
[[878,1020],[1051,980],[1122,980],[1122,1402],[912,1402],[882,1230]]],
'female':[
[[447,148],[467,136],[492,138],[515,141],[540,136],[562,135],[583,140],[605,147],[626,156],[647,170],[663,189],[674,215],[682,250],[699,277],[723,282],[741,296],[749,318],[743,344],[729,367],[710,383],[694,394],[680,445],[652,478],[610,500],[562,510],[514,498],[477,477],[448,447],[432,410],[421,390],[401,380],[382,365],[369,344],[363,319],[369,296],[383,281],[407,274],[421,259],[425,225],[433,187]],
[[462,465],[654,465],[665,540],[705,574],[755,605],[741,651],[707,691],[642,721],[563,733],[488,720],[424,694],[385,657],[368,612],[407,578],[448,539]],
[[0,951],[133,951],[263,1010],[277,1130],[252,1220],[226,1402],[0,1402]],
[[840,1005],[972,957],[1122,957],[1122,1402],[889,1402],[851,1240]]]
}

def draw_polys(size,items):
    m=Image.new('L',size,0);d=ImageDraw.Draw(m)
    for p in items:d.polygon([tuple(q) for q in p],fill=255)
    return np.asarray(m).copy()

def soft_skin_guard(raw, model, face_contour):
    rgb=np.asarray(raw)[:,:,:3].astype(np.float32)/255
    lab=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB);hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    face=draw_polys(raw.size,[face_contour]);distance=cv2.distanceTransform(face,cv2.DIST_L2,5)
    yy=np.arange(raw.height)[:,None];hairline=(face>0)&(distance<38)&(yy<model['eyeMidpoint'][1]-28)
    hair_polys=model['skinExclusionPolygons'][:2]+(model['skinExclusionPolygons'][4:5] if model['sex']=='male' else [])
    hair_roi=(draw_polys(raw.size,hair_polys)>0)|hairline
    dark=np.clip((31-lab[:,:,0])/13,0,1)
    grey=np.clip((.28-hsv[:,:,1])/.15,0,1)*np.clip((lab[:,:,0]-38)/18,0,1)
    guard=np.maximum(dark,grey)*hair_roi
    eye_roi=draw_polys(raw.size,model['skinExclusionPolygons'][2:4])>0
    white=np.clip((lab[:,:,0]-43)/15,0,1)*np.clip((.48-hsv[:,:,1])/.18,0,1)
    pupil=np.clip((28-lab[:,:,0])/12,0,1)
    guard=np.maximum(guard,np.maximum(white,pupil)*eye_roi)
    return guard

def main():
 doc=json.loads((ROOT/'model-annotations.json').read_text());out=ROOT/'qa/continuous-skin-candidates';out.mkdir(exist_ok=True)
 for sex in ['male','female']:
  m=next(x for x in doc['models'] if x['sex']==sex and x['stage']=='adult');raw=Image.open(ROOT/m['source']).convert('RGBA');data=np.asarray(raw);rgb=data[:,:,:3];f=rgb.astype(np.float32)/255;lab=cv2.cvtColor(f,cv2.COLOR_RGB2LAB);hsv=cv2.cvtColor(f,cv2.COLOR_RGB2HSV)
  hard=draw_polys(raw.size,CONTOURS[sex]);hard[data[:,:,3]<128]=0
  soft_guard=soft_skin_guard(raw,m,CONTOURS[sex][0])
  feather=np.asarray(Image.fromarray(hard,'L').filter(ImageFilter.GaussianBlur(2)),dtype=np.float32);feather=np.minimum(feather,hard);mask=np.clip(np.round(feather*(1-soft_guard*.95)),0,255).astype(np.uint8)
  Image.fromarray(mask,'L').save(out/f'skin-{sex}-adult-v3.png')
  target=next(t for t in doc['skinTargets'] if t['identityId']==('m03' if sex=='male' else 'f03') and t['stage']=='adult');ti=np.asarray(Image.open(ROOT/target['source']).convert('RGB'),np.float32)/255;tlab=cv2.cvtColor(ti,cv2.COLOR_RGB2LAB);x0,y0,x1,y1=target['skinSampleBox'];target_lab=np.median(tlab[y0:y1,x0:x1].reshape(-1,3),axis=0);x0,y0,x1,y1=m['skinSampleBox'];source_lab=np.median(lab[y0:y1,x0:x1].reshape(-1,3),axis=0);shift=cv2.cvtColor(lab+(target_lab-source_lab)[None,None,:],cv2.COLOR_LAB2RGB);w=mask[:,:,None]/255;paint=np.clip(np.round((f*(1-w)+shift*w)*255),0,255).astype(np.uint8)
  result=Image.fromarray(np.dstack([paint,data[:,:,3]]),'RGBA');flat=Image.new('RGBA',raw.size,(53,72,62,255));flat.alpha_composite(result);flat.thumbnail((560,700));flat.convert('RGB').save(out/f'deep-palette-{sex}-adult.png')
  overlay=data.copy();ow=mask[:,:,None]/255*.45;overlay[:,:,:3]=np.round(rgb*(1-ow)+np.array([30,210,100])*ow).astype(np.uint8);flat=Image.new('RGBA',raw.size,(230,224,207,255));flat.alpha_composite(Image.fromarray(overlay,'RGBA'));flat.thumbnail((560,700));flat.convert('RGB').save(out/f'overlay-{sex}-adult.png')
 print('Two continuous adult masks and deep-palette previews written.')

if __name__=='__main__':main()
