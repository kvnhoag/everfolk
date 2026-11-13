const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.resolve(ROOT, '../../..');
const req = createRequire(path.join(PROJECT, 'package.json'));
const sharp = createRequire(req.resolve('next/package.json'))('sharp');
const MAP = require('./framing-map.json');
const INNER = require('../../figure-inner-art-v12/catalog.json');
const FRAMES = path.resolve(ROOT, '../frame-system-v5-limits/exports');
const W=900,H=1260;
const esc = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const unwrap = r => {if(r.isError)throw Error(JSON.stringify(r));const t=r.content?.find(c=>c.type==='text');return t?JSON.parse(t.text):r;};
for (const d of ['source/cards','source/overlays','assets/fitted','exports','masters','qa','review']) fs.mkdirSync(path.join(ROOT,d),{recursive:true});
const out = (...p) => path.join(ROOT,...p);
const rel = p => path.relative(ROOT,p).replaceAll('\\','/');

async function textWidth(value,size,font='Source Serif 4',tracking=0){
 const m=await sharp({text:{text:esc(value),font:`${font} ${size}`,rgba:true,dpi:72}}).metadata();
 return m.width+Math.max(0,value.length-1)*tracking;
}
async function fitFont(value,maxWidth,max=72,font='Source Serif 4',tracking=0){
 let size=max;
 while(size>20 && await textWidth(value,size,font,tracking)>maxWidth)size--;
 return size;
}
function text(id,value,x,y,size,color,{anchor='start',font='Source Serif 4',tracking=0,weight=400}={}){
 return `<text id="${id}" data-name="${id.replaceAll('_',' ')}" x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${tracking?` letter-spacing="${tracking}"`:''}><tspan x="${x}" y="${y}">${esc(value)}</tspan></text>`;
}

