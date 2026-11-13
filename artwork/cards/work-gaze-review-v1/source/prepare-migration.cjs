const {fs,path,ROOT,OWN,LIB,KIT,at,old,load,sha,need,json,definitions}=require('./common.cjs');
const edits=definitions(),ids=edits.map(e=>e.id),catalog=load(at(LIB+'/catalog.json')),kit=load(at(KIT+'/data/cards.json'));
need(new Set(ids).size===ids.length&&ids.length>0,'Expected unique selected IDs');
const active=load(at('artwork/cards/replacements/active.json')),registry=load(at('client/models/card-art-registry.json'));
need(sha(at(LIB+'/catalog.json'))===registry.sourceCatalogSha256&&active.sourceCatalogSha256===registry.sourceCatalogSha256,'Baseline catalogue fingerprints disagree');
need(!fs.existsSync(path.join(ROOT,'backup/backup-manifest.json')),'Do not overwrite approved backup');
const files=new Set([LIB+'/source/card-copy.json',LIB+'/source/framing-map.json',LIB+'/source/build-map.cjs',LIB+'/catalog.json','client/models/card-art-registry.json','public/assets/cards/collection-v14/manifest.json','public/assets/cards/bodyless-v1/manifest.json','artwork/cards/replacements/active.json',KIT+'/data/cards.json',KIT+'/data/verification.json',KIT+'/package-manifest.json',KIT+'/package-checksums.sha256']);
for(const edit of edits){
 const row=catalog.assets.find(r=>r.slug===edit.id),k=kit.assets.find(r=>r.id===edit.id);
 need(row?.kind==='contribution'&&k,'Unknown contribution '+edit.id);
 need(!active.entries.some(e=>e.id===edit.id),'Selected card has an active override; review it explicitly '+edit.id);
 need(fs.existsSync(at(edit.sourceArt)),'Missing approved art '+edit.sourceArt);
 for(const p of [row.sourceSvg,row.overlaySvg,row.fittedArt,row.export,row.master,row.thumbnail,`qa/${edit.id}-native.json`,`qa/${edit.id}-native.png`,`qa/${edit.id}-reopened.png`,`qa/${edit.id}-overlay.png`,`qa/${edit.id}-fit.json`])files.add(LIB+'/'+p);
 for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg','sourcePortrait','preview'])files.add(KIT+'/'+k[key]);
 files.add(KIT+'/briefs/'+edit.id+'.md');
 for(const suffix of ['.webp','-footerless.webp','-thumb.webp','-portrait.webp'])files.add('public/assets/cards/collection-v14/'+edit.id+suffix);
 files.add('public/assets/cards/bodyless-v1/'+edit.id+'.webp');
}
const records=[];
for(const p of files){if(!fs.existsSync(at(p))){records.push({file:p,missing:true});continue;}fs.mkdirSync(path.dirname(old(p)),{recursive:true});fs.copyFileSync(at(p),old(p),fs.constants.COPYFILE_EXCL);records.push({file:p,sha256:sha(at(p)),bytes:fs.statSync(at(p)).size});}
json(path.join(ROOT,'backup/backup-manifest.json'),{schemaVersion:1,id:'everfolk-work-gaze-before-v1',changedCards:ids,sourceCatalogSha256:registry.sourceCatalogSha256,kitManifestSha256:sha(at(KIT+'/data/cards.json')),files:records});
const copy=load(at(LIB+'/source/card-copy.json')),map=load(at(LIB+'/source/framing-map.json'));
for(const edit of edits){const row=map.assets.find(r=>r.slug===edit.id),role=copy.figures.find(f=>f.figureId===row.figureId).roles[row.tier];
 role.sourceArtByGender={...role.sourceArtByGender,[row.gender]:edit.sourceArt};
 role.sceneBriefByGender={...role.sceneBriefByGender,[row.gender]:edit.sceneBrief};
 row.sourceArt=edit.sourceArt;row.sceneBrief=edit.sceneBrief;row.newArt=true;row.artRevision='work-gaze-review-v1';
}
let generator=fs.readFileSync(at(LIB+'/source/build-map.cjs'),'utf8');
need(generator.includes("const art=copy.sourceArtRoot?"),'Unexpected build-map source');
generator=generator.replace("const art=copy.sourceArtRoot?","const override=copy.sourceArtByGender?.[gender];\n  const art=override|| (copy.sourceArtRoot?")
 .replace("'artwork/cards/figure-inner-art-v14/assets/'+slug+'-pixel.png';","'artwork/cards/figure-inner-art-v14/assets/'+slug+'-pixel.png');")
 .replace("assets.push({...common,...copy,slug,kind:'contribution'","assets.push({...common,...copy,...(override?{newArt:true,artRevision:override.split('/')[2]}:{}),...(copy.sceneBriefByGender?.[gender]?{sceneBrief:copy.sceneBriefByGender[gender]}:{}),slug,kind:'contribution'")
 .replace("raritySource:copy.newArt?","raritySource:override||copy.newArt?")
 .replace("Object.values(f.roles).filter(r=>r.newArt).length*2","Object.values(f.roles).reduce((n,r)=>n+['male','female'].filter(g=>r.newArt||r.sourceArtByGender?.[g]).length,0)");
need(generator.includes('sourceArtByGender')&&generator.includes('sceneBriefByGender'),'Per-gender override support missing');
fs.writeFileSync(at(LIB+'/source/build-map.cjs'),generator);
json(at(LIB+'/source/card-copy.json'),copy);json(at(LIB+'/source/framing-map.json'),map);
json(path.join(ROOT,'qa/migration-prepared.json'),{prepared:true,changedCards:ids,backupFiles:records.length,copyAndTitlesUnchanged:true});
console.log(JSON.stringify({prepared:true,changedCards:ids,backupFiles:records.length}));
