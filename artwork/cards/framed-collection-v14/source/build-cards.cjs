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
const DESIGN = require('./frame-design.cjs');
const W=900,H=1260;
const esc = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const unwrap = r => {if(r.isError)throw Error(JSON.stringify(r));const t=r.content?.find(c=>c.type==='text');return t?JSON.parse(t.text):r;};
for (const d of ['source/cards','source/overlays','assets/fitted','exports','masters','qa','review']) fs.mkdirSync(path.join(ROOT,d),{recursive:true});
const out = (...p) => path.join(ROOT,...p);
const rel = p => path.relative(ROOT,p).replaceAll('\\','/');

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
  const matte=await sharp({create:{width:800,height:740,channels:4,background:DESIGN.PALETTE[row.rarity].matte}}).png().toBuffer();
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
 const designed=await DESIGN.build(row,row);
 const file=out('source/overlays',row.slug+'.svg');
 fs.writeFileSync(file,designed.svg);
 return {file,...designed};
}
async function prepare(row){
 const fitted=await fittedArt(row);
 const ov=await overlay(row);
 const bitmap=fs.readFileSync(fitted.file).toString('base64');
 const image=`<g id="Artwork_fitted_bitmap" data-name="Artwork / fitted bitmap, source preserved separately"><image id="Pixel_artwork" width="900" height="1260" x="0" y="0" preserveAspectRatio="none" image-rendering="pixelated" xlink:href="data:image/png;base64,${bitmap}"/></g>`;
 const svg=ov.svg.replace(/(<svg[^>]*>)/,`$1\n${image}`);
 const source=out('source/cards',row.slug+'.svg');fs.writeFileSync(source,svg);
 const iconFile=out('source/icons',row.figureId+'.svg');
 return {...row,iconSource:{file:rel(iconFile),sha256:sha(iconFile),credits:'source/icon-sources.json'},editionText:ov.editionText,rarityCharacteristics:ov.palette.character,bodySize:ov.bodySize,bodyLines:ov.bodyLines,fit:fitted.fit,sourceSvg:rel(source),fittedArt:rel(fitted.file),overlaySvg:rel(ov.file),titleSize:ov.titleSize,sourceArtSha256:sha(fitted.input)};
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
 const available=process.argv.includes('--available'),missing=process.argv.includes('--missing');
 const rows=MAP.assets.filter(a=>(!only||only.includes(a.slug))&&(!available||fs.existsSync(path.resolve(PROJECT,a.sourceArt)))&&(!missing||!fs.existsSync(out('exports',a.slug+'.png'))));
 const prepared=[];
 for(const row of rows)prepared.push(await prepare(row));
 await native(prepared);
 const cache=out('catalog.json');
 const previous=fs.existsSync(cache)?JSON.parse(fs.readFileSync(cache,'utf8')).assets:[];
 const keyed=new Map(previous.map(x=>[x.slug,x]));for(const row of prepared)keyed.set(row.slug,row);
 const assets=MAP.assets.map(x=>keyed.get(x.slug)).filter(Boolean);
 for(const asset of assets){
  for(const key of ['typeLabel','footerLeft','footerRight','intendedEditionLimit','copySerial'])delete asset[key];
  fs.writeFileSync(out('qa',asset.slug+'-fit.json'),JSON.stringify(asset,null,2));
 }
 fs.writeFileSync(cache,JSON.stringify({libraryId:MAP.libraryId,date:'2026-11-13',canvas:[W,H],frameSystem:'v14-five-distinct-rarities',expected:117,complete:assets.length===117,sourceLibraries:[...new Set(assets.map(a=>a.sourceArt.split('/')[2]))],notes:['Approved portrait fits are retained. Original illustrations remain unchanged.','All five rarities have distinct native frame characteristics.','Every figure has four male/female subcard tiers. New roles are an editorial collection extension, not a change to gameplay code.','Edition serials are requested display examples.','Frame, icons and live type remain editable; artwork is a fitted bitmap.'],assets},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
