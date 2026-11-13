const {fs,path,ROOT,REPO,OWN,LIB,KIT,at,old,load,hash,need,definitions,json}=require('./common.cjs');
const fitBaseline=require('./fit-report-baseline.cjs');
const migration=load(path.join(ROOT,'qa/migration-finalized.json')),ids=migration.changedCards,files=new Set();
for(const id of ids){const row=load(at(LIB+'/catalog.json')).assets.find(r=>r.slug===id),k=load(at(KIT+'/data/cards.json')).assets.find(r=>r.id===id);
 for(const p of [row.sourceSvg,row.overlaySvg,row.fittedArt,row.export,row.master,row.thumbnail,`qa/${id}-native.json`,`qa/${id}-native.png`,`qa/${id}-reopened.png`,`qa/${id}-overlay.png`,`qa/${id}-fit.json`])files.add(LIB+'/'+p);
 // Protected frames are unchanged but remain guarded as rendering inputs.
 for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg','sourcePortrait','preview'])files.add(KIT+'/'+k[key]);
 files.add(KIT+'/briefs/'+id+'.md');
 for(const suffix of ['.webp','-footerless.webp','-thumb.webp','-portrait.webp'])files.add('public/assets/cards/collection-v14/'+id+suffix);
 files.add('public/assets/cards/bodyless-v1/'+id+'.webp');files.add(row.sourceArt);
}
files.add('public/assets/cards/bodyless-v1/manifest.json');
for(const p of [LIB+'/source/card-copy.json',LIB+'/source/framing-map.json',LIB+'/source/build-map.cjs',LIB+'/catalog.json'])files.add(p);
function tree(relative){const dir=at(relative);if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=relative+'/'+e.name;if(e.isDirectory())tree(p);else if(p!==OWN+'/qa/portable-release.json'&&!p.includes('/qa/wsl/'))files.add(p);}}
for(const folder of ['source','assets','references','qa'])tree(OWN+'/'+folder);
files.add(OWN+'/backup/'+KIT+'/data/cards.json');if(fs.existsSync(path.join(ROOT,'README.md')))files.add(OWN+'/README.md');
const entries=[...files].sort().map(file=>{const bytes=fs.readFileSync(at(file)),previous=fs.existsSync(old(file))?fs.readFileSync(old(file)):null;return{file,sha256:hash(bytes),bytes:bytes.length,beforeSha256:previous?hash(previous):null,...(previous&&ids.some(id=>file===LIB+'/qa/'+id+'-fit.json')?fitBaseline.descriptor(file,ids,previous):{}),...(/\.(?:json|svg|md|cjs|mjs|ts|html|css|txt|sha256)$/.test(file)?{normalizedBeforeSha256:previous?hash(Buffer.from(previous.toString('utf8').replace(/\r\n/g,'\n'))):null}:{}),optionalBodyless:file.startsWith('public/assets/cards/bodyless-v1/')};});
const release={schemaVersion:1,id:'everfolk-work-gaze-review-v1',changedCards:ids,newArtwork:ids,oldSourceCatalogSha256:migration.oldSourceCatalogSha256,sourceCatalogSha256:migration.sourceCatalogSha256,acceptedOldKitManifestSha256:[migration.oldKitManifestSha256],windowsKitManifestSha256:migration.kitManifestSha256,targetGeneratedReports:[LIB+'/qa/collection-verification.json',LIB+'/qa/editorial-review.json'],files:entries,metadataPolicy:'Art-only selected records; preserve all card copy, native frame bytes, target unselected/parent rows and active override entries. Global QA reports are regenerated in the target.',retainedWorldsUnchanged:true};
json(path.join(ROOT,'qa/portable-release.json'),release);
const artifact=at('artifacts/work-gaze-review-v1');fs.mkdirSync(artifact,{recursive:true});fs.writeFileSync(path.join(artifact,'transfer-paths.txt'),[...entries.map(f=>f.file),OWN+'/qa/portable-release.json'].join('\n')+'\n');
console.log(JSON.stringify({files:entries.length,bytes:entries.reduce((n,f)=>n+f.bytes,0),changedCards:ids,transferList:'artifacts/work-gaze-review-v1/transfer-paths.txt'}));
