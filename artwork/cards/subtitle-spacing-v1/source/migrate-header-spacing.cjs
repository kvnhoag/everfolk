/** Focused, lossless contributor-header migration. Native masters are handled separately. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const args=process.argv.slice(2),index=args.indexOf('--repo');
const REPO=fs.realpathSync(index>=0?args[index+1]:path.resolve(__dirname,'../../../..'));
const APPLY=args.includes('--apply'),SCAN=args.includes('--scan');
const OWN='artwork/cards/subtitle-spacing-v1',LIB='artwork/cards/framed-collection-v14',KIT='artwork/card-art-handoff-v1';
const req=createRequire(path.join(REPO,'package.json')),sharp=createRequire(req.resolve('next/package.json'))('sharp');
const need=(v,m)=>{if(!v)throw Error(m);},hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const at=p=>{need(!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..'),'Unsafe relative path '+p);return path.join(REPO,p);};
const load=p=>JSON.parse(fs.readFileSync(at(p),'utf8')),sha=p=>hash(fs.readFileSync(at(p)));
const raw=async b=>sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const box={left:80,top:50,width:740,height:135},W=900,H=1260;
const records=[],checks=[],backups=new Set(),activeBytes=new Map(),encodingCache=new Map();
function write(p,b){if(typeof b==='string')b=Buffer.from(b);const file=at(p),before=fs.existsSync(file)?fs.readFileSync(file):null;if(before?.equals(b))return;
 records.push({file:p,beforeSha256:before?hash(before):null,sha256:hash(b),bytes:b.length});
 if(p.startsWith('public/assets/cards/subtitle-spacing-v1/'))activeBytes.set(p,b);
 if(!APPLY)return;
 if(!backups.has(p)){if(before){const dest=at(OWN+'/backup/files/'+p);need(!fs.existsSync(dest),'Backup already exists '+p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,before);}backups.add(p);}
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b);
}
const json=(p,v)=>write(p,JSON.stringify(v,null,2)+'\n');
function header(data){const out=Buffer.alloc(box.width*box.height*4);for(let y=0;y<box.height;y++)data.copy(out,y*box.width*4,((box.top+y)*W+box.left)*4,((box.top+y)*W+box.left+box.width)*4);return out;}
function shifted(old,id){const base=old.subarray(0,4),bands=[];let start=null;
 for(let y=0;y<box.height;y++){let n=0;for(let x=0;x<box.width;x++)if(!old.subarray((y*box.width+x)*4,(y*box.width+x+1)*4).equals(base))n++;
  if(n&&start===null)start=y;if(!n&&start!==null){bands.push([start,y-1]);start=null;}}
 if(start!==null)bands.push([start,box.height-1]);need(bands.length>=2,'Expected separate title/subtitle '+id);
 const sub=bands.at(-1),title=bands.slice(0,-1);need(sub[0]+box.top>=148&&sub[0]+box.top<=150&&sub[1]+box.top>=162&&sub[1]+box.top<=166,'Unexpected subtitle span '+id+JSON.stringify(bands));
 need(title[0][0]>=10&&title.at(-1)[1]<sub[0],'Unsafe title band '+id);
 const next=Buffer.alloc(old.length);for(let o=0;o<next.length;o+=4)base.copy(next,o);
 for(const [a,b]of title)for(let y=a;y<=b;y++)old.copy(next,(y-10)*box.width*4,y*box.width*4,(y+1)*box.width*4);
 for(let y=sub[0];y<=sub[1];y++)old.copy(next,(y+8)*box.width*4,y*box.width*4,(y+1)*box.width*4);
 return {before:old,after:next,bands:bands.map(b=>b.map(y=>y+box.top)),newBands:[...title.map(b=>b.map(y=>y+box.top-10)),sub.map(y=>y+box.top+8)]};
}
function shiftSvg(text,id){let result=text;
 for(const [name,delta]of [['Card_title_live',-10],['Card_subtitle_live',8]]){const re=new RegExp('<text\\b[^>]*\\bid="'+name+'"[^>]*>[\\s\\S]*?<\\/text>','g'),matches=[...result.matchAll(re)];need(matches.length===1,'Expected one '+name+' '+id);let count=0;const replacement=matches[0][0].replace(/\by="([\d.]+)"/g,(_,value)=>{count++;return 'y="'+Number((+value+delta).toFixed(6))+'"';});need(count===2,'Expected text+tspan y '+id);result=result.replace(re,replacement);}
 return result;
}
async function meta(bytes){const r=await raw(bytes);return{width:r.info.width,height:r.info.height,bytes:bytes.length,sha256:hash(bytes),rgbaSha256:hash(r.data)};}
async function encode(data,format,width=W,height=H){const key=format+width+'x'+height+hash(data);if(encodingCache.has(key))return encodingCache.get(key);const s=sharp(data,{raw:{width,height,channels:4}}),bytes=format==='webp'?await s.webp({lossless:true,exact:true,alphaQuality:100,effort:4}).toBuffer():await s.png().toBuffer();need((await raw(bytes)).data.equals(data),'Lossless encode changed pixels');encodingCache.set(key,bytes);return bytes;}
async function patch(p,patch,out=p){const bytes=fs.readFileSync(at(p)),r=await raw(bytes);need(r.info.width===W&&r.info.height===H,'Not native size '+p);need(header(r.data).equals(patch.before),'Header differs from approved overlay '+p);
 const next=Buffer.from(r.data);for(let y=0;y<box.height;y++)patch.after.copy(next,((box.top+y)*W+box.left)*4,y*box.width*4,(y+1)*box.width*4);
 // Compare large immutable spans, then count only the bounded header pixels.
 const begin=box.top*W*4,end=(box.top+box.height)*W*4;need(next.subarray(0,begin).equals(r.data.subarray(0,begin))&&next.subarray(end).equals(r.data.subarray(end)),'Outside-header rows changed '+p);
 let changed=0;for(let y=0;y<box.height;y++){const rowStart=(box.top+y)*W*4,left=rowStart+box.left*4,right=left+box.width*4;need(next.subarray(rowStart,left).equals(r.data.subarray(rowStart,left))&&next.subarray(right,rowStart+W*4).equals(r.data.subarray(right,rowStart+W*4)),'Outside-header columns changed '+p);for(let o=left;o<right;o+=4)if(next.readUInt32LE(o)!==r.data.readUInt32LE(o))changed++;}
 const encoded=await encode(next,path.extname(out)==='.webp'?'webp':'png');write(out,encoded);return{bytes:encoded,raw:next,metadata:await meta(encoded),changedPixels:changed};
}
async function thumb(data,p){const pixels=await sharp(data,{raw:{width:W,height:H,channels:4}}).resize(450,630,{kernel:'nearest'}).raw().toBuffer(),bytes=await encode(pixels,path.extname(p)==='.webp'?'webp':'png',450,630);write(p,bytes);return{bytes,metadata:await meta(bytes)};}
function fingerprintChecks(catalog,kit,registry,manifest,active){const current=sha(LIB+'/catalog.json');for(const [name,v]of Object.entries({registry,manifest,active}))need(v.sourceCatalogSha256===current,name+' catalogue fingerprint differs');
 for(const e of active.entries){const k=kit.assets.find(r=>r.id===e.id);need(k&&e.frameSha256===k.hashes.frame.sha256&&e.footerlessFrameSha256===k.hashes.footerlessFrame.sha256,'Active frame fingerprint mismatch '+e.id);for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg'])need(sha(KIT+'/'+k[key])===k.hashes[key].sha256,'Protected frame changed '+e.id+' '+key);for(const f of Object.values(e.files))need(sha('public'+f.src)===f.sha256,'Active image changed '+e.id);}
 return current;
}
function inventory(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(['node_modules','output','.venv','.pixeloe-runtime','__pycache__','.git'].includes(e.name))return[];const file=path.join(dir,e.name);if(e.isDirectory())return inventory(file);if(['package-manifest.json','package-checksums.sha256'].includes(e.name)||e.name.endsWith('.zip')||e.name.endsWith('.pyc'))return[];const bytes=fs.readFileSync(file);return[{path:path.relative(at(KIT),file).split(path.sep).join('/'),bytes:bytes.length,sha256:hash(bytes)}];});}
(async()=>{
 need(!fs.existsSync(at(OWN+'/backup/raster-metadata-manifest.json')),'Migration already applied; review backup rather than rerun');
 const catalog=load(LIB+'/catalog.json'),kit=load(KIT+'/data/cards.json'),registry=load('client/models/card-art-registry.json'),manifest=load('public/assets/cards/collection-v14/manifest.json'),active=load('artwork/cards/replacements/active.json');
 const oldCatalogSha=fingerprintChecks(catalog,kit,registry,manifest,active),before={catalog:structuredClone(catalog),kit:structuredClone(kit),registry:structuredClone(registry),manifest:structuredClone(manifest),active:structuredClone(active)};
 need(oldCatalogSha==='081a5ed0e0c66136bed59d4d2d63c4330e6b3270a7b96b164eba60a0ecc76f6c','Not the reviewed source catalogue baseline');
 const rows=catalog.assets.filter(r=>r.kind==='contribution'),ids=new Set(rows.map(r=>r.slug));need(rows.length===104,'Expected104 contributors');
 const cache=new Map(),byId=new Map();
 // Validate all header glyph bands before touching any project files.
 for(const row of rows){const p=LIB+'/qa/'+row.slug+'-overlay.png',r=await raw(fs.readFileSync(at(p))),old=header(r.data),key=hash(old);if(!cache.has(key))cache.set(key,shifted(old,row.slug));const pch=cache.get(key);byId.set(row.slug,pch);checks.push({id:row.slug,bands:pch.bands,newBands:pch.newBands,oldHeaderRgbaSha256:key,newHeaderRgbaSha256:hash(pch.after)});}
 need(cache.size===52,'Expected52 male/female shared headers');
 const preflight=[];
 for(const row of rows){const id=row.slug,k=kit.assets.find(r=>r.id===id),e=active.entries.find(r=>r.id===id),files=[LIB+'/'+row.export,LIB+'/qa/'+id+'-native.png',LIB+'/qa/'+id+'-reopened.png',LIB+'/qa/'+id+'-overlay.png',KIT+'/'+k.frame,KIT+'/'+k.footerlessFrame,'public/assets/cards/collection-v14/'+id+'.webp','public/assets/cards/collection-v14/'+id+'-footerless.webp'];if(fs.existsSync(at('public/assets/cards/bodyless-v1/'+id+'.webp')))files.push('public/assets/cards/bodyless-v1/'+id+'.webp');if(e)files.push('public'+e.files.full.src,'public'+e.files.footerless.src);
  for(const p of files){const r=await raw(fs.readFileSync(at(p)));need(r.info.width===W&&r.info.height===H&&header(r.data).equals(byId.get(id).before),'Preflight header mismatch '+p);preflight.push({file:p,sha256:sha(p)});}
  for(const p of [LIB+'/'+row.sourceSvg,LIB+'/'+row.overlaySvg,KIT+'/'+k.overlaySvg,KIT+'/'+k.footerlessOverlaySvg])shiftSvg(fs.readFileSync(at(p),'utf8'),id);
 }
 if(SCAN){const report={target:REPO,oldCatalogSha,contributors:rows.length,uniqueHeaders:cache.size,preflightRasterFiles:preflight.length,checks};const file=at(OWN+'/qa/band-scan.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,...report,checks:checks.filter(r=>['alexander-common-male','alexander-epic-male','cleomenes-uncommon-female'].includes(r.id))},null,2));return;}
 const designPath=LIB+'/source/frame-design.cjs',design=fs.readFileSync(at(designPath),'utf8');need(design.includes('const ty=leg?103.5+titleSize*.48:103+titleSize*.43;'),'Frame-design baseline differs');write(designPath,design.replace('const ty=leg?103.5+titleSize*.48:103+titleSize*.43;','const ty=leg?103.5+titleSize*.48:(parent?103:93)+titleSize*.43;').replace('leg?170:163,subtitleSize','leg?170:parent?163:171,subtitleSize'));
 const verification=load(KIT+'/data/verification.json'),hasBodyless=fs.existsSync(at('public/assets/cards/bodyless-v1/manifest.json')),bodyless=hasBodyless?load('public/assets/cards/bodyless-v1/manifest.json'):null;
 const bodyGenerator=hasBodyless?sha('scripts/build-card-bodyless-assets.mjs'):null,derivatives=[];
 for(const row of rows){encodingCache.clear();const id=row.slug,pch=byId.get(id),k=kit.assets.find(r=>r.id===id);
  for(const p of [LIB+'/'+row.sourceSvg,LIB+'/'+row.overlaySvg,KIT+'/'+k.overlaySvg,KIT+'/'+k.footerlessOverlaySvg])write(p,shiftSvg(fs.readFileSync(at(p),'utf8'),id));
  const full=await patch(LIB+'/'+row.export,pch);row.exportSha256=full.metadata.sha256;
  for(const suffix of ['-native.png','-reopened.png','-overlay.png'])await patch(LIB+'/qa/'+id+suffix,pch);
  await thumb(full.raw,LIB+'/'+row.thumbnail);
  const frames={};for(const key of ['frame','footerlessFrame']){frames[key]=await patch(KIT+'/'+k[key],pch);k.hashes[key]=frames[key].metadata;}
  // In dry-run SVG hashes come from the intended text edit, not unmodified disk.
  for(const key of ['overlaySvg','footerlessOverlaySvg'])k.hashes[key]={sha256:APPLY?sha(KIT+'/'+k[key]):hash(Buffer.from(shiftSvg(fs.readFileSync(at(KIT+'/'+k[key]),'utf8'),id)))};
  const base='public/assets/cards/collection-v14/'+id,pubFull=await patch(base+'.webp',pch),pubClean=await patch(base+'-footerless.webp',pch),pubThumb=await thumb(pubFull.raw,base+'-thumb.webp');
  const sourceThumb=await thumb(pubFull.raw,KIT+'/'+k.preview);k.hashes.preview=sourceThumb.metadata;
  const delivery=manifest.deliveries.find(r=>r.id===id);delivery.sourceSha256=row.exportSha256;
  for(const [name,item,suffix]of [['full',pubFull,'.webp'],['footerless',pubClean,'-footerless.webp'],['thumbnail',pubThumb,'-thumb.webp']])delivery[name]={...delivery[name],...item.metadata,src:'/assets/cards/collection-v14/'+id+suffix};
  const e=active.entries.find(r=>r.id===id);let runtimeFull=pubFull,runtimeClean=pubClean;
  if(e){const previous=structuredClone(e),newBase='public/assets/cards/subtitle-spacing-v1/'+id;runtimeFull=await patch('public'+e.files.full.src,pch,newBase+'.webp');runtimeClean=await patch('public'+e.files.footerless.src,pch,newBase+'-footerless.webp');const t=await thumb(runtimeFull.raw,newBase+'-thumb.webp');
   e.version='subtitle-spacing-v1';e.frameSha256=k.hashes.frame.sha256;e.footerlessFrameSha256=k.hashes.footerlessFrame.sha256;
   for(const [name,item,suffix]of [['full',runtimeFull,'.webp'],['footerless',runtimeClean,'-footerless.webp'],['thumbnail',t,'-thumb.webp']])e.files[name]={...item.metadata,src:'/assets/cards/subtitle-spacing-v1/'+id+suffix};
   for(const key of ['portrait','standardArt'])if(e.files[key]){const suffix=key==='portrait'?'-portrait.webp':'-standard-art.png',file=newBase+suffix;write(file,fs.readFileSync(at('public'+e.files[key].src)));e.files[key]={...e.files[key],src:'/assets/cards/subtitle-spacing-v1/'+id+suffix};}
   e.headerMigration={id:'subtitle-spacing-v1',previousVersion:previous.version,previousFrameSha256:previous.frameSha256,previousFooterlessFrameSha256:previous.footerlessFrameSha256,previousBundleSha256:previous.bundleSha256,previousKitManifestSha256:previous.kitManifestSha256,previousFiles:previous.files,portraitUnchanged:true,outsideHeaderChangedPixels:0};
  }
  const runtime=registry.assets.find(r=>r.id===id),canonical=manifest.assets.find(r=>r.id===id);runtime.sha256=runtimeFull.metadata.sha256;
  canonical.sha256=pubFull.metadata.sha256;canonical.src=delivery.full.src;canonical.footerlessSrc=delivery.footerless.src;canonical.thumbnailSrc=delivery.thumbnail.src;canonical.portraitSrc=delivery.portrait.src;delete canonical.artworkVersion;
  if(e){runtime.src=e.files.full.src;runtime.footerlessSrc=e.files.footerless.src;runtime.thumbnailSrc=e.files.thumbnail.src;runtime.portraitSrc=e.files.portrait.src;runtime.artworkVersion=e.version;}
  const v=verification.results.find(r=>r.id===id);v.frame={exactProductionPixels:true,rgbaSha256:delivery.full.rgbaSha256};v.footerlessFrame={exactProductionPixels:true,rgbaSha256:delivery.footerless.rgbaSha256};
  if(bodyless){const r=bodyless.assets.find(r=>r.id===id);need(r,'Missing bodyless '+id);const b=await patch('public'+r.src,pch);r.sha256=b.metadata.sha256;r.bytes=b.metadata.bytes;r.sourceSrc=e?e.files.footerless.src:delivery.footerless.src;r.sourceSha256=runtimeClean.metadata.sha256;const overlay=APPLY?fs.readFileSync(at(KIT+'/'+k.footerlessOverlaySvg)):Buffer.from(shiftSvg(fs.readFileSync(at(KIT+'/'+k.footerlessOverlaySvg),'utf8'),id));r.inputSha256=hash(Buffer.concat([Buffer.from(bodyGenerator+r.sourceSha256+JSON.stringify(r.bodyRemovalBounds)),overlay]));}
  derivatives.push({id,source:full.metadata,delivery,template:k,active:e?structuredClone(e):null,outsideHeaderChangedPixels:0});
  if(derivatives.length%10===0)console.log(JSON.stringify({completed:derivatives.length,total:104,apply:APPLY}));
 }
 for(const [key,after]of [['catalog',catalog],['kit',kit],['registry',registry],['manifest',manifest]]){const old=before[key];need(JSON.stringify(old.parentVariants)===JSON.stringify(after.parentVariants),'Parent variants changed '+key);for(const r of old.assets){const id=r.id||r.slug;if(!ids.has(id))need(JSON.stringify(r)===JSON.stringify(after.assets.find(n=>(n.id||n.slug)===id)),'Parent card changed '+key+' '+id);}}
 json(LIB+'/catalog.json',catalog);const catalogSha=hash(Buffer.from(JSON.stringify(catalog,null,2)+'\n'));
 for(const obj of [registry,manifest,active,kit])obj.sourceCatalogSha256=catalogSha;
 kit.sourceRegistrySha256=hash(Buffer.from(JSON.stringify(registry,null,2)+'\n'));kit.headerSpacingRevision='subtitle-spacing-v1';
 manifest.totalBytes=manifest.deliveries.reduce((n,r)=>n+r.full.bytes+r.footerless.bytes+r.thumbnail.bytes+r.portrait.bytes,0)+manifest.parentVariantDeliveries.reduce((n,r)=>n+r.footerless.bytes,0);
 json('client/models/card-art-registry.json',registry);json('public/assets/cards/collection-v14/manifest.json',manifest);json(KIT+'/data/cards.json',kit);
 const kitSha=hash(Buffer.from(JSON.stringify(kit,null,2)+'\n'));
 const bundle={schemaVersion:1,type:'everfolk-card-art-replacement',kitId:kit.id,kitManifestSha256:kitSha,exampleSerialsAreIssuedCopies:false,headerMigration:{id:'subtitle-spacing-v1',previousSourceCatalogSha256:oldCatalogSha,sourceCatalogSha256:catalogSha,headerMask:box,titleTranslationY:-10,subtitleTranslationY:8,protectedFrameValidationPassed:true,outsideHeaderChangedPixels:0,portraitImagesUnchanged:true},assets:active.entries.map(e=>{const files={};for(const [key,f]of Object.entries(e.files)){const {src,...descriptor}=f,name='webp/'+path.basename(src);write(OWN+'/bundle/'+name,activeBytes.get('public'+src)??fs.readFileSync(at('public'+src)));files[key]={path:name,...descriptor};}const {version,bundleSha256,kitManifestSha256,...entry}=e;return{...entry,files};})};
 const bundleBytes=Buffer.from(JSON.stringify(bundle,null,2)+'\n'),bundleSha=hash(bundleBytes);write(OWN+'/bundle/replacement.json',bundleBytes);write('public/assets/cards/subtitle-spacing-v1/header-migration.json',bundleBytes);
 for(const e of active.entries){e.kitManifestSha256=kitSha;e.bundleSha256=bundleSha;}
 json('public/assets/cards/subtitle-spacing-v1/manifest.json',{schemaVersion:1,version:'subtitle-spacing-v1',bundleSha256:bundleSha,bundleSrc:'/assets/cards/subtitle-spacing-v1/header-migration.json',kitManifestSha256:kitSha,cards:active.entries.map(e=>e.id),installed:true,explicitProtectedHeaderMigration:true,identityCopyRanksAndEditionCapsUnchanged:true,portraitImagesUnchanged:true,entries:active.entries});
 json('artwork/cards/replacements/active.json',active);verification.headerSpacingRevision='subtitle-spacing-v1';json(KIT+'/data/verification.json',verification);
 if(bodyless){bodyless.totalBytes=bodyless.assets.reduce((n,r)=>n+r.bytes,0);json('public/assets/cards/bodyless-v1/manifest.json',bodyless);}
 if(APPLY){const pkg=load(KIT+'/package-manifest.json'),files=inventory(at(KIT)).sort((a,b)=>a.path.localeCompare(b.path));pkg.kitManifestSha256=kitSha;pkg.totalBytes=files.reduce((n,r)=>n+r.bytes,0);pkg.files=files;json(KIT+'/package-manifest.json',pkg);write(KIT+'/package-checksums.sha256',files.map(f=>f.sha256+'  '+f.path).join('\n')+'\n');}
 const report={schemaVersion:1,id:'subtitle-spacing-v1',applied:APPLY,target:REPO,oldSourceCatalogSha256:oldCatalogSha,sourceCatalogSha256:catalogSha,oldKitManifestSha256:hash(Buffer.from(JSON.stringify(before.kit,null,2)+'\n')),kitManifestSha256:kitSha,contributors:104,uniqueHeaders:52,headerMask:box,titleTranslationY:-10,subtitleTranslationY:8,outsideHeaderChangedPixels:0,portraitImagesUnchanged:true,parentCardsUnchanged:true,parentVariantsUnchanged:true,retainedWorldsUnchanged:true,activeVersionsMigrated:active.entries.map(e=>e.id),files:records,checks};
 const reportName=APPLY?'migration-applied.json':'migration-dry-run.json';const reportFile=at(OWN+'/qa/'+reportName);fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 if(APPLY){fs.writeFileSync(at(OWN+'/backup/raster-metadata-manifest.json'),JSON.stringify({schemaVersion:1,oldSourceCatalogSha256:oldCatalogSha,files:records.filter(r=>r.beforeSha256).map(r=>({file:r.file,sha256:r.beforeSha256}))},null,2)+'\n');fs.writeFileSync(at(OWN+'/qa/derivatives.json'),JSON.stringify(derivatives,null,2)+'\n');}
 console.log(JSON.stringify({applied:APPLY,contributors:104,uniqueHeaders:52,files:records.length,sourceCatalogSha256:catalogSha,kitManifestSha256:kitSha,outsideHeaderChangedPixels:0}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