// Low-detail edge colour fields extend the setting without duplicating faces or tools.
async function sideField(input,left,width,height){
 const m=await sharp(input).metadata();
 const edge=await sharp(input).extract({left:left?0:m.width-12,top:0,width:12,height:m.height})
  .resize(Math.ceil(width/3),Math.ceil(height/3),{kernel:'lanczos3'}).png().toBuffer();
 return sharp(edge).resize(width,height,{kernel:'nearest'}).png().toBuffer();
}
async function fittedArt(row){
 const input=path.resolve(PROJECT,row.sourceArt);
 const file=out('assets/fitted',row.slug+'.png');
 let layers,fit;
 if(row.frameLayout==='standard'){
  const art=await sharp(input).resize(592,740,{kernel:'nearest'}).png().toBuffer();
  const matte=await sharp({create:{width:800,height:740,channels:4,background:'#0a1d1c'}}).png().toBuffer();
  layers=[{input:matte,left:50,top:190},{input:art,left:154,top:190}];
  fit={method:'nearest-neighbour portrait contain with jade inlay',source:[840,1050],rect:[154,190,592,740],aperture:[50,190,800,740],sourceCropped:false,kernel:'nearest',aspectRatioPreserved:true,note:'Full portrait retained; jade side inlays occupy the wider standard aperture.'};
 }else{
  // Native-size portrait retained; only atmospheric fields extend beyond its edges.
  const top=await sharp(input).extract({left:0,top:0,width:840,height:1}).resize(840,140,{kernel:'nearest'}).png().toBuffer();
  const bottom=await sharp(input).extract({left:0,top:1049,width:840,height:1}).resize(840,70,{kernel:'nearest'}).png().toBuffer();
  const [left,right]=await Promise.all([sideField(input,true,30,1260),sideField(input,false,30,1260)]);
  layers=[{input:left,left:0,top:0},{input:right,left:870,top:0},{input:top,left:30,top:0},{input:bottom,left:30,top:1190},{input:input,left:30,top:140}];
  fit={method:'native-size portrait with low-detail source-edge atmosphere',source:[840,1050],rect:[30,140,840,1050],sourceCropped:false,kernel:'none for original artwork'};
 }
 let fitted=await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
 if(row.frameLayout!=='standard'){
  const mask=Buffer.from(`<svg width="900" height="1260"><rect width="900" height="1260" rx="42" fill="white"/></svg>`);
  fitted=await sharp(fitted).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 }
 fs.writeFileSync(file,fitted);
 return {file,fit,input};
}
async function overlay(row){
 let svg=fs.readFileSync(path.join(FRAMES,`${row.rarity}-layout-live.svg`),'utf8');
 svg=svg.replace(/<title>.*?<\/title>/,`<title>${esc(row.title)} / ${row.rarity}</title>`);
 svg=svg.replace(/<text\b[\s\S]*?<\/text>/g,'');
 svg=svg.replace(/(<line id="Footer_hairline"[^>]*x2=")[^"]+/, '$1620');
 const leg=row.frameLayout==='full-art';
 const size=await fitFont(row.title,leg?650:720,72);
 const titleY=+(103.5+size*.48).toFixed(3);
 const subtitle=row.kind==='parent'?'HISTORICAL FIGURE':row.subtitle.toUpperCase();
 const subSize=await fitFont(subtitle,leg?640:720,20,'Inter',2.6);
 const figure=INNER.assets.find(a=>a.slug===row.slug).figureName;
 const body=leg?'Historical figure':figure;
 const bodySize=await fitFont(body,leg?744:708,leg?37:40);
 const secondary=row.kind==='parent'?'ART PREVIEW':`ART PREVIEW · ${row.gender.toUpperCase()} CONTRIBUTOR`;
 const foot=row.intendedEditionLimit===null?'UNLIMITED':`LIMIT ${String(row.intendedEditionLimit).padStart(3,'0')}`;
 const nodes=[
  text('Card_title_live',row.title,leg?78:450,titleY,size,'#eee4ce',{anchor:leg?'start':'middle'}),
  text('Affiliation_live',subtitle,leg?82:450,leg?170.312:166.312,subSize,'#d7b47a',{anchor:leg?'start':'middle',font:'Inter',tracking:2.6,weight:500}),
  text('Rarity_live',row.rarity.toUpperCase(),leg?78:804,leg?1057.344:998.344,21,leg?'#d7b47a':'#1a2b27',{anchor:leg?'start':'end',font:'Inter',tracking:3.57,weight:500}),
  text('Collection_live',body,leg?78:96,leg?1128.332:1083.44,bodySize,leg?'#eee4ce':'#1a2b27'),
  text('Preview_status_live',secondary,leg?78:96,leg?1159:1126,16,leg?'#d7b47a':'#59604f',{font:'Inter',tracking:1.1}),
  text('Everfolk_brand_live','EVERFOLK',96,1209.972,27,'#eee4ce',{tracking:1.35}),
  text('Edition_limit_live',foot,816,1207.344,18.5,'#eee4ce',{anchor:'end',font:'Inter',tracking:1.5})
 ];
 if(!leg)nodes.unshift('<g id="Portrait_inlay_rules" data-name="Portrait inlay / fine bronze rules"><path d="M153 191V929M747 191V929" fill="none" stroke="#a7834f" stroke-width="1" opacity="0.8"/><path d="M99 338V446M99 674V782M801 338V446M801 674V782" fill="none" stroke="#a7834f" stroke-width="1" opacity="0.35"/><path d="M99 546L105 560L99 574L93 560ZM801 546L807 560L801 574L795 560Z" fill="none" stroke="#a7834f" stroke-width="1" opacity="0.6"/></g>');
 if(!leg)nodes.push(text('Card_type_live',row.typeLabel,96,998.344,19,'#1a2b27',{font:'Inter',tracking:2.2,weight:500}));
 svg=svg.replace('</svg>',`<g id="Card_type_editable" data-name="Card type / editable">${nodes.join('\n')}</g>\n</svg>`);
 const file=out('source/overlays',row.slug+'.svg');fs.writeFileSync(file,svg);
 return {file,svg,titleSize:size};
}
async function prepare(row){
 const fitted=await fittedArt(row);
 const ov=await overlay(row);
 const bitmap=fs.readFileSync(fitted.file).toString('base64');
 const image=`<g id="Artwork_fitted_bitmap" data-name="Artwork / fitted bitmap, source preserved separately"><image id="Pixel_artwork" width="900" height="1260" x="0" y="0" preserveAspectRatio="none" image-rendering="pixelated" xlink:href="data:image/png;base64,${bitmap}"/></g>`;
 const svg=ov.svg.replace(/(<svg[^>]*>)/,`$1\n${image}`);
 const source=out('source/cards',row.slug+'.svg');fs.writeFileSync(source,svg);
 return {...row,footerLeft:'EVERFOLK',footerRight:row.intendedEditionLimit===null?'UNLIMITED':`LIMIT ${String(row.intendedEditionLimit).padStart(3,'0')}`,previewStatus:row.kind==='parent'?'ART PREVIEW':`ART PREVIEW · ${row.gender.toUpperCase()} CONTRIBUTOR`,fit:fitted.fit,sourceSvg:rel(source),fittedArt:rel(fitted.file),overlaySvg:rel(ov.file),titleSize:ov.titleSize,sourceArtSha256:sha(fitted.input)};
}

