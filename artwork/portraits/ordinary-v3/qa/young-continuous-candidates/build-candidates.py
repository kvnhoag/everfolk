"""Young skin-contour candidates only; never edits source or published masks."""
from pathlib import Path
import hashlib, json, sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT.parents[2] / 'artifacts/pixeloe-runtime/site-packages'))
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import cv2
cv2.setNumThreads(4)
OUT = Path(__file__).resolve().parent

# Native coordinates, traced against the six complete paintings. Face contours
# include temples and all skin; no broad feature exclusion islands are made.
FACES = {
('male','infant'): [(368,323),(369,278),(378,228),(399,192),(428,172),(452,160),(474,172),(492,151),(518,165),(540,150),(568,163),(594,150),(622,162),(648,165),(671,188),(689,223),(700,268),(711,316),(719,363),(710,418),(691,473),(661,509),(622,533),(575,547),(530,547),(481,533),(438,510),(411,482),(390,447),(377,400)],
('male','child'): [(407,303),(419,258),(430,218),(447,191),(470,178),(487,193),(505,173),(528,181),(549,152),(576,162),(599,149),(627,172),(653,192),(672,229),(684,274),(690,320),(688,369),(673,418),(648,449),(614,470),(574,480),(532,476),(490,461),(456,443),(434,416),(417,382),(408,343)],
('male','youth'): [(395,277),(405,237),(417,201),(438,174),(464,158),(491,166),(518,151),(541,148),(565,154),(587,145),(614,160),(638,177),(654,207),(665,247),(672,287),(675,336),(663,389),(641,439),(612,470),(575,489),(535,496),(492,485),(454,464),(429,436),(411,404),(401,364)],
('female','infant'): [(405,355),(415,310),(423,269),(434,232),(456,215),(484,207),(515,204),(548,187),(581,196),(613,194),(646,210),(671,234),(688,269),(701,313),(712,356),(718,402),(707,453),(688,499),(658,530),(618,550),(572,559),(526,552),(484,536),(452,513),(431,484),(418,450),(409,410)],
('female','child'): [(416,288),(423,250),(433,211),(449,184),(472,166),(498,154),(528,147),(556,139),(584,147),(611,146),(643,162),(667,191),(684,230),(697,271),(706,309),(708,357),(701,400),(681,448),(652,477),(613,495),(568,504),(522,494),(483,477),(454,452),(436,422),(425,389),(418,346)],
('female','youth'): [(419,278),(429,241),(440,208),(458,181),(484,164),(510,151),(536,139),(558,147),(582,135),(608,147),(634,165),(658,194),(677,235),(690,276),(699,318),(699,363),(688,408),(670,451),(643,481),(605,502),(563,510),(519,499),(481,480),(453,455),(436,424),(427,390),(421,344)],
}
EARS = {
('male','infant'): [(308,334,382,467),(703,318,754,445)],
('male','child'): [(358,285,421,393),(682,282,745,393)],
('male','youth'): [(350,270,409,379),(665,270,717,371)],
('female','infant'): [(362,353,427,476),(706,354,762,475)],
('female','child'): [(358,284,432,404),(699,268,752,389)],
('female','youth'): [(373,274,433,393),(694,270,749,385)],
}
ARMS = {
('male','child'): [[(177,1072),(193,1077),(216,1092),(245,1113),(273,1137),(294,1159),(290,1230),(272,1300),(245,1402),(175,1402),(164,1300),(159,1200),(164,1125)],[(804,1137),(837,1116),(875,1096),(914,1075),(920,1148),(925,1250),(932,1402),(832,1402),(815,1290),(801,1200)]],
('male','youth'): [[(97,968),(131,979),(170,991),(209,1003),(248,1016),(251,1100),(237,1190),(222,1280),(214,1390),(222,1467),(80,1467),(75,1330),(76,1230),(87,1130),(96,1030)],[(839,1003),(878,989),(922,974),(975,956),(982,1045),(991,1160),(1004,1320),(1010,1467),(878,1467),(858,1320),(846,1190)]],
('female','child'): [[(185,1160),(214,1174),(248,1187),(282,1203),(294,1220),(288,1310),(278,1402),(184,1402),(175,1300),(178,1220)],[(803,1195),(836,1175),(872,1155),(911,1137),(920,1220),(922,1402),(815,1402),(806,1300)]],
('female','youth'): [[(148,940),(180,954),(215,970),(250,985),(270,994),(282,1070),(277,1145),(261,1230),(241,1370),(232,1402),(126,1402),(120,1280),(124,1180),(132,1060),(145,990)],[(835,977),(873,957),(915,938),(958,918),(967,1010),(973,1110),(980,1230),(990,1402),(891,1402),(871,1290),(851,1170),(837,1080)]]
}

