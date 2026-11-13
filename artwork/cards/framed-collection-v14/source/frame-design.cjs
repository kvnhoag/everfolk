const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../../../../package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const PALETTE={
 common:{base:'#18201e',matte:'#101b18',edge:'#838b82',light:'#d3d4c7',ink:'#26332d',panel:'#e4dfd0',label:'COMMON',character:'plain iron, single rule, square corner joints'},
 uncommon:{base:'#102c28',matte:'#0a1d1c',edge:'#ae8e53',light:'#d9bc80',ink:'#23332b',panel:'#eee2c5',label:'UNCOMMON',character:'antique bronze, paired rules, leaf corners'},
 rare:{base:'#102837',matte:'#0b1b27',edge:'#86aebf',light:'#cfedf1',ink:'#203849',panel:'#e6e8dc',label:'RARE',character:'silver-blue, faceted gems, chamfer brackets'},
 epic:{base:'#251f32',matte:'#1a1523',edge:'#bc9763',light:'#efd29a',ink:'#372b40',panel:'#eee2ce',label:'EPIC',character:'amethyst and gold, interlaced corner knots, gem rails'},
 legendary:{base:'#14201e',matte:'#14201e',edge:'#d7ab57',light:'#ffe5a1',ink:'#21312a',panel:'#ede0c1',label:'LEGENDARY',character:'full art, gilded perimeter, radiant nameplate and figure emblem'}
};
function roundedPolygon(points,radius){const v=points.map((b,i)=>{const a=points[(i+points.length-1)%points.length],c=points[(i+1)%points.length],la=Math.hypot(a[0]-b[0],a[1]-b[1]),lc=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(radius,la/2,lc/2);return{p:[b[0]+(a[0]-b[0])*r/la,b[1]+(a[1]-b[1])*r/la],b,n:[b[0]+(c[0]-b[0])*r/lc,b[1]+(c[1]-b[1])*r/lc]};});const f=p=>p.map(n=>+n.toFixed(4)).join(' ');return'M'+f(v[0].p)+v.map((a,i)=>(i?'L'+f(a.p):'')+'Q'+f(a.b)+' '+f(a.n)).join('')+'Z';}
const aperture=roundedPolygon([[78,190],[822,190],[850,218],[850,902],[822,930],[78,930],[50,902],[50,218]],6);
const panel=roundedPolygon([[66,951],[834,951],[850,967],[850,1144],[834,1160],[66,1160],[50,1144],[50,967]],4);
const outer='M42 0H858Q900 0 900 42V1218Q900 1260 858 1260H42Q0 1260 0 1218V42Q0 0 42 0Z';
const rect=(x,y,w,h,r,fill,stroke='none',sw=1,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const p=(d,fill='none',stroke='none',sw=1,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const diamond=(x,y,r,fill,stroke='none',sw=1)=>p(`M${x} ${y-r}L${x+r} ${y}L${x} ${y+r}L${x-r} ${y}Z`,fill,stroke,sw);
const line=(x1,y1,x2,y2,color,width=1,extra='')=>p(`M${x1} ${y1}L${x2} ${y2}`,'none',color,width,extra);
const {emblem}=require('./emblems.cjs');
function corner(kind,c){
 const marks={
  common:p('M0 26V0H26M6 0V6H0','none',c.edge,2),
  uncommon:p('M2 32Q0 12 30 2','none',c.light,1.5)+p('M4 25Q-1 14 5 9Q12 18 4 25ZM10 15Q10 2 20 1Q23 11 10 15ZM17 20Q29 20 31 11Q20 10 17 20Z',c.light),
  rare:p('M0 31V9L9 0H31M7 27V12L12 7H27','none',c.edge,1.4)+diamond(12,12,5,c.light,c.edge,1)+p('M12 7V17M7 12H17','none',c.base,.7),
  epic:p('M0 31V8L8 0H31M5 27V13L13 5H27M0 21L21 0M7 29L29 7','none',c.edge,1.6)+diamond(16,16,10,'none',c.light,1.2)+diamond(16,16,4,'#b493cc',c.light,1),
  legendary:p('M0 35V8Q0 0 8 0H35M5 29V10Q5 5 10 5H29','none',c.light,1.5)+p('M5 23Q12 9 27 5M7 27L27 7','none',c.edge,1)+diamond(13,13,4,c.light)
 };
 const raw=marks[kind];return `<g id="Rarity_corner_ornaments" data-name="Rarity / ${c.character}"><g transform="translate(42 42)">${raw}</g><g transform="translate(858 42) scale(-1 1)">${raw}</g><g transform="translate(42 1218) scale(1 -1)">${raw}</g><g transform="translate(858 1218) scale(-1 -1)">${raw}</g></g>`;
}
async function width(value,size,font='Source Serif 4',tracking=0){const m=await sharp({text:{text:esc(value),font:`${font} ${size}`,rgba:true,dpi:72}}).metadata();return m.width+tracking*Math.max(0,value.length-1);}
async function fit(value,maxWidth,max=64,font='Source Serif 4',tracking=0){let s=max;while(s>21&&await width(value,s,font,tracking)>maxWidth)s--;return s;}
async function wrap(value,maxWidth,size,maxLines){const words=value.split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(line&&await width(next,size)>maxWidth){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);if(lines.length>maxLines)throw Error(`Copy does not fit (${lines.length} lines): ${value}`);return lines;}
function text(id,value,x,y,size,color,{anchor='start',font='Source Serif 4',tracking=0,weight=400}={}){return `<text id="${id}" data-name="${id.replaceAll('_',' ')}" x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${tracking?` letter-spacing="${tracking}"`:''}><tspan x="${x}" y="${y}">${esc(value)}</tspan></text>`;}
function paragraph(lines,x,y,size,lineHeight,color){return `<text id="Biography_live" data-name="Biography / editable paragraph" font-family="Source Serif 4" font-size="${size}" fill="${color}">${lines.map((v,i)=>`<tspan x="${x}" y="${y+i*lineHeight}">${esc(v)}</tspan>`).join('')}</text>`;}
function rankMarks(rank,c,x,y){const n={common:1,uncommon:2,rare:3,epic:4}[rank];return `<g id="Rank_marks" data-name="Rarity / ${n} rank marks">${Array.from({length:n},(_,i)=>diamond(x+(i-(n-1)/2)*14,y,3.2,c.light)).join('')}</g>`;}
async function build(row,copy){
 const c=PALETTE[row.rarity],leg=row.rarity==='legendary',parent=row.kind==='parent';
 const title=copy.displayTitle||copy.title;
 const titleSize=await fit(title,leg?650:parent?630:720,leg?68:64);
 const subtitleSize=await fit(copy.subtitle.toUpperCase(),leg?650:720,19,'Inter',1.75);
 const bodyTitleSize=await fit(copy.bodyTitle,leg?744:505,leg?33:29);
 const bioSize=24,lineHeight=leg?27:26;
 const lines=await wrap(copy.bodyText,leg?744:708,bioSize,leg?4:5);
 const foot=`${String(row.exampleCopyNumber||1).padStart(3,'0')}/${row.editionLimit===null?'∞':String(row.editionLimit).padStart(3,'0')}`;
 const defs=`<defs><clipPath id="Card_clip">${rect(0,0,900,1260,42,'white')}</clipPath><clipPath id="Art_clip">${p(aperture,'white')}</clipPath><linearGradient id="Legend_top" x1="0" y1="0" x2="0" y2="240" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#07110f" stop-opacity=".7"/><stop offset="1" stop-color="#07110f" stop-opacity="0"/></linearGradient><linearGradient id="Legend_bottom" x1="0" y1="920" x2="0" y2="1260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#07110f" stop-opacity="0"/><stop offset=".25" stop-color="#07110f" stop-opacity=".78"/><stop offset="1" stop-color="#07110f" stop-opacity=".96"/></linearGradient><radialGradient id="Aura"><stop offset="0" stop-color="#ffd56d" stop-opacity=".42"/><stop offset=".58" stop-color="#dbab44" stop-opacity=".13"/><stop offset="1" stop-color="#dbab44" stop-opacity="0"/></radialGradient><linearGradient id="Gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1bf"/><stop offset=".5" stop-color="#d8ac57"/><stop offset="1" stop-color="#ffdf8a"/></linearGradient></defs>`;
 const frame=[];
 if(leg){
  frame.push(`<g id="Legendary_frame" data-name="Legendary / gilded full-art frame" clip-path="url(#Card_clip)">${rect(0,0,900,240,0,'url(#Legend_top)')}${rect(0,920,900,340,0,'url(#Legend_bottom)')}${rect(18,18,864,1224,30,'none',c.edge,2.1)}${rect(25,25,850,1210,23,'none',c.light,.7)}${corner('legendary',c)}</g>`);
  frame.push(`<g id="Legendary_aura" data-name="Legendary / radiant gilt rank cartouche"><ellipse cx="450" cy="965" rx="380" ry="64" fill="url(#Aura)"/>${p('M78 965H246L266 946H634L654 965H822M78 969H246L266 988H634L654 969H822','none',c.edge,1.3)}${diamond(78,967,6,c.light)}${diamond(822,967,6,c.light)}${line(290,939,610,939,c.edge,.7)}${line(290,995,610,995,c.edge,.7)}${diamond(450,937,4,c.light)}${text('Legendary_rank_live','LEGENDARY',450,977,28,c.light,{anchor:'middle',font:'Inter',tracking:6,weight:600})}</g>`);
  frame.push(`<g id="Figure_icon_cartouche" data-name="Figure / symbolic gold emblem">${diamond(808,111,48,'#0c1917',c.edge,1.6)}${diamond(808,111,41,'none',c.light,.65)}${emblem(row.figureId,c.light,53,781.5,84.5)}</g>`);
 }else{
  frame.push(`<g id="Standard_frame" data-name="${c.label} / ${c.character}">${p(outer+' '+aperture,c.base,'none',0,'fill-rule="evenodd"')}${rect(18,18,864,1224,30,'none',c.edge,row.rarity==='common'?1.5:2.5)}${row.rarity!=='common'?rect(26,26,848,1208,22,'none',c.light,1):''}${['rare','epic'].includes(row.rarity)?rect(33,33,834,1194,15,'none',c.edge,.7):''}${corner(row.rarity,c)}${p(aperture,'none',c.edge,1.6)}${p(panel,c.panel)}${line(96,1012,804,1012,c.edge,.8)}${line(153,191,153,929,c.edge,1)}${line(747,191,747,929,c.edge,1)}</g>`);
  frame.push(`<g id="Portrait_inlay_ornaments" data-name="Portrait inlay / rank and figure emblems">${line(99,301,99,452,c.edge,1,'opacity=".4"')}${line(99,670,99,821,c.edge,1,'opacity=".4"')}${line(801,301,801,452,c.edge,1,'opacity=".4"')}${line(801,670,801,821,c.edge,1,'opacity=".4"')}${emblem(row.figureId,c.light,43,77.5,538.5)}${rankMarks(row.rarity,c,801,560)}</g>`);
  if(parent)frame.push(emblem(row.figureId,c.light,43,772,84));
  if(row.rarity==='rare')frame.push(p('M43 242V213L73 183M857 242V213L827 183M43 878V907L73 937M857 878V907L827 937','none',c.light,1.6));
  if(row.rarity==='epic')frame.push(`<g id="Epic_jewel_rails" data-name="Epic / amethyst jewel rails">${diamond(18,630,7,'#a284bd',c.light,1)}${diamond(882,630,7,'#a284bd',c.light,1)}${line(18,430,18,590,c.light,1.5)}${line(18,670,18,830,c.light,1.5)}${line(882,430,882,590,c.light,1.5)}${line(882,670,882,830,c.light,1.5)}</g>`);
 }
 const headerX=leg?78:parent?425:450;
 const ty=leg?103.5+titleSize*.48:(parent?103:93)+titleSize*.43;
 frame.push(`<g id="Card_text_live" data-name="Card / editable type">${text('Card_title_live',title,headerX,ty,titleSize,'#f0e6cf',{anchor:leg?'start':'middle'})}${text('Card_subtitle_live',copy.subtitle.toUpperCase(),leg?80:450,leg?170:parent?163:171,subtitleSize,c.light,{anchor:leg?'start':'middle',font:'Inter',tracking:1.75,weight:500})}${text('Biography_title_live',copy.bodyTitle,leg?78:96,leg?1031:995,bodyTitleSize,leg?c.light:c.ink)}${paragraph(lines,leg?78:96,leg?1068:1040,bioSize,lineHeight,leg?'#f2e8d1':c.ink)}${leg?'':text('Rarity_live',c.label,804,995,17,c.ink,{anchor:'end',font:'Inter',tracking:2,weight:600})}${text('Everfolk_brand_live','EVERFOLK',96,1209.972,27,'#eee4ce',{tracking:1.35})}${text('Edition_number_live',foot,816,1207.344,21,'#eee4ce',{anchor:'end',font:'Inter',tracking:2.1})}</g>`);
 frame.push(line(310,1202,row.editionLimit===null?640:680,1202,c.edge,1));
 return {svg:`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="1260" viewBox="0 0 900 1260"><title>${esc(title)} / ${c.label}</title>${defs}${frame.join('\n')}</svg>`,titleSize,bodySize:bioSize,bodyLines:lines,editionText:foot,palette:c};
}
module.exports={build,PALETTE,emblem,aperture,panel};
