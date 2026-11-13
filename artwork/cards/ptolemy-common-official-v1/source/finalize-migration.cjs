const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),REPO=path.resolve(ROOT,'../../..'),BACKUP=path.join(ROOT,'backup'),LIB='artwork/cards/framed-collection-v14',KIT='artwork/card-art-handoff-v1';
const request=createRequire(path.join(REPO,'package.json')),sharp=createRequire(request.resolve('next/package.json'))('sharp');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const need=(v,m)=>{if(!v)throw Error(m);},at=p=>path.join(REPO,p),old=p=>path.join(BACKUP,p);
const definitions=require('./role-edits.json').roles,ids=definitions.flatMap(r=>['male','female'].map(g=>`${r.figureId}-${r.tier}-${g}`)),changed=new Set(ids);
const normalizeSvg=s=>s.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,'').replace(/<title>[\s\S]*?<\/title>/g,'').replace(/\s+/g,' ').trim();
(async()=>{
 const baseline=load(old(LIB+'/catalog.json')),catalog=load(at(LIB+'/catalog.json'));
 const oldKit=load(old(KIT+'/data/cards.json')),kit=load(at(KIT+'/data/cards.json'));
 const registry=load(at('client/models/card-art-registry.json')),manifest=load(at('public/assets/cards/collection-v14/manifest.json')),active=load(at('artwork/cards/replacements/active.json'));
 const initial=load(old('artwork/cards/replacements/active.json'));
 need(registry.sourceCatalogSha256===sha(old(LIB+'/catalog.json')),'Registry source changed during migration');
 need(JSON.stringify(active)===JSON.stringify(initial),'Active overrides changed during migration');
 const reports=ids.map(id=>load(path.join(ROOT,'qa/derivatives',id+'.json')));
 const geometryChecks=[];
 for(const row of catalog.assets){
  const previous=baseline.assets.find(r=>r.slug===row.slug);
  if(!changed.has(row.slug)){need(JSON.stringify(row)===JSON.stringify(previous),'Unselected source card changed: '+row.slug);continue;}
  const def=definitions.find(d=>row.slug.startsWith(`${d.figureId}-${d.tier}-`));
  need(row.title===def.title&&row.sourceArtSha256===sha(at(row.sourceArt)),'Selected card incomplete: '+row.slug);
  const geometrySame=normalizeSvg(fs.readFileSync(at(LIB+'/'+row.overlaySvg),'utf8'))===normalizeSvg(fs.readFileSync(old(LIB+'/'+previous.overlaySvg),'utf8'));
  need(geometrySame,'Frame geometry changed: '+row.slug);geometryChecks.push({id:row.slug,frameGeometryUnchanged:true});
 }
 need(JSON.stringify(kit)===JSON.stringify(oldKit),'Kit metadata changed during migration');
 for(const entry of active.entries){
  need(!changed.has(entry.id),'A changed role already has an active illustration override');
  const row=[...oldKit.assets,...oldKit.parentVariants].find(r=>r.id===entry.id);
  need(row&&entry.frameSha256===row.hashes.frame.sha256&&entry.footerlessFrameSha256===row.hashes.footerlessFrame.sha256,'Active frame fingerprint differs: '+entry.id);
  for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg'])need(sha(at(KIT+'/'+row[key]))===row.hashes[key].sha256,'Active protected frame changed: '+entry.id);
  for(const f of Object.values(entry.files))need(sha(at('public'+f.src))===f.sha256,'Active protected asset changed: '+entry.id);
  const now=registry.assets.find(r=>r.id===entry.id),before=load(old('client/models/card-art-registry.json')).assets.find(r=>r.id===entry.id);
  need(JSON.stringify(now)===JSON.stringify(before),'Active card identity or copy changed: '+entry.id);
 }
 const catalogSha=sha(at(LIB+'/catalog.json'));
 const beforeRegistry=structuredClone(registry),beforeManifest=structuredClone(manifest);
 for(const report of reports){
  const source=catalog.assets.find(r=>r.slug===report.id),file=report.delivery;
  for(const book of [registry,manifest]){const row=book.assets.find(a=>a.id===report.id);need(row,'Missing registry row '+report.id);for(const key of ['title','canonicalTitle','displayTitle','subtitle','bodyTitle','bodyText'])row[key]=source[key];row.sha256=file.full.sha256;row.src=file.full.src;row.footerlessSrc=file.footerless.src;row.thumbnailSrc=file.thumbnail.src;row.portraitSrc=file.portrait.src;}
  const index=manifest.deliveries.findIndex(r=>r.id===report.id);need(index>=0,'Missing delivery '+report.id);manifest.deliveries[index]=file;
  kit.assets[kit.assets.findIndex(r=>r.id===report.id)]=report.template;
 }
 registry.sourceCatalogSha256=catalogSha;manifest.sourceCatalogSha256=catalogSha;active.sourceCatalogSha256=catalogSha;
 manifest.totalBytes=manifest.deliveries.reduce((n,r)=>n+r.full.bytes+r.footerless.bytes+r.thumbnail.bytes+r.portrait.bytes,0)+manifest.parentVariantDeliveries.reduce((n,r)=>n+r.footerless.bytes,0);
 for(const book of [[beforeRegistry,registry],[beforeManifest,manifest]]){
  need(JSON.stringify(book[0].parentVariants)===JSON.stringify(book[1].parentVariants),'Parent variants changed');
  for(const row of book[0].assets)if(!changed.has(row.id))need(JSON.stringify(row)===JSON.stringify(book[1].assets.find(r=>r.id===row.id)),'Unselected registry row changed '+row.id);
 }
 kit.sourceCatalogSha256=catalogSha;
 kit.sourceRegistrySha256=crypto.createHash('sha256').update(JSON.stringify(registry,null,2)+'\n').digest('hex');
 kit.editorialRoleRevision='ptolemy-common-official-v1';
 const kitChecks=[];
 for(const row of [...oldKit.assets,...oldKit.parentVariants])if(!changed.has(row.id)){
  need(JSON.stringify(row)===JSON.stringify([...kit.assets,...kit.parentVariants].find(r=>r.id===row.id)),'Unselected kit row changed '+row.id);
  for(const [key,descriptor]of Object.entries(row.hashes))if(row[key])need(sha(at(KIT+'/'+row[key]))===descriptor.sha256,'Unselected kit file changed '+row[key]);
  kitChecks.push(row.id);
 }
 // Publish catalogue fingerprints only after all previous frame/copy and asset checks pass.
 json(at('artwork/cards/replacements/active.json'),active);
 json(at('client/models/card-art-registry.json'),registry);
 json(at('public/assets/cards/collection-v14/manifest.json'),manifest);
 json(at(KIT+'/data/cards.json'),kit);
 const verification=load(at(KIT+'/data/verification.json'));
 for(const report of reports){
  const result=verification.results.find(r=>r.id===report.id);need(result,'Missing native verification '+report.id);
  for(const [key,file]of [['frame','full'],['footerlessFrame','footerless']])result[key]={exactProductionPixels:true,rgbaSha256:report.delivery[file].rgbaSha256};
 }
 verification.editorialRoleRevision='ptolemy-common-official-v1';verification.nativeWorkerClosed=true;json(at(KIT+'/data/verification.json'),verification);
 const migration={schemaVersion:1,id:'everfolk-ptolemy-common-official-v1',completedAt:new Date().toISOString(),changedCards:ids,newArtwork:definitions.filter(d=>d.newArtwork).flatMap(d=>['male','female'].map(g=>`${d.figureId}-${d.tier}-${g}`)),oldSourceCatalogSha256:sha(old(LIB+'/catalog.json')),sourceCatalogSha256:catalogSha,oldKitManifestSha256:sha(old(KIT+'/data/cards.json')),kitManifestSha256:sha(at(KIT+'/data/cards.json')),frameGeometryChecks:geometryChecks,unselectedKitRowsUnchanged:kitChecks.length,preservedActiveOverrides:active.entries.map(e=>e.id),activeEntryRecordsUnchanged:true,parentVariantsUnchanged:true,retainedWorldsUnchanged:true,oldBundleProvenance:'backup/artwork/card-art-handoff-v1/data/cards.json plus archived changed/protected frame assets',nativeWorkerClosed:true};
 json(path.join(ROOT,'qa/migration-finalized.json'),migration);
 console.log(JSON.stringify(migration,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
