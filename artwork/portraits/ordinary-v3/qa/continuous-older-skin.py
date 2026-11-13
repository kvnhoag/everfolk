"""Four middle/elder continuous masks, preserving grey hair without skin islands."""
from pathlib import Path
import json,sys,importlib.util
sys.path.insert(0,str(Path(__file__).resolve().parents[4]/'artifacts/pixeloe-runtime/site-packages'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('adult_contours',ROOT/'qa/continuous-adult-skin.py');adult=importlib.util.module_from_spec(spec);spec.loader.exec_module(adult)
cv2.setNumThreads(4)

def main():
 doc=json.loads((ROOT/'model-annotations.json').read_text());out=ROOT/'qa/continuous-older-candidates';out.mkdir(exist_ok=True)
 for sex in ['male','female']:
  baseline=next(m for m in doc['models'] if m['sex']==sex and m['stage']=='adult')
  for stage in ['middle','elder']:
   m=next(m for m in doc['models'] if m['sex']==sex and m['stage']==stage);raw=Image.open(ROOT/m['source']).convert('RGBA');data=np.asarray(raw);rgb=data[:,:,:3];f=rgb.astype(np.float32)/255;lab=cv2.cvtColor(f,cv2.COLOR_RGB2LAB);hsv=cv2.cvtColor(f,cv2.COLOR_RGB2HSV)
   sx=1 if stage=='middle' else (1.06 if sex=='male' else 1.03);sy=(m['chin'][1]-m['eyeMidpoint'][1])/(baseline['chin'][1]-baseline['eyeMidpoint'][1])
   face=[[round(m['eyeMidpoint'][0]+(x-baseline['eyeMidpoint'][0])*sx),round(m['eyeMidpoint'][1]+(y-baseline['eyeMidpoint'][1])*sy)] for x,y in adult.CONTOURS[sex][0]]
   if stage=='middle':neck,arms=adult.CONTOURS[sex][1],adult.CONTOURS[sex][2:]
   elif sex=='male':
    neck=[[410,470],[660,470],[665,520],[700,560],[752,586],[733,632],[694,669],[622,699],[535,706],[450,689],[382,657],[342,613],[335,585],[378,550],[406,514]]
    arms=[[[0,1010],[25,1010],[208,1072],[229,1160],[222,1250],[196,1467],[0,1467]],[[859,1070],[1030,1020],[1072,1020],[1072,1467],[882,1467],[860,1260]]]
   else:
    neck=[[430,480],[640,480],[644,531],[679,578],[720,615],[713,663],[680,710],[613,754],[535,773],[462,757],[400,729],[362,684],[342,634],[382,594],[423,547]]
    arms=[[[0,986],[80,986],[231,1048],[247,1175],[218,1290],[199,1467],[0,1467]],[[808,1045],[977,986],[1072,986],[1072,1467],[859,1467],[826,1290]]]
   contours=[face,neck,*arms];hard=adult.draw_polys(raw.size,contours);hard[data[:,:,3]<128]=0;face_roi=adult.draw_polys(raw.size,[face])>0
   # Soft pixel-colour safeguards, not spatial eye/brow/beard panels.
   guard=adult.soft_skin_guard(raw,m,face)
   feather=np.asarray(Image.fromarray(hard,'L').filter(ImageFilter.GaussianBlur(2)),dtype=np.float32);feather=np.minimum(feather,hard);mask=np.clip(np.round(feather*(1-guard*.98)),0,255).astype(np.uint8);Image.fromarray(mask,'L').save(out/f'skin-{sex}-{stage}-v3.png')
   target=next(t for t in doc['skinTargets'] if t['identityId']==('m03' if sex=='male' else 'f03') and t['stage']==stage);ti=np.asarray(Image.open(ROOT/target['source']).convert('RGB'),np.float32)/255;tlab=cv2.cvtColor(ti,cv2.COLOR_RGB2LAB);x0,y0,x1,y1=target['skinSampleBox'];target_lab=np.median(tlab[y0:y1,x0:x1].reshape(-1,3),axis=0);x0,y0,x1,y1=m['skinSampleBox'];source_lab=np.median(lab[y0:y1,x0:x1].reshape(-1,3),axis=0);shift=cv2.cvtColor(lab+(target_lab-source_lab)[None,None,:],cv2.COLOR_LAB2RGB);w=mask[:,:,None]/255;paint=np.clip(np.round((f*(1-w)+shift*w)*255),0,255).astype(np.uint8);result=Image.fromarray(np.dstack([paint,data[:,:,3]]),'RGBA');flat=Image.new('RGBA',raw.size,(53,72,62,255));flat.alpha_composite(result);flat.thumbnail((560,700));flat.convert('RGB').save(out/f'deep-palette-{sex}-{stage}.png')
   overlay=data.copy();ow=mask[:,:,None]/255*.45;overlay[:,:,:3]=np.round(rgb*(1-ow)+np.array([30,210,100])*ow).astype(np.uint8);flat=Image.new('RGBA',raw.size,(230,224,207,255));flat.alpha_composite(Image.fromarray(overlay,'RGBA'));flat.thumbnail((560,700));flat.convert('RGB').save(out/f'overlay-{sex}-{stage}.png')
   (out/f'contours-{sex}-{stage}.json').write_text(json.dumps({'sex':sex,'stage':stage,'contours':contours,'guard':'soft very-dark/low-chroma pale hair and tiny eye highlights inside face; no broad excluded islands','inwardFeather':2},indent=2))
 print('Four older continuous masks and deep-palette previews written.')

if __name__=='__main__':main()
