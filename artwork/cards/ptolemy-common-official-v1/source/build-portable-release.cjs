const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),REPO=path.resolve(ROOT,'../../..'),BACKUP=path.join(ROOT,'backup');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const migration=load(path.join(ROOT,'qa/migration-finalized.json')),backup=load(path.join(BACKUP,'backup-manifest.json'));
const LIB='artwork/cards/framed-collection-v14',KIT='artwork/card-art-handoff-v1';
const ids=migration.changedCards,files=new Set();
for(const id of ids){const row=load(path.join(REPO,LIB,'catalog.json')).assets.find(r=>r.slug===id),kit=load(path.join(REPO,KIT,'data/cards.json')).assets.find(r=>r.id===id);
 files.add('public/assets/cards/bodyless-v1/manifest.json');
for(const p of [row.sourceSvg,row.overlaySvg,row.fittedArt,row.export,row.master,row.thumbnail,`qa/${id}-native.json`,`qa/${id}-native.png`,`qa/${id}-reopened.png`,`qa/${id}-overlay.png`,`qa/${id}-fit.json`])files.add(LIB+'/'+p);
 for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg','sourcePortrait','preview'])files.add(KIT+'/'+kit[key]);
 files.add(KIT+'/briefs/'+id+'.md');
 for(const suffix of ['.webp','-footerless.webp','-thumb.webp','-portrait.webp'])files.add('public/assets/cards/collection-v14/'+id+suffix);
 files.add('public/assets/cards/bodyless-v1/'+id+'.webp');
 if(migration.newArtwork.includes(id))files.add(row.sourceArt);
}
for(const p of ['chain/catalog/figure-contribution-copy.ts','test/figure-card-requirements.test.ts','test/figure-contribution-ui.test.ts','scripts/prepare-card-art-kit.mjs',LIB+'/source/card-copy.json',LIB+'/source/framing-map.json',LIB+'/catalog.json',LIB+'/review/index.html',KIT+'/data/cards.csv',KIT+'/reference/index.html'])files.add(p);
const own='artwork/cards/ptolemy-common-official-v1';
function includeTree(relative){const folder=path.join(REPO,relative);if(!fs.existsSync(folder))return;for(const item of fs.readdirSync(folder,{withFileTypes:true})){const child=relative+'/'+item.name;if(item.isDirectory())includeTree(child);else if(child!==own+'/qa/portable-release.json')files.add(child);}}
for(const folder of ['source','assets','references','qa'])includeTree(own+'/'+folder);
files.add(own+'/backup/'+KIT+'/data/cards.json');
includeTree(own+'/backup/bundle-kit-'+migration.oldKitManifestSha256.slice(0,12));
if(fs.existsSync(path.join(ROOT,'README.md')))files.add(own+'/README.md');
const entries=[...files].sort().map(file=>{const b=fs.readFileSync(path.join(REPO,file)),previous=backup.files.find(f=>f.file===file),old=fs.existsSync(path.join(BACKUP,file))?fs.readFileSync(path.join(BACKUP,file)):null;return{file,sha256:hash(b),bytes:b.length,beforeSha256:old?hash(old):null,...(/\.(?:json|svg|md|cjs|mjs|ts|html|css|txt|sha256)$/.test(file)?{normalizedBeforeSha256:old?hash(Buffer.from(old.toString('utf8').replace(/\r\n/g,'\n'))):null}:{}),optionalBodyless:file.startsWith('public/assets/cards/bodyless-v1/')};});

const release={schemaVersion:1,id:'everfolk-ptolemy-common-official-v1',changedCards:ids,newArtwork:migration.newArtwork,oldSourceCatalogSha256:migration.oldSourceCatalogSha256,sourceCatalogSha256:migration.sourceCatalogSha256,acceptedOldKitManifestSha256:[migration.oldKitManifestSha256],windowsKitManifestSha256:migration.kitManifestSha256,targetGeneratedReports:[LIB+'/qa/collection-verification.json',LIB+'/qa/editorial-review.json'],files:entries,metadataPolicy:'Patch only selected card/template/delivery records; preserve target parent variants and active override records. Rebase source catalogue fingerprint only after protected-frame verification.',retainedWorldsUnchanged:true};
fs.writeFileSync(path.join(ROOT,'qa/portable-release.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify({files:entries.length,bytes:entries.reduce((n,f)=>n+f.bytes,0),changedCards:ids.length,acceptedOldKitManifestSha256:release.acceptedOldKitManifestSha256}));