async function native(rows){
 await withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:60000},async({listTools,callTool})=>{
  const ts=await listTools();for(const n of ['open_file','save_file','export','inspect_document','run_command'])if(!ts.some(t=>t.name===n))throw Error('Tool missing '+n);
  const call=async(n,a={})=>{const r=unwrap(await callTool(n,a));if(r?.warnings?.length)throw Error(`${n}: ${JSON.stringify(r.warnings)}`);return r;};
  for(const row of rows){
   const svg=out(row.sourceSvg),master=out('masters',row.slug+'.vectorcraft');
   await call('open_file',{path:svg});
   const type=await call('inspect_document',{kind:'Type',limit:30,depth:0});
   const art=await call('inspect_document',{kind:'Image',limit:10,depth:0});
   fs.writeFileSync(out('qa',row.slug+'-native.json'),JSON.stringify({type,art},null,2));
   const nodes=type.nodes||[];
   if(nodes.length<7)throw Error('Expected editable text '+row.slug);
   for(const n of nodes){const b=n.bounds;if(b&&(b.x<40||b.x+b.width>860||b.y<30||b.y+b.height>1230))throw Error('Out-of-frame text '+row.slug+' '+JSON.stringify(n));}
   await call('save_file',{path:master,compress:true,preview:true});
   await call('export',{format:'png',path:out('qa',row.slug+'-native.png'),artboard:0,scale:1,options:{background:'transparent',includeArtboardFill:false}});
   await call('run_command',{command:'file.close',params:{}});
   await call('open_file',{path:master});
   await call('export',{format:'png',path:out('qa',row.slug+'-reopened.png'),artboard:0,scale:1,options:{background:'transparent',includeArtboardFill:false}});
   await call('run_command',{command:'file.close',params:{}});
   // Render only the native vectors/type as a transparent overlay for exact fitted pixels.
   await call('open_file',{path:out(row.overlaySvg)});
   await call('export',{format:'png',path:out('qa',row.slug+'-overlay.png'),artboard:0,scale:1,options:{background:'transparent',includeArtboardFill:false}});
   await call('run_command',{command:'file.close',params:{}});
   row.master=rel(master);
   await crisp(row);
   fs.writeFileSync(out('qa',row.slug+'-fit.json'),JSON.stringify(row,null,2));
   console.log(JSON.stringify({complete:row.slug,titleSize:row.titleSize,pixelDifference:row.qa.uncoveredRgbDifferences}));
  }
 });
}
async function crisp(row){
 const overlayFile=out('qa',row.slug+'-overlay.png');
 const nativeFile=out('qa',row.slug+'-native.png'),reopened=out('qa',row.slug+'-reopened.png');
 const native=await sharp(nativeFile).ensureAlpha().raw().toBuffer();
 const reopen=await sharp(reopened).ensureAlpha().raw().toBuffer();
 if(!native.equals(reopen))throw Error('Native reopen mismatch '+row.slug);
 const [under,over]=await Promise.all([sharp(out(row.fittedArt)).ensureAlpha().raw().toBuffer(),sharp(overlayFile).ensureAlpha().raw().toBuffer()]);
 const finalFile=out('exports',row.slug+'.png');
 await sharp(out(row.fittedArt)).composite([{input:overlayFile}]).png().toFile(finalFile);
 const final=await sharp(finalFile).ensureAlpha().raw().toBuffer();
 let checked=0,difference=0;
 for(let i=0;i<final.length;i+=4){if(under[i+3]===255&&over[i+3]===0){checked++;if(final[i]!==under[i]||final[i+1]!==under[i+1]||final[i+2]!==under[i+2])difference++;}}
 if(difference||checked<500000)throw Error('Pixel compositing mismatch '+row.slug+' '+difference+'/'+checked);
 for(const i of [0,(W-1)*4,(H-1)*W*4,(W*H-1)*4])if(final[i+3]!==0)throw Error('Opaque outer corner '+row.slug);
 await sharp(finalFile).resize(450,630,{kernel:'nearest'}).png().toFile(out('assets',row.slug+'-thumb.png'));
 row.export=rel(finalFile);row.thumbnail=`assets/${row.slug}-thumb.png`;row.exportSha256=sha(finalFile);
 row.qa={nativeReopenIdentical:true,uncoveredPixelsChecked:checked,uncoveredRgbDifferences:difference,transparentOuterCorners:true,editableText:true};
}
async function main(){
 const only=process.argv.find(v=>v.startsWith('--only='))?.slice(7)?.split(',');
 const rows=MAP.assets.filter(a=>!only||only.includes(a.slug));
 const prepared=[];
 for(const row of rows)prepared.push(await prepare(row));
 await native(prepared);
 const cache=out('catalog.json');
 const previous=fs.existsSync(cache)?JSON.parse(fs.readFileSync(cache,'utf8')).assets:[];
 const keyed=new Map(previous.map(x=>[x.slug,x]));for(const row of prepared)keyed.set(row.slug,row);
 const assets=MAP.assets.map(x=>keyed.get(x.slug)).filter(Boolean);
 fs.writeFileSync(cache,JSON.stringify({libraryId:MAP.libraryId,date:'2026-11-13',canvas:[W,H],frameSystem:'frame-system-v5-limits',expected:83,complete:assets.length===83,sourceLibrary:'figure-inner-art-v12',notes:['Original v12 art is preserved. Standard portrait fits use nearest-neighbour; Legendary portraits remain at native size.','Artwork is a fitted bitmap; frame paths and type remain editable in each native VectorCraft master.','Final PNGs composite exact fitted pixels with the native transparent vector/type overlay.','Six Nearchus/Eumenes assets use editorial Epic styling; gameplay rarity remains unspecified.','ART PREVIEW and intended edition limits do not assign an issued copy.'],assets},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
