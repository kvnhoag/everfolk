from PIL import Image,ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[2]
jobs=[('male','child',(760,1000,1000,1240)),('female','child',(760,1090,1000,1320)),('male','youth',(800,900,1070,1160)),('female','youth',(800,890,1070,1140))]
out=Image.new('RGB',(1100,340),'#ded4bd');d=ImageDraw.Draw(out)
for ix,(sex,stage,box) in enumerate(jobs):
    im=Image.open(root/'source/models'/f'ef-model-{sex}-{stage}-v3.png').convert('RGB');crop=im.crop(box);dr=ImageDraw.Draw(crop)
    for xx in range((box[0]//50+1)*50,box[2],50):
        dr.line((xx-box[0],0,xx-box[0],crop.height),fill='#00eeaa',width=1);dr.text((xx-box[0]+1,0),str(xx),fill='white')
    for yy in range((box[1]//50+1)*50,box[3],50):
        dr.line((0,yy-box[1],crop.width,yy-box[1]),fill='#00eeaa',width=1);dr.text((0,yy-box[1]+1),str(yy),fill='white')
    out.paste(crop,(ix*275,30));d.text((ix*275,0),sex+' '+stage,fill='black')
out.save(Path(__file__).resolve().parent/'right-arm-grid.png')
