'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const PROJECT=path.resolve(ROOT,'../../..');
const MAP=JSON.parse(fs.readFileSync(path.join(ROOT,'../framed-collection-v14/source/framing-map.json'),'utf8'));
const PARTIALS=['common-a-catalog.json','common-b-catalog.json','common-c-catalog.json'];
const expected=MAP.assets.filter(a=>a.sourceArt.replaceAll('\\','/').startsWith('artwork/cards/figure-inner-art-v14/'));
const failures=[],assets=[],checks=[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const assert=(value,message)=>{if(!value)throw Error(message);};
function local(filename){
 assert(typeof filename==='string'&&filename.length>0,'Missing local path');
 const p=path.resolve(ROOT,filename);
 assert(p.startsWith(ROOT+path.sep),'Path leaves art library: '+filename);
 assert(fs.existsSync(p)&&fs.statSync(p).isFile(),'Missing file: '+filename);
 return p;
}
function pngSize(p){
 const b=fs.readFileSync(p);
 assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid PNG '+p);
 assert(b[24]===8&&[2,6].includes(b[25]),'Expected opaque-compatible8-bit RGB/RGBA PNG '+p);
 return [b.readUInt32BE(16),b.readUInt32BE(20)];
}
function normalizeAngle(value){
 if(typeof value!=='string'||!value.trim())return null;
 const s=value.toLowerCase().replaceAll('three quarter','three-quarter').replaceAll('_','-');
 const direction=/left/.test(s)?'left':/right/.test(s)?'right':null;
 const view=/profile/.test(s)?'profile':/frontal|front-facing/.test(s)?'frontal':/three-quarter|3\/4/.test(s)?'three-quarter':null;
 if(!view)return null;
 return [direction,view,/down/.test(s)?'down':null].filter(Boolean).join('-');
}
function verify(row,map,partial){
 const paths={source:row.source||`source/${row.slug}.png`,final:row.final||`assets/${row.slug}-pixel.png`,coarse:row.coarse||`assets/${row.slug}-coarse.png`,prompt:row.prompt||`prompts/${row.slug}.txt`,qa:row.qa||`qa/${row.slug}-pixel.json`,coarseQa:row.coarseQa||`qa/${row.slug}-coarse.json`,faceConfig:row.faceConfig||`source/${row.slug}-face.json`};
 const resolved=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,local(v)]));
 assert(path.resolve(PROJECT,map.sourceArt)===resolved.final,'Framing source differs from final art');
 const sourceSize=pngSize(resolved.source),finalSize=pngSize(resolved.final),coarseSize=pngSize(resolved.coarse);
 assert(equal(finalSize,[840,1050])&&equal(coarseSize,[840,1050]),'Final/coarse dimensions must be840×1050');
 if(row.sourceSize)assert(equal(row.sourceSize,sourceSize),'Worker source dimensions mismatch');
 if(row.finalSize)assert(equal(row.finalSize,finalSize),'Worker final dimensions mismatch');
 const sourceSha256=hash(resolved.source),finalSha256=hash(resolved.final),coarseSha256=hash(resolved.coarse);
 assert(row.sourceSha256===sourceSha256,'Worker source hash mismatch');
 assert(row.finalSha256===finalSha256,'Worker final hash mismatch');
 if(row.coarseSha256)assert(row.coarseSha256===coarseSha256,'Worker coarse hash mismatch');
 const qa=JSON.parse(fs.readFileSync(resolved.qa,'utf8'));
 const coarseQa=JSON.parse(fs.readFileSync(resolved.coarseQa,'utf8'));
 const config=JSON.parse(fs.readFileSync(resolved.faceConfig,'utf8'));
 assert(qa.sourceSha256===sourceSha256&&qa.outputSha256===finalSha256&&qa.baseSha256===coarseSha256,'Regional QA image hash mismatch');
 assert(qa.baseQaSha256===hash(resolved.coarseQa)&&qa.configSha256===hash(resolved.faceConfig),'Regional QA metadata hash mismatch');
 assert(coarseQa.sourceSha256===sourceSha256&&coarseQa.outputSha256===coarseSha256,'Coarse QA image hash mismatch');
 assert(qa.basePixelSize===3&&qa.detailPixelSize===2&&qa.commonCellSize===6,'Expected3pxbody/2pxface profile');
 assert(equal(coarseQa.logical,[280,350])&&coarseQa.scale===3&&equal(qa.detailLogical,[420,525]),'Unexpected logical grids');
 for(const flag of ['registeredExactIntegerBlocks','wholeCommonCells','deterministic','pngReadbackExact','sourceUnchanged','baseUnchanged','metadataUnchanged'])assert(qa[flag]===true,'Regional QA failed: '+flag);
 for(const flag of ['deterministic','exactIntegerBlocks','pngReadbackExact','sourceUnchanged'])assert(coarseQa[flag]===true,'Coarse QA failed: '+flag);
 assert(qa.outsideMaskChangedPixels===0&&qa.selectedDetailDifferingPixels===0,'Regional pixel mismatch');
 assert(qa.interpolatingUpscale===false&&qa.colourBlend===false&&qa.alphaBlend===false,'Unexpected interpolation/blending');
 assert(config.base_pixel_size===3&&config.detail_pixel_size===2&&Array.isArray(config.regions)&&config.regions.length>0,'Invalid face configuration');
 for(const region of config.regions){
  assert(Array.isArray(region.center)&&Array.isArray(region.radius)&&region.center.length===2&&region.radius.length===2,'Invalid face region');
  assert(region.center.every(Number.isFinite)&&region.radius.every(v=>Number.isFinite(v)&&v>0),'Invalid face coordinates');
  assert(region.center[0]>=0&&region.center[0]<840&&region.center[1]>=0&&region.center[1]<1050,'Face centre outside output');
 }
 let mask=null;
 if(qa.maskPath){const m=local(qa.maskPath);assert(hash(m)===qa.maskSha256,'Regional mask hash mismatch');mask=path.relative(ROOT,m).replaceAll('\\','/');}
 const roleId=row.slug.replace(/-(male|female)$/,'');
 const gender=/-female$/.test(row.slug)?'female':'male';
 assert(row.figureId===map.figureId&&row.gender===gender,'Worker figure/gender mismatch');
 const actualRaw=row.actualViewAngle||row.contributorAngleReview?.actual||row.contributorAngleReview?.observed||null;
 const actualViewAngle=normalizeAngle(actualRaw);
 const normalized={...row,...paths,slug:map.slug,roleId,figureId:map.figureId,figureName:map.figureName,title:map.canonicalTitle||map.title,kind:'contribution',tier:map.rarity,gender,sourceSize,finalSize,sourceSha256,finalSha256,coarseSha256,faceRegions:config.regions,status:'complete',actualViewAngle,desiredViewAngle:normalizeAngle(row.desiredViewAngle)||row.desiredViewAngle||null,angleReview:{actualVerified:actualViewAngle!==null,actualSource:actualViewAngle?'worker-recorded-observation':null,requested:row.desiredViewAngle||null,workerReview:row.contributorAngleReview||null},workerCatalog:`source/${partial}`,filter:{method:qa.method,gridType:qa.gridType,tool:'PixelOE1.0.0 legacy CPU',profile:'mixed-grid:3pxbody/2pxface',basePixelSize:3,detailPixelSize:2,baseGrid:[280,350],detailGrid:[420,525],commonCellSize:6,versions:qa.versions,outsideMaskRgbDifferences:0,deterministic:true,pngReadbackExact:true,sourceUnchanged:true,mask},provenance:row.provenance||'Fictional adult representative contributor, generated painterly illustration based on approved Everfolk art; not authenticated historical evidence.'};
 if(row.title!==normalized.title)normalized.workerTitle=row.title;
 checks.push({slug:row.slug,passed:true,sourceSize,finalSize,sourceHashMatches:true,finalHashMatches:true,coarseHashMatches:true,qaMetadataHashMatches:true,faceConfigPresent:true,outsideMaskChangedPixels:0,selectedDetailDifferingPixels:0,actualAngleRecorded:actualViewAngle!==null});
 return normalized;
}
function main(){
 assert(expected.length===34&&new Set(expected.map(x=>x.slug)).size===34,'Framing map must define exactly34 unique new art assets');
 const expectedMap=new Map(expected.map(x=>[x.slug,x]));
 const records=new Map();
 for(const partial of PARTIALS){
  const p=path.join(__dirname,partial);if(!fs.existsSync(p))continue;
  const data=JSON.parse(fs.readFileSync(p,'utf8'));const rows=Array.isArray(data)?data:data.assets;
  assert(Array.isArray(rows),'Invalid partial catalogue '+partial);
  for(const row of rows){
   if(!expectedMap.has(row.slug)){failures.push({slug:row.slug,partial,error:'Unexpected artwork slug'});continue;}
   if(records.has(row.slug)){failures.push({slug:row.slug,partial,error:'Duplicate artwork slug across worker catalogues'});continue;}
   records.set(row.slug,{row,partial});
  }
 }
 for(const map of expected){
  const record=records.get(map.slug);if(!record||record.row.status!=='complete')continue;
  try{assets.push(verify(record.row,map,record.partial));}catch(e){failures.push({slug:map.slug,partial:record.partial,error:e.message});}
 }
 if(new Set(assets.map(a=>a.finalSha256)).size!==assets.length)failures.push({error:'Duplicate final artwork hashes'});
 const actual=new Set(assets.map(a=>a.slug));
 const pending=expected.filter(x=>!actual.has(x.slug)).map(x=>({slug:x.slug,status:records.get(x.slug)?.row.status||'not-recorded'}));
 const roles=new Map();for(const a of assets){if(!roles.has(a.roleId))roles.set(a.roleId,new Set());roles.get(a.roleId).add(a.gender);}
 const pairedRoles=[...roles.values()].filter(x=>x.has('male')&&x.has('female')).length;
 const complete=assets.length===34&&pairedRoles===17&&failures.length===0;
 const counts={assets:assets.length,expected:34,rolePairs:pairedRoles,expectedRolePairs:17,male:assets.filter(x=>x.gender==='male').length,female:assets.filter(x=>x.gender==='female').length};
 const catalog={libraryId:'everfolk-figure-inner-art-v14',date:'2026-11-13',expected:34,complete,parentCount:0,subcardRoleCount:17,subcardVariantCount:assets.length,pairedRoles,scope:'New v14 art only:13 Common roles plus Uncommon/Rare roles for Nearchus and Eumenes, male and female each. The approved v12 library remains in its original sibling folder.',sourceCatalogs:PARTIALS.map(x=>'source/'+x),filter:{tool:'PixelOE1.0.0 legacy CPU',gridType:'mixed-grid',basePixelSize:3,detailPixelSize:2,baseGrid:[280,350],detailGrid:[420,525],commonCellSize:6},notes:['Only validated completed worker assets appear in assets.','Canonical names and titles come from the v14 framing map.','Actual view angles are populated only when the worker explicitly recorded an observation; requested angles remain separate.','All people in this additional library are fictional adult representative contributors.'],assets,pending};
 const qa={verifiedAt:new Date().toISOString(),libraryId:catalog.libraryId,passed:failures.length===0,complete,counts,pending,failures,checks};
 fs.mkdirSync(path.join(ROOT,'qa'),{recursive:true});
 fs.writeFileSync(path.join(ROOT,'catalog.json'),JSON.stringify(catalog,null,2));
 fs.writeFileSync(path.join(ROOT,'qa','art-library-verification.json'),JSON.stringify(qa,null,2));
 console.log(JSON.stringify({complete,passed:qa.passed,...counts,pending:pending.map(x=>x.slug),failures}));
 if(failures.length)process.exitCode=1;
}
main();