def polygon_mask(size, polygons):
    im=Image.new('L',size,0);draw=ImageDraw.Draw(im)
    for p in polygons:draw.polygon([tuple(x) for x in p],fill=255)
    return im

def main():
    data=json.loads((ROOT/'model-annotations.json').read_text())
    records=[]
    for m in data['models']:
        key=(m['sex'],m['stage'])
        if key not in FACES:continue
        raw=Image.open(ROOT/m['source']).convert('RGBA');arr=np.asarray(raw);rgb=arr[:,:,:3];alpha=arr[:,:,3]
        # Neck contour is independently reviewed annotation data. Its upper
        # overlap with the full face is continuous; it follows the inner collar.
        neck=[list(p) for p in m['skinPolygons'][1]]
        replacements={('male','child'):{(400,568):(380,549)},('female','child'):{(385,600):(373,591)},('male','youth'):{(359,566):(350,552),(360,596):(357,590)}}
        for p in neck:
            if tuple(p) in replacements.get(key,{}):p[:]=replacements[key][tuple(p)]
        if key==('female','youth'):
            for p in neck:
                if p[0]>700 and 560<=p[1]<=625:p[0]+=12
        arms=[[list(p) for p in poly] for poly in ARMS.get(key,[])]
        if m['stage']=='youth':
            right=arms[1]
            right[0][0]-=20
            inner_count=3 if m['sex']=='male' else 4
            for p in right[-inner_count:]:p[0]-=30
        extras=[]
        if key==('male','infant'):
            extras=[[(374,449),(415,470),(446,510),(417,560),(395,545),(375,514),(368,483)]]
        polys=[FACES[key],neck]+arms+extras
        hard=polygon_mask(raw.size,polys);draw=ImageDraw.Draw(hard)
        for box in EARS[key]:draw.ellipse(box,fill=255)
        hard_array=np.asarray(hard).copy();hard_array[alpha<128]=0
        blurred=np.asarray(Image.fromarray(hard_array).filter(ImageFilter.GaussianBlur(2))).copy()
        weight=np.minimum(blurred,hard_array).astype(np.float32)/255
        # Preserve only actual pupil/whites, with soft weights. The small ROI
        # never becomes a hole itself; surrounding skin retains full coverage.
        f=rgb.astype(np.float32)/255
        gray=cv2.cvtColor(f,cv2.COLOR_RGB2GRAY)
        hsv=cv2.cvtColor(f,cv2.COLOR_RGB2HSV)
        saf=np.zeros(weight.shape,np.float32)
        ex=m['skinExclusionPolygons']
        for p in ex[2:4]:
            xs=[q[0] for q in p];ys=[q[1] for q in p]
            x0,x1,y0,y1=min(xs)+4,max(xs)-4,min(ys)+5,max(ys)-6
            eye=np.zeros(weight.shape,np.float32)
            tinywhite=np.clip((gray[y0:y1,x0:x1]-.52)/.22,0,1)*np.clip((.43-hsv[y0:y1,x0:x1,1])/.21,0,1)
            tinypupil=np.clip((.20-gray[y0:y1,x0:x1])/.13,0,1)
            eye[y0:y1,x0:x1]=np.maximum(tinywhite,tinypupil)*.95
            eye=np.asarray(Image.fromarray(np.uint8(np.clip(eye*255,0,255))).filter(ImageFilter.GaussianBlur(1.4)),np.float32)/255
            saf=np.maximum(saf,eye)
        weight*=1-saf
        # Softly retain very dark painted hair/pupils where our continuous
        # skin contour touches a curl, brow or temple. No broad holes.
        head=polygon_mask(raw.size,[FACES[key]]+extras)
        hdr=ImageDraw.Draw(head)
        for box in EARS[key]:hdr.ellipse(box,fill=255)
        head_weight=np.asarray(head,np.float32)/255
        darkprotect=np.clip((.27-gray)/.12,0,1)
        darkprotect=np.asarray(Image.fromarray(np.uint8(np.clip(darkprotect*255,0,255))).filter(ImageFilter.GaussianBlur(1.5)),np.float32)/255
        weight*=1-darkprotect*head_weight
        mask=Image.fromarray(np.uint8(np.round(weight*255)),'L')
        mask_path=OUT/f'skin-{m["sex"]}-{m["stage"]}-v3.png';mask.save(mask_path)
        overlay=arr.copy();w=weight[:,:,None]*.45;overlay[:,:,:3]=np.round(rgb*(1-w)+np.array([30,210,100])*w).astype(np.uint8)
        flat=Image.new('RGBA',raw.size,(230,224,207,255));flat.alpha_composite(Image.fromarray(overlay));flat.thumbnail((560,700));flat.convert('RGB').save(OUT/f'overlay-{m["sex"]}-{m["stage"]}.png')
        lab=cv2.cvtColor(f,cv2.COLOR_RGB2LAB);x0,y0,x1,y1=m['skinSampleBox'];source_lab=np.median(lab[y0:y1,x0:x1].reshape(-1,3),axis=0)
        target=next(t for t in data['skinTargets'] if t['identityId']==('m03' if m['sex']=='male' else 'f03') and t['stage']==m['stage'])
        trgb=np.asarray(Image.open(ROOT/target['source']).convert('RGB'),np.float32)/255;tlab=cv2.cvtColor(trgb,cv2.COLOR_RGB2LAB);x0,y0,x1,y1=target['skinSampleBox'];target_lab=np.median(tlab[y0:y1,x0:x1].reshape(-1,3),axis=0)
        shift=cv2.cvtColor(lab+(target_lab-source_lab)[None,None,:],cv2.COLOR_LAB2RGB)
        graded=np.uint8(np.clip(np.round((f*(1-weight[:,:,None])+shift*weight[:,:,None])*255),0,255));result=Image.fromarray(np.dstack([graded,alpha]),'RGBA')
        flat=Image.new('RGBA',raw.size,(53,72,62,255));flat.alpha_composite(result);flat.thumbnail((560,700));flat.convert('RGB').save(OUT/f'deep-palette-{m["sex"]}-{m["stage"]}.png')
        digest=hashlib.sha256((ROOT/m['source']).read_bytes()).hexdigest()
        records.append({'sex':m['sex'],'stage':m['stage'],'source':m['source'],'sourceUnchanged':digest==m['sourceSha256'],'mask':str(mask_path.relative_to(ROOT)).replace('\\','/'),'faceContour':FACES[key],'ears':EARS[key],'neckContour':neck,'armContours':arms,'feather':'2px inward','featureProtection':'Tiny actual pupil/white soft weights and verydark hair/pupil weights withinhead; no broad eye/brow/lip holes.'})
    (OUT/'candidate-contours.json').write_text(json.dumps({'status':'candidate-unpublished-requires-review','models':records},indent=2)+'\n')
    print(json.dumps({'candidateMasks':len(records),'allSourcesUnchanged':all(r['sourceUnchanged'] for r in records)}))

if __name__=='__main__':main()
