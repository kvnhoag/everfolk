from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'review'
DATA = json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8-sig'))
FONT_ROOT = Path('C:/Windows/Fonts')
def font(size, bold=False):
    return ImageFont.truetype(str(FONT_ROOT / ('segoeuib.ttf' if bold else 'segoeui.ttf')), size)
TITLE = font(32, True)
LABEL = font(19, True)
BODY = font(15)
BG = (242,239,232)
INK = (35,45,40)
MUTED = (95,110,99)

def fit(img, box, pixel=False):
    x,y,w,h=box
    img=img.convert('RGB')
    ratio=min(w/img.width,h/img.height)
    out=img.resize((round(img.width*ratio),round(img.height*ratio)),Image.Resampling.NEAREST if pixel else Image.Resampling.LANCZOS)
    return out,(x+(w-out.width)//2,y+(h-out.height)//2)

def paste_fit(sheet,p,box,pixel=False):
    with Image.open(p) as img:
        out,xy=fit(img,box,pixel)
        sheet.paste(out,xy)

def wrap(draw,text,xy,width,font_obj,fill,max_lines=3):
    x,y=xy
    lines=[]
    line=''
    for word in text.split():
        test=(line+' '+word).strip()
        if line and draw.textlength(test,font=font_obj)>width:
            lines.append(line);line=word
        else:line=test
    if line:lines.append(line)
    for i,s in enumerate(lines[:max_lines]):draw.text((x,y+i*(font_obj.size+5)),s,font=font_obj,fill=fill)

def contact(assets,name,title,columns=4):
    cell_w,cell_h=286,416
    margin,top=28,110
    rows=math.ceil(len(assets)/columns)
    sheet=Image.new('RGB',(margin*2+columns*cell_w,top+rows*cell_h+60),BG)
    draw=ImageDraw.Draw(sheet)
    draw.text((margin,20),title,font=TITLE,fill=INK)
    draw.text((margin,68),'Pixel finish / review thumbnails, nearest-neighbour resize / full files 840 x 1050',font=BODY,fill=MUTED)
    for i,a in enumerate(assets):
        x=margin+(i%columns)*cell_w;y=top+(i//columns)*cell_h
        paste_fit(sheet,ROOT/a['final'],(x,y,264,330),True)
        draw.text((x,y+340),a['figureName'],font=LABEL,fill=INK)
        wrap(draw,a['title'] if a['kind']!='parent' else 'Main figure card',(x,y+367),264,BODY,MUTED,2)
    sheet.save(REVIEW/name)
    sheet.close()

complete=[a for a in DATA['assets'] if a['status']=='complete']
parents=[a for a in complete if a['kind']=='parent']
if parents:contact(parents,'parent-overview.png','EVERFOLK / FIGURE ART',5)
for i in range(0,len(complete),16):
    contact(complete[i:i+16],f'collection-sheet-{i//16+1:02d}.png',f'EVERFOLK / COLLECTION {i//16+1}',4)

alex=next((a for a in complete if a['slug']=='alexander-parent'),None)
if alex:
    sheet=Image.new('RGB',(1600,1100),BG)
    draw=ImageDraw.Draw(sheet)
    draw.text((30,20),'ALEXANDER / CHARACTER ARMOUR AND PIXEL FINISH',font=TITLE,fill=INK)
    draw.text((30,88),'PAINTING',font=LABEL,fill=INK)
    draw.text((590,88),'USER CHARACTER REFERENCE',font=LABEL,fill=INK)
    draw.text((1040,88),'PIXEL FINISH',font=LABEL,fill=INK)
    paste_fit(sheet,ROOT/alex['source'],(30,128,530,662),False)
    paste_fit(sheet,ROOT/'references/user-alexander-character-armour.png',(590,128,380,662),False)
    paste_fit(sheet,ROOT/alex['final'],(1040,128,530,662),True)
    wrap(draw,'Main outfit follows the supplied character render: pale red-edged cuirass, Gorgon chest device, purple sash, silver scales, burgundy skirt and asymmetric forearm protection.',(30,816),530,BODY,MUTED,5)
    wrap(draw,'Original user-supplied reference shown unchanged, proportionally resized. Helmet omitted to retain the mounted anchor face/hair. No armour from another named ruler is used.',(590,816),380,BODY,MUTED,6)
    wrap(draw,'Approved PixelOE 3px body / 2px face finish. Blade length, hand grip and composition retained. Full filtered PNG: 840 x 1050; review thumbnails are resized.',(1040,816),530,BODY,MUTED,5)
    draw.text((30,1024),'Military subcards use the second supplied equipment sheet for simpler service gear.',font=LABEL,fill=INK)
    sheet.save(REVIEW/'alexander-equipment-proof.png')
    sheet.close()

print(json.dumps({'reviewedAssets':len(complete),'parentOverviewCount':len(parents),'collectionSheets':math.ceil(len(complete)/16)}))
