const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..'),REPO=path.resolve(ROOT,'../../..'),LIB=path.join(REPO,'artwork/cards/framed-collection-v14'),KIT=path.join(REPO,'artwork/card-art-handoff-v1');
const req=createRequire(path.join(REPO,'package.json')),sharp=createRequire(req.resolve('next/package.json'))('sharp');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const need=(v,m)=>{if(!v)throw Error(m);};
const all=require('./role-edits.json').roles.flatMap(r=>['male','female'].map(g=>`${r.figureId}-${r.tier}-${g}`));
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const ids=only??all;need(ids.every(id=>all.includes(id)),'Only the approved two role cards may be rendered');
const catalog=load(path.join(LIB,'catalog.json')),kit=load(path.join(ROOT,'backup/artwork/card-art-handoff-v1/data/cards.json'));
const rgba=async input=>sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const unwrap=r=>{need(!r.isError,JSON.stringify(r));const t=r.content?.find(c=>c.type==='text');return t?JSON.parse(t.text):r;};
async function metadata(file){const bytes=fs.readFileSync(file),raw=await rgba(bytes);return{width:raw.info.width,height:raw.info.height,bytes:bytes.length,sha256:digest(bytes),rgbaSha256:digest(raw.data)};}
async function encode(input,file){const source=await rgba(input),bytes=await sharp(input).webp({lossless:true,exact:true,alphaQuality:100,effort:6}).toBuffer();need((await rgba(bytes)).data.equals(source.data),'Lossless pixels changed: '+file);fs.writeFileSync(file,bytes);return{src:'/assets/cards/collection-v14/'+path.basename(file),...await metadata(file)};}
(async()=>{
 const rows=ids.map(id=>{const row=catalog.assets.find(a=>a.slug===id),role=require('./role-edits.json').roles.find(r=>id.startsWith(`${r.figureId}-${r.tier}-`));need(row&&row.title===role.title,'Native card not rebuilt yet: '+id);return row;});
 await withMcp('VectorCraft',{readRoot:KIT,writeRoot:KIT,timeoutMs:60000},async({listTools,callTool})=>{
  const tools=await listTools();for(const name of ['open_file','export','run_command','command_list'])need(tools.some(t=>t.name===name),'Missing native tool '+name);
  const call=async(n,a)=>{const result=unwrap(await callTool(n,a));need(!result?.warnings?.length,'Native warning '+JSON.stringify(result?.warnings));return result;};
  const commands=await call('command_list',{filter:'file.close',brief:true});need((Array.isArray(commands)?commands:commands.commands).some(c=>c.id==='file.close'),'Missing native close');
  for(const row of rows){
   const id=row.slug,template=structuredClone(kit.assets.find(a=>a.id===id));
   const svg=fs.readFileSync(path.join(LIB,row.overlaySvg),'utf8');
   const serial=/<text\b[^>]*\bid="Edition_number_live"[^>]*>[\s\S]*?<\/text>/g;
   need((svg.match(serial)??[]).length===1,'Expected one serial node: '+id);
   fs.writeFileSync(path.join(KIT,template.overlaySvg),svg);
   fs.writeFileSync(path.join(KIT,template.footerlessOverlaySvg),svg.replace(serial,''));
   fs.copyFileSync(path.join(LIB,'qa',id+'-overlay.png'),path.join(KIT,template.frame));
   await call('open_file',{path:path.join(KIT,template.footerlessOverlaySvg)});
   await call('export',{format:'png',path:path.join(KIT,template.footerlessFrame),artboard:0,scale:1,options:{background:'transparent',includeArtboardFill:false}});
   await call('run_command',{command:'file.close',params:{}});
   const fitted=fs.readFileSync(path.join(LIB,row.fittedArt));
   const fullPNG=await sharp(fitted).composite([{input:fs.readFileSync(path.join(KIT,template.frame))}]).png().toBuffer();
   const cleanPNG=await sharp(fitted).composite([{input:fs.readFileSync(path.join(KIT,template.footerlessFrame))}]).png().toBuffer();
   const [full,clean,approved]=await Promise.all([rgba(fullPNG),rgba(cleanPNG),rgba(fs.readFileSync(path.join(LIB,row.export)))]);
   need(full.data.equals(approved.data),'Template full frame does not reproduce native export '+id);
   let editionRemovedPixels=0;
   for(let p=0;p<full.data.length;p+=4){if(full.data.subarray(p,p+4).equals(clean.data.subarray(p,p+4)))continue;const x=p/4%900,y=Math.floor(p/4/900);need(x>=700&&x<826&&y>=1180&&y<1224,'Changed outside serial '+id);editionRemovedPixels++;}
   need(editionRemovedPixels>0,'Serial not removed '+id);
   const pub=path.join(REPO,'public/assets/cards/collection-v14');
   const files={full:await encode(fullPNG,path.join(pub,id+'.webp')),footerless:await encode(cleanPNG,path.join(pub,id+'-footerless.webp')),thumbnail:await encode(fs.readFileSync(path.join(LIB,row.thumbnail)),path.join(pub,id+'-thumb.webp')),portrait:await encode(fs.readFileSync(path.join(REPO,row.sourceArt)),path.join(pub,id+'-portrait.webp'))};
   fs.copyFileSync(path.join(pub,id+'-portrait.webp'),path.join(KIT,template.sourcePortrait));
   fs.copyFileSync(path.join(pub,id+'-thumb.webp'),path.join(KIT,template.preview));
   for(const key of ['title','canonicalTitle','displayTitle','subtitle','bodyTitle','bodyText'])template[key]=row[key];
   template.copy={title:row.displayTitle||row.title,subtitle:row.subtitle,bodyTitle:row.bodyTitle,bodyText:row.bodyText};
   template.sceneBrief=row.sceneBrief;template.sourceArtworkSha256=row.sourceArtSha256;
   template.hashes={};
   for(const key of ['frame','footerlessFrame','sourcePortrait','preview'])template.hashes[key]=await metadata(path.join(KIT,template[key]));
   for(const key of ['overlaySvg','footerlessOverlaySvg'])template.hashes[key]={sha256:digest(fs.readFileSync(path.join(KIT,template[key])))};
   const sourceManifest=load(path.join(ROOT,'backup/public/assets/cards/collection-v14/manifest.json'));
   const prior=sourceManifest.deliveries.find(a=>a.id===id);
   const delivery={...prior,sourcePNG:row.export,sourceSha256:row.exportSha256,portraitSourceSha256:row.sourceArtSha256,editionRemovedPixels,outsideEditionChangedPixels:0,...files};
   json(path.join(ROOT,'qa/derivatives',id+'.json'),{id,template,delivery,nativeFrameExact:true,nativeWorkerFileClosed:true,uncoveredPixelDifferences:0,outsideEditionChangedPixels:0});
   console.log(JSON.stringify({complete:id,nativeFrameExact:true,outsideEditionChangedPixels:0}));
  }
 });
 json(path.join(ROOT,'qa/last-native-render.json'),{completed:ids,nativeWorkerClosed:true,completedAt:new Date().toISOString()});
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
