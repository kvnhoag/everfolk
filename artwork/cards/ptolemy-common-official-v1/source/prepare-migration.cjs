const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),REPO=path.resolve(ROOT,'../../..'),BACKUP=path.join(ROOT,'backup');
const edits=require('./role-edits.json').roles;
const ids=edits.flatMap(r=>['male','female'].map(g=>`${r.figureId}-${r.tier}-${g}`));
const load=p=>JSON.parse(fs.readFileSync(path.join(REPO,p),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const manifest=path.join(BACKUP,'backup-manifest.json');
if(fs.existsSync(manifest))throw Error('Migration backup already exists; do not replace the approved originals');
const kit=load('artwork/card-art-handoff-v1/data/cards.json');
const cat=load('artwork/cards/framed-collection-v14/catalog.json');
const active=load('artwork/cards/replacements/active.json');
const registry=load('client/models/card-art-registry.json');
if(sha(path.join(REPO,'artwork/cards/framed-collection-v14/catalog.json'))!==registry.sourceCatalogSha256||active.sourceCatalogSha256!==registry.sourceCatalogSha256)throw Error('Baseline catalogue fingerprints differ');
const files=new Set(["artwork/cards/framed-collection-v14/source/frame-design.cjs","artwork/cards/framed-collection-v14/review/index.html","scripts/prepare-card-art-kit.mjs",'artwork/cards/framed-collection-v14/source/card-copy.json','artwork/cards/framed-collection-v14/source/framing-map.json','artwork/cards/framed-collection-v14/catalog.json','artwork/cards/framed-collection-v14/qa/collection-verification.json','artwork/cards/framed-collection-v14/qa/editorial-review.json','client/models/card-art-registry.json','public/assets/cards/collection-v14/manifest.json','public/assets/cards/bodyless-v1/manifest.json','artwork/cards/replacements/active.json','artwork/card-art-handoff-v1/data/cards.json','artwork/card-art-handoff-v1/data/native-verification.json','artwork/card-art-handoff-v1/package-manifest.json','artwork/card-art-handoff-v1/data/verification.json','artwork/card-art-handoff-v1/package-checksums.sha256','artwork/card-art-handoff-v1/data/cards.csv','artwork/card-art-handoff-v1/reference/index.html']);
for(const id of ids){files.add('artwork/card-art-handoff-v1/briefs/'+id+'.md');
 const row=cat.assets.find(r=>r.slug===id),k=kit.assets.find(r=>r.id===id);
 if(!row||!k)throw Error('Missing changed card '+id);
 for(const name of [row.sourceSvg,row.overlaySvg,row.fittedArt,row.export,row.master,row.thumbnail,`qa/${id}-native.json`,`qa/${id}-native.png`,`qa/${id}-reopened.png`,`qa/${id}-overlay.png`,`qa/${id}-fit.json`])files.add('artwork/cards/framed-collection-v14/'+name);
 for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg','sourcePortrait','preview'])files.add('artwork/card-art-handoff-v1/'+k[key]);
 for(const suffix of ['.webp','-footerless.webp','-thumb.webp','-portrait.webp'])files.add('public/assets/cards/collection-v14/'+id+suffix);
 files.add('public/assets/cards/bodyless-v1/'+id+'.webp');
}
const records=[];
for(const file of files){const source=path.join(REPO,file);if(!fs.existsSync(source)){records.push({file,missing:true});continue;}const target=path.join(BACKUP,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);records.push({file,sha256:sha(source),bytes:fs.statSync(source).size});}
json(manifest,{schemaVersion:1,id:'everfolk-role-progression-before-v1',createdAt:new Date().toISOString(),changedCards:ids,sourceCatalogSha256:registry.sourceCatalogSha256,kitManifestSha256:sha(path.join(REPO,'artwork/card-art-handoff-v1/data/cards.json')),files:records});
const copy=load('artwork/cards/framed-collection-v14/source/card-copy.json'),map=load('artwork/cards/framed-collection-v14/source/framing-map.json');
for(const edit of edits){const target=copy.figures.find(f=>f.figureId===edit.figureId).roles[edit.tier];target.sourceArtRoot='artwork/cards/ptolemy-common-official-v1/assets';target.newArt=true;target.editorialRoleRevision='ptolemy-common-official-v1';for(const key of ['title','displayTitle','subtitle','bodyTitle','bodyText','sceneBrief'])target[key]=edit[key];
 for(const gender of ['male','female']){const id=`${edit.figureId}-${edit.tier}-${gender}`,row=map.assets.find(r=>r.slug===id);for(const key of ['title','displayTitle','subtitle','bodyTitle','bodyText','sceneBrief'])row[key]=edit[key];row.canonicalTitle=edit.title;row.editorialRoleRevision='ptolemy-common-official-v1';if(edit.newArtwork){row.sourceArt=`artwork/cards/ptolemy-common-official-v1/assets/${id}-pixel.png`;row.newArt=true;}}
}
json(path.join(REPO,'artwork/cards/framed-collection-v14/source/card-copy.json'),copy);
json(path.join(REPO,'artwork/cards/framed-collection-v14/source/framing-map.json'),map);
json(path.join(ROOT,'qa/migration-prepared.json'),{prepared:true,changedCards:ids,retainedWorldsUnchanged:true,backup:'backup/backup-manifest.json',newArtwork:edits.filter(r=>r.newArtwork).flatMap(r=>['male','female'].map(g=>`${r.figureId}-${r.tier}-${g}`))});
console.log(JSON.stringify({prepared:true,backupFiles:records.length,changedCards:ids.length,readyCopyOnly:ids.filter(id=>!edits.find(r=>id.startsWith(`${r.figureId}-${r.tier}-`)).newArtwork)}));
