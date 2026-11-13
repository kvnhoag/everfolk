import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const old=JSON.parse(fs.readFileSync(path.resolve(root,'../figure-inner-art-v11/catalog.json'),'utf8'));
const reuse=new Map(JSON.parse(fs.readFileSync(path.join(root,'reuse-manifest.json'),'utf8')).assets.map(a=>[a.slug,a]));
const worker=new Map();
for(const file of ['scholarly-manifest.json','craft-civic-manifest.json','command-service-manifest.json']){
 const p=path.join(root,file);if(fs.existsSync(p))for(const a of JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')).assets)worker.set(a.slug,a);
}
const expected=[];
for(const a of old.assets){
 if(a.kind==='parent')expected.push({slug:a.slug,roleId:a.slug,figureId:a.figureId,figureName:a.figureName,title:a.title,kind:'parent',tier:null,gender:'male',desiredViewAngle:null,collection:a.collection});
 else for(const gender of ['male','female']){
  const desiredViewAngle=a.kind==='title'?(gender==='male'?'Three-quarter':a.figureId==='nearchus'?'Left profile':'Frontal'):a.tier==='uncommon'?'Frontal':a.tier==='rare'?'Left profile':'Three-quarter';
  expected.push({slug:a.slug+'-'+gender,roleId:a.slug,figureId:a.figureId,figureName:a.figureName,title:a.title,kind:a.kind,tier:a.tier,gender,contributorId:a.figureId+'-player-'+gender,desiredViewAngle,collection:a.collection});
 }
}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pngSize=p=>{const b=fs.readFileSync(p);if(b.subarray(1,4).toString()!=='PNG')throw Error('Invalid PNG: '+p);return [b.readUInt32BE(16),b.readUInt32BE(20)]};
const failures=[];
const assets=expected.map(a=>{
 const files={source:'source/'+a.slug+'.png',prompt:'prompts/'+a.slug+'.txt',final:'assets/'+a.slug+'-pixel.png',qa:'qa/'+a.slug+'-pixel.json',coarse:'assets/'+a.slug+'-coarse.png',coarseQa:'qa/'+a.slug+'-coarse.json',faceConfig:'source/'+a.slug+'-face.json'};
 const missing=Object.values(files).filter(p=>!fs.existsSync(path.join(root,p)));
 if(missing.length)return {...a,...files,status:'pending',missing};
 try{
  const q=JSON.parse(fs.readFileSync(path.join(root,files.qa),'utf8').replace(/^\uFEFF/,''));
  const c=JSON.parse(fs.readFileSync(path.join(root,files.coarseQa),'utf8').replace(/^\uFEFF/,''));
  const sourceSha256=hash(path.join(root,files.source)),finalSha256=hash(path.join(root,files.final)),coarseSha256=hash(path.join(root,files.coarse));
  const size=pngSize(path.join(root,files.final));
  const ok=q.sourceSha256===sourceSha256&&q.outputSha256===finalSha256&&q.baseSha256===coarseSha256&&c.outputSha256===coarseSha256
    &&q.baseQaSha256===hash(path.join(root,files.coarseQa))&&q.configSha256===hash(path.join(root,files.faceConfig))
    &&size[0]===840&&size[1]===1050&&q.basePixelSize===3&&q.detailPixelSize===2
    &&q.outsideMaskChangedPixels===0&&q.selectedDetailDifferingPixels===0&&q.deterministic===true&&q.pngReadbackExact===true
    &&q.sourceUnchanged===true&&q.baseUnchanged===true&&q.registeredExactIntegerBlocks===true&&q.wholeCommonCells===true
    &&q.interpolatingUpscale===false&&c.sourceSha256===sourceSha256&&c.sourceUnchanged===true&&c.deterministic===true&&c.exactIntegerBlocks===true;
  if(!ok)throw Error('Source/filter/hash verification failed');
  const r=reuse.get(a.slug),w=worker.get(a.slug);
  if(r){const original=old.assets.find(x=>x.slug===r.originalSlug);if(!original||original.sourceSha256!==sourceSha256||original.finalSha256!==finalSha256)throw Error('Retained image bytes differ from the approved source library');}
  return {...a,...files,status:'complete',sourceSize:pngSize(path.join(root,files.source)),finalSize:size,sourceSha256,finalSha256,faceRegions:q.config.regions,
   origin:r?{method:'Reused unchanged',library:r.sourceLibrary,originalSlug:r.originalSlug}:{method:'Built-in image generation/edit'},
   contributorAngleReview:w?.viewAngle??(r&&a.kind!=='parent'?'Retained three-quarter scene':null),
   provenance:a.kind==='parent'?'Named historical figure; imaginative depiction.':`${a.gender} representative player contributor; not the named historical figure.`};
 }catch(e){failures.push({slug:a.slug,error:e.message});return {...a,...files,status:'failed',error:e.message}}
});
const complete=assets.filter(a=>a.status==='complete');
const uniqueSources=new Set(complete.map(a=>a.sourceSha256)).size,uniqueFinals=new Set(complete.map(a=>a.finalSha256)).size;
if(uniqueSources!==complete.length||uniqueFinals!==complete.length)failures.push({slug:'library',error:'Duplicate images across distinct slots'});
const roles=[...new Set(assets.filter(a=>a.kind!=='parent').map(a=>a.roleId))];
const pairedRoles=roles.filter(id=>['male','female'].every(g=>complete.some(a=>a.roleId===id&&a.gender===g))).length;
const catalogue={libraryId:'everfolk-figure-inner-art-v12',date:'2026-11-13',expected:83,complete:complete.length,parentCount:13,subcardRoleCount:35,subcardVariantCount:70,pairedRoles,
 scope:'13 named main figures; each of 35 player contribution/title roles has both male and female variants. Frontal, profile and three-quarter face angles vary across core progressions.',
 revisions:['Ptolemy main arm routing corrected','Both genders provided per subcard role','Varied subcard face angles throughout all core figure sets'],
 titleArtAliases:Object.fromEntries(Object.entries(old.titleArtAliases||{}).map(([title,slug])=>[title,{male:slug+'-male',female:slug+'-female'}])),
 filter:{method:'PixelOE 1.0.0 legacy CPU',output:[840,1050],bodyPixelSize:3,facePixelSize:2,gridType:'mixed grid; whole-cell regional selection'},
 assets};
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalogue,null,2)+'\n');
const allComplete=complete.length===83&&pairedRoles===35&&failures.length===0;
fs.writeFileSync(path.join(root,'qa/library-verification.json'),JSON.stringify({expected:83,complete:complete.length,pairedRoles,totalRoles:35,uniqueSourceImages:uniqueSources,uniqueFinalImages:uniqueFinals,failures,allComplete,sourceAndFinalHashesVerified:true,filterMetadataHashesVerified:true},null,2)+'\n');
const template=fs.readFileSync(path.join(root,'source/gallery-template.html'),'utf8');
fs.writeFileSync(path.join(root,'review/index.html'),template.replace('__CATALOG_DATA__',JSON.stringify(catalogue).replace(/</g,'\\u003c')));
console.log(JSON.stringify({expected:83,complete:complete.length,pairedRoles,failed:failures.length,pending:83-complete.length-failures.length}));
if(process.argv.includes('--require-complete')&&!allComplete){console.error('Incomplete: '+assets.filter(a=>a.status!=='complete').map(a=>a.slug).join(', '));process.exitCode=1;}
