from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8-sig'))
REVIEW=ROOT/'review'
BG=(243,239,231); INK=(36,47,39); MUTED=(96,114,99)
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/'+('segoeuib.ttf' if bold else 'segoeui.ttf'),size)
TITLE=font(30,True); LABEL=font(19,True); BODY=font(15)
def wrap(draw,text,x,y,width,ft=BODY,color=MUTED,limit=3):
    lines=[];line=''
    for word in text.split():
        t=(line+' '+word).strip()
        if line and draw.textlength(t,font=ft)>width:lines.append(line);line=word
        else:line=t
    if line:lines.append(line)
    for i,s in enumerate(lines[:limit]):draw.text((x,y+i*(ft.size+5)),s,font=ft,fill=color)
def fit(sheet,p,box,pixel=False,crop=None):
    x,y,w,h=box
    with Image.open(p) as source:
        img=source.convert('RGB')
        if crop:img=img.crop(crop)
        r=min(w/img.width,h/img.height)
        new=img.resize((round(img.width*r),round(img.height*r)),Image.Resampling.NEAREST if pixel else Image.Resampling.LANCZOS)
        sheet.paste(new,(x+(w-new.width)//2,y+(h-new.height)//2))
def contact(items,name,title,columns=4):
    cw,ch=286,436;rows=math.ceil(len(items)/columns)
    out=Image.new('RGB',(56+cw*columns,110+ch*rows+30),BG);d=ImageDraw.Draw(out)
    d.text((28,18),title,font=TITLE,fill=INK)
    d.text((28,65),'Pixel finish / nearest-neighbour review thumbnails / full PNGs 840 x 1050',font=BODY,fill=MUTED)
    for i,a in enumerate(items):
        x=28+(i%columns)*cw;y=110+(i//columns)*ch
        fit(out,ROOT/a['final'],(x,y,264,330),True)
        wrap(d,a['title'],x,y+340,264,LABEL,INK,2)
        meta='Main figure' if a['kind']=='parent' else a['gender'].title()+' player / '+a['desiredViewAngle']
        d.text((x,y+392),meta,font=BODY,fill=MUTED)
    out.save(REVIEW/name);out.close()
ready=[a for a in DATA['assets'] if a['status']=='complete']
parents=[a for a in ready if a['kind']=='parent']
if parents:contact(parents,'parent-overview.png','EVERFOLK / MAIN FIGURES V12',5)
for start in range(0,len(ready),16):contact(ready[start:start+16],f'collection-sheet-{start//16+1:02d}.png',f'EVERFOLK / V12 COLLECTION {start//16+1}')
figures=list(dict.fromkeys(a['figureId'] for a in DATA['assets']))
proofs=0
for figure in figures:
    roles=[a for a in DATA['assets'] if a['figureId']==figure and a['kind']!='parent']
    if not roles or not any(a['status']=='complete' for a in roles):continue
    n=max(len([a for a in roles if a['gender']==g]) for g in ['male','female'])
    if n==1:
        out=Image.new('RGB',(1000,820),BG);d=ImageDraw.Draw(out)
        d.text((30,18),roles[0]['figureName'].upper()+' / BOTH GENDERS',font=TITLE,fill=INK)
        d.text((30,68),'Representative player contributors / distinct head views',font=BODY,fill=MUTED)
        for col,g in enumerate(['male','female']):
            a=next(a for a in roles if a['gender']==g);x=30+col*500
            d.text((x,112),g.upper()+' CONTRIBUTOR',font=LABEL,fill=INK)
            if a['status']=='complete':fit(out,ROOT/a['final'],(x,150,420,525),True)
            else:d.rectangle((x,150,x+420,675),fill=(221,228,214));d.text((x+20,340),'In revision',font=LABEL,fill=MUTED)
            wrap(d,a['title'],x,692,420,LABEL,INK,2)
            d.text((x,750),a['desiredViewAngle'],font=BODY,fill=MUTED)
        out.save(REVIEW/('gender-angle-'+figure+'.png'));out.close();proofs+=1
        continue
    width=60+n*440; height=1420
    out=Image.new('RGB',(width,height),BG);d=ImageDraw.Draw(out)
    d.text((30,18),roles[0]['figureName'].upper()+' / BOTH GENDERS & HEAD VIEWS',font=TITLE,fill=INK)
    d.text((30,68),'Representative player contributors / each stage keeps its authored task',font=BODY,fill=MUTED)
    for row,g in enumerate(['male','female']):
        y=105+row*650
        d.text((30,y),g.upper()+' CONTRIBUTOR',font=LABEL,fill=INK)
        for col,a in enumerate([a for a in roles if a['gender']==g]):
            x=30+col*440
            if a['status']=='complete':fit(out,ROOT/a['final'],(x,y+35,420,525),True)
            else:d.rectangle((x,y+35,x+420,y+560),fill=(221,228,214));d.text((x+20,y+220),'In revision',font=LABEL,fill=MUTED)
            wrap(d,a['title'],x,y+570,420,LABEL,INK,2)
            d.text((x,y+620),a['desiredViewAngle'],font=BODY,fill=MUTED)
    out.save(REVIEW/('gender-angle-'+figure+'.png'));out.close();proofs+=1
ptolemy=next((a for a in ready if a['slug']=='ptolemy-parent'),None)
if ptolemy:
    out=Image.new('RGB',(1300,1000),BG);d=ImageDraw.Draw(out)
    d.text((30,16),'PTOLEMY / ARM ROUTING CORRECTION',font=TITLE,fill=INK)
    d.text((30,72),'SUPERSEDED POSE',font=LABEL,fill=INK);d.text((670,72),'CORRECTED TWO-ARM POSE',font=LABEL,fill=INK)
    fit(out,ROOT/'references/ptolemy-anatomy-edit-target.png',(30,110,600,750),False)
    fit(out,ROOT/ptolemy['source'],(670,110,600,750),False)
    wrap(d,'Old routing makes the arms appear to originate from the same sleeve.',30,880,600)
    wrap(d,'Each arm now connects to its own shoulder. One hand rests on the documents; the other holds his own scroll.',670,880,600)
    out.save(REVIEW/'ptolemy-anatomy-comparison.png');out.close()
    # One compact review image for the two direct user corrections.
    out=Image.new('RGB',(1500,1060),BG);d=ImageDraw.Draw(out)
    d.text((30,18),'EVERFOLK / CORRECTED ANATOMY, BOTH GENDERS & VARIED VIEWS',font=TITLE,fill=INK)
    d.text((30,82),'PTOLEMY: CORRECTED ARM ROUTING',font=LABEL,fill=INK)
    fit(out,ROOT/ptolemy['final'],(30,122,430,538),True)
    wrap(d,'Each arm connects to its own shoulder. One hand rests on the records; the other holds his own scroll.',30,678,430,LABEL,INK,4)
    pair_note=('All 35 subcard roles have male and female artwork. Other progressions also vary front/profile/three-quarter views.' if DATA['pairedRoles']==35 else f"In progress: {DATA['pairedRoles']} of 35 roles have both filtered variants. Every final role will cover both genders.")
    wrap(d,pair_note,30,820,430,BODY,MUTED,5)
    for row,g in enumerate(['male','female']):
        y=82+row*475
        d.text((500,y),'ALEXANDER / '+g.upper()+' PLAYER CONTRIBUTOR',font=LABEL,fill=INK)
        for col,tier in enumerate(['uncommon','rare','epic']):
            a=next((a for a in ready if a['slug']==f'alexander-{tier}-{g}'),None)
            if a:
                x=500+col*326
                fit(out,ROOT/a['final'],(x,y+40,306,383),True)
                d.text((x,y+432),a['desiredViewAngle'],font=BODY,fill=MUTED)
    out.save(REVIEW/'revision-summary.png');out.close()
print(json.dumps({'ready':len(ready),'parentCount':len(parents),'roleProofs':proofs,'collectionSheets':math.ceil(len(ready)/16)}))
