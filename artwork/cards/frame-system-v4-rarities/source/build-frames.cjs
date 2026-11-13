const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const EDITIONS = require('../rarity-editions.json');
const RARITIES = EDITIONS.rarities;
const editionLabel = spec => spec.editionLimitPerCard === null ? EDITIONS.unlimitedDisplay : String(EDITIONS.exampleCopyNumber).padStart(3,'0') + '/' + String(spec.editionLimitPerCard).padStart(3,'0');
const W = 900, H = 1260;
const C = { jade:'#0b2523', deep:'#0a1d1c', bronze:'#a7834f', gold:'#d7b47a', ivory:'#eee4ce', panel:'#eee1c1', ink:'#1a2b27', board:'#24221f', gray:'#343b37', ochre:'#847351' };
const unwrap = r => { const t = r.content?.find(c => c.type === 'text'); return t ? JSON.parse(t.text) : r; };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const d of ['masters','exports','review','qa']) fs.mkdirSync(path.join(ROOT,d),{recursive:true});
const qa = {tool:'VectorCraft local MCP / headless native authoring', canvas:[W,H], reference:'source/selected-reference.png', warnings:[], masters:[], exports:[], text:[], strokeWeights:{standardOuter:2.6, standardInner:1.3, standardFine:1.2, artworkOutline:2, legendaryPerimeter:1.5, laurelStem:1.65, footer:1}, notes:['No raster tracing. Borders are native analytic shapes and cubic Bezier paths.','The reference wreath and uppercase footer are preserved; no scarab substituted.']};
const artPoints=[[78,190],[822,190],[850,218],[850,902],[822,930],[78,930],[50,902],[50,218]];
const panelPoints=[[66,951],[834,951],[850,967],[850,1144],[834,1160],[66,1160],[50,1144],[50,967]];
function roundedPolygon(points, radius) {
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[(i+points.length-1)%points.length], b=points[i], c=points[(i+1)%points.length];
  const la=Math.hypot(a[0]-b[0],a[1]-b[1]),lc=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const r=Math.min(radius,la/2,lc/2);
  out.push({p:[b[0]+(a[0]-b[0])*r/la,b[1]+(a[1]-b[1])*r/la],q:b,n:[b[0]+(c[0]-b[0])*r/lc,b[1]+(c[1]-b[1])*r/lc]});
 }
 const fmt=p=>p.map(n=>+n.toFixed(5)).join(' ');
 return 'M'+fmt(out[0].p)+out.map((v,i)=>(i?' L'+fmt(v.p):'')+' Q'+fmt(v.q)+' '+fmt(v.n)).join('')+'Z';
}
const artD=roundedPolygon(artPoints,6);
const panelD=roundedPolygon(panelPoints,4);
const leaves=[
 'M3 37C-3 34 -5 27 -3 21C3 24 6 31 3 37Z',
 'M7 27C1 22 2 14 6 10C11 16 12 22 7 27Z',
 'M15 17C11 10 14 3 19 1C22 8 20 13 15 17Z',
 'M24 9C24 2 29 -2 36 -2C34 4 30 8 24 9Z',
 'M3 42C10 41 15 36 16 30C9 30 4 34 3 42Z',
 'M9 30C16 29 22 25 24 19C17 19 11 23 9 30Z',
 'M18 18C25 17 30 13 33 7C26 8 21 12 18 18Z'
];
async function main() {
 await withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:60000},async({listTools,callTool})=>{
  const ts=await listTools();
  for(const n of ['draw_path','draw_shape','command_batch','inspect_document','save_file','export'])if(!ts.some(t=>t.name===n))throw Error('Missing tool '+n);
  const catalog=unwrap(await callTool('command_list',{brief:true}));
  const commands=Array.isArray(catalog)?catalog:catalog.commands;
  for(const id of ['file.new','file.close','artboard.new','object.group','object.transform','object.setProps','object.compoundShape.make','object.clippingMask.make','text.create','text.setStyle','text.fonts'])if(!commands.some(c=>c.id===id))throw Error('Missing command '+id);
  const call=async(name,args={})=>{const r=unwrap(await callTool(name,args));if(r?.warning)qa.warnings.push(r.warning);if(r?.warnings?.length)qa.warnings.push(...r.warnings);return r;};
  const run=(command,params={})=>call('run_command',{command,params});
  const set=(ids,props)=>run('object.setProps',{ids:Array.isArray(ids)?ids:[ids],...props});
  const group=async(ids,name)=>{const r=await run('object.group',{ids});await set(r.id,{name});return r.id;};
  const trans=(ids,matrix)=>run('object.transform',{ids:Array.isArray(ids)?ids:[ids],matrix,strokes:true,corners:true});
  const layer=name=>run('layer.new',{name,top:true});
  const batch=async(steps,label)=>{const r=await call('command_batch',{steps,label,atomic:true});if(r.failed||r.completed!==steps.length)throw Error(JSON.stringify(r));return r;};
  const shape=async(name,x,y,width,height,radius,fill,stroke='none',strokeWidth=0)=> (await call('draw_shape',{shape:'rectangle',name,x,y,width,height,radius,fill,stroke,strokeWidth,join:'round'})).id;
  const draw=async(name,d,fill='none',stroke='none',strokeWidth=0)=> (await call('draw_path',{name,d,fill,stroke,strokeWidth,cap:'round',join:'round'})).id;
  const grad=(start,end,stops)=>({gradient:{kind:'linear',start,end,stops}});
  const line=(name,x1,y1,x2,y2,color,width=1)=>draw(name,'M'+x1+' '+y1+'L'+x2+' '+y2,'none',color,width);
  const bounds=async id=>(await call('inspect_document',{ids:[id],depth:0})).nodes[0].bounds;
  async function text(name,value,x,top,size,font,color,{tracking=0,justify='left',style='Regular'}={}){
   const r=await run('text.create',{x,y:0,text:value,size,font,color,justify,style});
   if(r.overflow?.length)throw Error('Text overflow '+name);
   if(tracking)await run('text.setStyle',{id:r.id,tracking});
   const b=await bounds(r.id);
   const dx=justify==='center'?x-b.x-b.width/2:justify==='right'?x-b.x-b.width:x-b.x;
   await run('object.move',{ids:[r.id],dx,dy:top-b.y});
   await set(r.id,{name});
   qa.text.push({id:r.id,name,value,font,size,bounds:await bounds(r.id)});
   return r.id;
  }
  async function sprig(name,x,y,sx,sy,scale=1){
   const parts=[{id:'draw_path',params:{name:name+' / curved stem',d:'M3 45C2 25 16 9 36 2',fill:'none',stroke:C.gold,strokeWidth:1.65,cap:'round',join:'round'}},
    ...leaves.map((d,i)=>({id:'draw_path',params:{name:name+' / Bezier leaf '+(i+1),d,fill:C.gold,stroke:'none',strokeWidth:0}}))];
   const r=await batch(parts,name+' / smooth native ornament');
   const g=await group(r.created,name);
   await trans(g,[sx*scale,0,0,sy*scale,x,y]);
   return g;
  }
  async function wreath(x,y){
   const ds=[
    {name:'Left laurel stem',d:'M28 53C10 46 3 25 14 9',fill:'none',stroke:C.gold,strokeWidth:1.5,cap:'round'},
    {name:'Left lower leaf',d:'M20 47C11 47 7 42 6 36C13 37 18 41 20 47Z',fill:C.gold,stroke:'none'},
    {name:'Left middle outer leaf',d:'M11 36C3 32 1 25 4 20C10 24 13 30 11 36Z',fill:C.gold,stroke:'none'},
    {name:'Left upper outer leaf',d:'M8 24C4 16 7 10 12 7C15 14 13 20 8 24Z',fill:C.gold,stroke:'none'},
    {name:'Left top leaf',d:'M13 13C12 6 16 1 21 0C23 6 19 11 13 13Z',fill:C.gold,stroke:'none'},
    {name:'Left lower inner leaf',d:'M18 44C24 40 25 34 23 29C17 32 15 38 18 44Z',fill:C.gold,stroke:'none'},
    {name:'Left middle inner leaf',d:'M10 32C17 29 20 23 18 18C12 21 9 26 10 32Z',fill:C.gold,stroke:'none'},
    {name:'Left upper inner leaf',d:'M10 20C17 17 20 12 19 7C13 10 10 15 10 20Z',fill:C.gold,stroke:'none'}
   ];
   const r=await batch(ds.map(s=>({id:'draw_path',params:s})),'Wreath left / smooth native paths');
   const left=await group(r.created,'Wreath / left branch');
   const copy=await run('object.transform',{ids:[left],matrix:[-1,0,0,1,58,0],copy:true,strokes:true});
   // Copy command returns transformed ids; use the current selection if a build returns no ids.
   const copiedIds=copy.ids || copy.created || (copy.id!==undefined?[copy.id]:[]);
   if(!copiedIds.length)throw Error('Wreath copy did not return ids: '+JSON.stringify(copy));
   const all=await group([left,...copiedIds],'Laurel wreath / two mirrored branches');
   await trans(all,[1,0,0,1,x,y]);
   return all;
  }
  async function makeCard(spec,ox,oy,preview=false){
   const kind=spec.fullArt?'legendary':'standard';
   await layer((preview?'Proof / ':'')+spec.label+' / '+(spec.fullArt?'full art':'standard frame'));
   const all=[],textGroups=[],frameGroups=[];
   // Preview placeholders are native fills only and never included in the production master.
   if(preview){
    const fill=grad([0,0],[900,1260],[{offset:0,color:'#30322d'},{offset:.34,color:'#6b6652'},{offset:.67,color:'#8b7956'},{offset:1,color:'#343a34'}]);
    const p=kind==='standard'?await draw('Artwork placeholder / native vector gradient',artD,fill):await shape('Full art placeholder / native vector gradient',0,0,W,H,42,fill);
    all.push(p);
   }
   if(kind==='standard'){
    const outer=await shape('Jade body / smooth rounded outer shape',0,0,W,H,42,C.jade);
    const hole=await draw('Artwork aperture / rounded chamfer geometry',artD,'#ffffff');
    const compound=await run('object.compoundShape.make',{ids:[outer,hole],mode:'subtract'});
    await set(compound.id,{name:'Body / live subtract artwork aperture'});
    all.push(compound.id);frameGroups.push(compound.id);
    const rs=await batch([
     {id:'draw_shape',params:{shape:'rectangle',name:'Outer bronze rule / 2.6 px',x:18,y:18,width:864,height:1224,radius:30,fill:'none',stroke:C.bronze,strokeWidth:2.6,join:'round'}},
     {id:'draw_shape',params:{shape:'rectangle',name:'Middle gold rule / 1.3 px',x:25,y:25,width:850,height:1210,radius:23,fill:'none',stroke:C.gold,strokeWidth:1.3,join:'round'}},
     {id:'draw_shape',params:{shape:'rectangle',name:'Inner bronze rule / 1.2 px',x:32,y:32,width:836,height:1196,radius:16,fill:'none',stroke:C.bronze,strokeWidth:1.2,join:'round'}},
     {id:'draw_path',params:{name:'Artwork aperture / continuous rounded chamfer outline',d:artD,fill:'none',stroke:C.gold,strokeWidth:2,cap:'round',join:'round'}}
    ],'Concentric smooth native border geometry');
    const g=await group(rs.created,'Borders / exact offsets and shared corner centres');
    all.push(g);frameGroups.push(g);
    const panel=await draw('Ivory description panel / softened clipped corners',panelD,C.panel);
    const div=await line('Description label divider',96,1017,804,1017,C.bronze,1);
    const pg=await group([panel,div],'Information panel / independent native shapes');all.push(pg);frameGroups.push(pg);
   }else{
    const top=await shape('Top transparent readability fade',0,0,W,240,0,grad([0,0],[0,240],[{offset:0,color:C.deep,opacity:.32},{offset:1,color:C.deep,opacity:0}]));
    const bottom=await shape('Bottom transparent readability fade',0,940,W,320,0,grad([0,940],[0,1260],[{offset:0,color:C.deep,opacity:0},{offset:1,color:C.deep,opacity:.64}]));
    const clip=await shape('Rounded-card readability clip',0,0,W,H,42,'#ffffff');
    const cg=await run('object.clippingMask.make',{ids:[top,bottom,clip]});
    await set(cg.id,{name:'Readability / transparent fades, no opaque panels'});
    all.push(cg.id);frameGroups.push(cg.id);
    const border=await shape('Legendary / single smooth gold perimeter 1.5 px',18,18,864,1224,30,'none',C.gold,1.5);
    all.push(border);frameGroups.push(border);
   }
   const corners=[];
   for(const [name,x,y,sx,sy]of[['Top left',42,48,1,1],['Top right',858,48,-1,1],['Bottom left',42,1212,1,-1],['Bottom right',858,1212,-1,-1]]){
    corners.push(await sprig(name+' laurel',x,y,sx,sy,kind==='standard'?.80:.73));
   }
   const cornerGroup=await group(corners,'Corner laurels / exact reflected Bezier geometry');all.push(cornerGroup);frameGroups.push(cornerGroup);
   if(kind!=='standard'){const w=await wreath(778,76);all.push(w);frameGroups.push(w);}
   const ids=[];
   if(kind==='standard'){
    ids.push(await text('Card name / editable placeholder','Card name',450,64,72,'Source Serif 4',C.ivory,{justify:'center'}));
    ids.push(await text('Role / editable placeholder','TITLE / ROLE',450,145,22,'Inter',C.gold,{tracking:210,justify:'center',style:'Medium'}));
    ids.push(await text('Card type / editable placeholder','CARD TYPE',96,978,21,'Inter',C.ink,{tracking:170,style:'Medium'}));
    ids.push(await text('Rarity / '+spec.label,spec.label.toUpperCase(),804,978,21,'Inter',C.ink,{tracking:170,style:'Medium',justify:'right'}));
    ids.push(await text('Description / editable placeholder','A story worth remembering.',96,1042,40,'Source Serif 4',C.ink));
   }else{
    ids.push(await text('Card name / floating editable placeholder','Card name',78,69,72,'Source Serif 4',C.ivory));
    ids.push(await text('Role / floating editable placeholder','TITLE / ROLE',82,149,22,'Inter',C.gold,{tracking:210,style:'Medium'}));
    ids.push(await text('Legendary label / editable','LEGENDARY',78,1037,21,'Inter',C.gold,{tracking:180,style:'Medium'}));
    ids.push(await text('Description / floating editable placeholder','A story worth remembering.',78,1090,37,'Source Serif 4',C.ivory));
    const divider=await line('Legendary description hairline',78,1076,822,1076,C.gold,0.75);await set(divider,{opacity:55});all.push(divider);frameGroups.push(divider);
   }
   const tg=await group(ids,'Type / live editable placeholders');all.push(tg);textGroups.push(tg);
   const footerIds=[
    await text('Footer / original uppercase serif treatment','EVERFOLK',96,1182,27,'Source Serif 4',C.ivory,{tracking:50}),
    await text('Edition / '+spec.label+' / editable example',editionLabel(spec),816,1187,spec.editionLimitPerCard===null?18.5:21,'Inter',C.ivory,{tracking:spec.editionLimitPerCard===null?100:160,justify:'right'})
   ];
   const ft=await group(footerIds,'Footer type / editable edition number');all.push(ft);textGroups.push(ft);
   const rule=await line('Footer hairline',310,1202,spec.editionLimitPerCard===null?640:680,1202,C.bronze,1);all.push(rule);frameGroups.push(rule);
   const card=await group(all,spec.label.toUpperCase()+' / '+(spec.fullArt?'full-art frame':'selected jade and bronze'));
   if(ox||oy)await trans(card,[1,0,0,1,ox,oy]);
   return{kind,spec,card,textGroups,frameGroups};
  }
  async function ex(format,file,artboard=0,extra={}){
   const r=await call('export',{format,path:path.join(ROOT,file),artboard,...extra});
   qa.exports.push({file,format,artboard,...extra});
   return r;
  }
  const master=path.join(ROOT,'masters/Everfolk-Rarity-Frames.vectorcraft');
  await run('file.new',{name:'Everfolk / five rarities and edition limits',width:W,height:H,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
  await run('artboard.setProps',{index:0,name:'01 '+RARITIES[0].label+' / '+editionLabel(RARITIES[0])});
  for(let i=1;i<RARITIES.length;i++)await run('artboard.new',{x:i*1040,y:0,width:W,height:H,name:String(i+1).padStart(2,'0')+' '+RARITIES[i].label+' / '+editionLabel(RARITIES[i])});
  const cards=[];
  for(let i=0;i<RARITIES.length;i++)cards.push(await makeCard(RARITIES[i],i*1040,0));
  qa.editionConfiguration=EDITIONS;
  const fonts=await run('text.fonts');
  if(fonts.some(f=>f.status!=='exact'||f.missingGlyphs))throw Error('Fonts not exact '+JSON.stringify(fonts));
  qa.fonts=fonts;
  qa.document=await call('inspect_document',{depth:1,childLimit:8});
  qa.rasterImages=(await call('inspect_document',{kind:'Image',limit:0})).total||0;
  if(qa.rasterImages)throw Error('Unexpected raster images in native master');
  await call('save_file',{path:master,compress:true,preview:true});
  qa.masters.push('masters/Everfolk-Rarity-Frames.vectorcraft');
  for(let i=0;i<cards.length;i++){
   const name=cards[i].spec.id;
   await ex('png','exports/'+name+'-layout.png',i,{scale:1,options:{background:'transparent',includeArtboardFill:false}});
   await ex('png','exports/'+name+'-layout-2x.png',i,{scale:2,options:{background:'transparent',includeArtboardFill:false}});
   await ex('svg','exports/'+name+'-layout.svg',i,{outlineText:true});
   await ex('svg','exports/'+name+'-layout-live.svg',i,{outlineText:false});
   await set(cards[i].textGroups,{visible:false});
   await ex('png','exports/'+name+'-frame.png',i,{scale:1,options:{background:'transparent',includeArtboardFill:false}});
   await ex('svg','exports/'+name+'-frame.svg',i,{outlineText:true});
   await set(cards[i].textGroups,{visible:true});
  }
  await run('file.close');
  // Reopen the actual native master and verify its render and vector editability.
  await call('open_file',{path:master});
  qa.reopenedDocument=await call('inspect_document',{depth:1,childLimit:8});
  qa.reopenedFonts=await run('text.fonts');
  qa.reopenedImages=(await call('inspect_document',{kind:'Image',limit:0})).total||0;
  if(qa.reopenedDocument.artboards.length!==RARITIES.length||qa.reopenedImages||qa.reopenedFonts.some(f=>f.status!=='exact'||f.missingGlyphs))throw Error('Reopen checks failed');
  for(let i=0;i<RARITIES.length;i++){
   const name=RARITIES[i].id;
   await ex('png','qa/'+name+'-reopened.png',i,{scale:1,options:{background:'transparent',includeArtboardFill:false}});
   if(sha(path.join(ROOT,'qa/'+name+'-reopened.png'))!==sha(path.join(ROOT,'exports/'+name+'-layout.png')))throw Error('Reopen render mismatch '+name);
  }
  qa.nativeReopenIdentical=true;
  await run('file.close');
  // Separate review board. Its artwork placeholders are native gradients, not raster images.
  await run('file.new',{name:'Everfolk / five rarities edition proof',width:3140,height:2950,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
  await shape('Presentation field',0,0,3140,2950,0,C.board);
  const positions=[[90,140],[1120,140],[2150,140],[605,1580],[1635,1580]];
  for(let i=0;i<RARITIES.length;i++){
   const [x,y]=positions[i],spec=RARITIES[i];
   await text('Review label / '+spec.label,spec.label.toUpperCase()+' / '+(spec.editionLimitPerCard===null?'UNLIMITED':spec.editionLimitPerCard+' COPIES'),x+450,y-72,28,'Source Serif 4',C.ivory,{tracking:140,justify:'center'});
   await makeCard(spec,x,y,true);
  }
  await text('Review annotation','Edition limits per card  /  Legendary full art  /  Common unlimited',1570,2878,23,'Inter','#bfb49d',{justify:'center'});
  await call('save_file',{path:path.join(ROOT,'review/Everfolk-Rarity-Frames-Proof.vectorcraft'),compress:true,preview:true});
  qa.masters.push('review/Everfolk-Rarity-Frames-Proof.vectorcraft');
  await ex('png','review/Everfolk-Rarity-Frames.png',0,{scale:1});
  await ex('png','review/Everfolk-Rarity-Frames-1570.png',0,{scale:.5});
  await ex('svg','review/Everfolk-Rarity-Frames.svg',0,{outlineText:true});
  await run('file.close');
 });
 if(qa.warnings.length)throw Error('Warnings require review: '+JSON.stringify(qa.warnings));
 fs.writeFileSync(path.join(ROOT,'qa/native-build.json'),JSON.stringify(qa,null,2));
 console.log(JSON.stringify({masters:qa.masters,exactFonts:qa.fonts,nativeReopenIdentical:qa.nativeReopenIdentical,rasterImages:qa.rasterImages,exports:qa.exports.length,warnings:qa.warnings}));
}
main().catch(e=>{fs.writeFileSync(path.join(ROOT,'qa/build-error.txt'),e.stack);console.error(e.stack);process.exitCode=1;});
