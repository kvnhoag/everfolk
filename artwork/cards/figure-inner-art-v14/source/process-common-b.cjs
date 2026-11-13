const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{execFile}=require('node:child_process');
const{promisify}=require('node:util');
const run=promisify(execFile);
const ROOT=path.resolve(__dirname,'..');
const PY='C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe';
const SKILL='C:/Users/Legion/.codex/skills/everfolk-asset-workflow/scripts';
const RUNTIME=path.resolve(ROOT,'../../../artifacts/pixeloe-runtime/site-packages');
const jobs=require('./common-b-jobs.json');
const INNER=require('../../figure-inner-art-v12/catalog.json');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function one(j){
 const input=path.join(ROOT,'source',j.slug+'.png'),coarse=path.join(ROOT,'assets',j.slug+'-coarse.png'),coarseQa=path.join(ROOT,'qa',j.slug+'-coarse.json'),output=path.join(ROOT,'assets',j.slug+'-pixel.png'),qa=path.join(ROOT,'qa',j.slug+'-pixel.json'),face=path.join(ROOT,'source',j.slug+'-face.json');
 if(!fs.existsSync(coarseQa))await run(PY,[path.join(SKILL,'pixelate.py'),'--input',input,'--output',coarse,'--runtime',RUNTIME,'--logical-width','280','--logical-height','350','--scale','3','--qa',coarseQa],{maxBuffer:4e6,windowsHide:true});
 if(!fs.existsSync(qa))await run(PY,[path.join(SKILL,'pixelate_regions.py'),'--input',input,'--base',coarse,'--base-qa',coarseQa,'--config',face,'--runtime',RUNTIME,'--output',output,'--qa',qa],{maxBuffer:4e6,windowsHide:true});
 const[q,c]=[qa,coarseQa].map(p=>JSON.parse(fs.readFileSync(p)));
 const ref=INNER.assets.find(a=>a.slug===j.ref);
 const row={slug:j.slug,roleId:j.slug.replace(/-(male|female)$/,''),figureId:j.slug.split('-')[0],figureName:ref.figureName,title:({'demetrius':'Siege Labourer','theophrastus':'Garden Attendant','zeno':'Listener at the Stoa','ptolemy':'Palace Messenger','cleomenes':'Granary Porter'})[j.slug.split('-')[0]],kind:'contribution',tier:'common',gender:j.slug.endsWith('-female')?'female':'male',desiredViewAngle:j.angle,source:'source/'+j.slug+'.png',prompt:'prompts/'+j.slug+'.txt',final:'assets/'+j.slug+'-pixel.png',qa:'qa/'+j.slug+'-pixel.json',coarse:'assets/'+j.slug+'-coarse.png',coarseQa:'qa/'+j.slug+'-coarse.json',faceConfig:'source/'+j.slug+'-face.json',status:'complete',sourceSize:c.sourceSize,finalSize:[840,1050],sourceSha256:sha(input),finalSha256:sha(output),faceRegions:JSON.parse(fs.readFileSync(face)).regions,origin:{method:'New generated Common duty scene, v12 contributor identity/style reference',reference:j.ref},provenance:'Fictional representative contributor; original illustration, not historical evidence.',contributorAngleReview:{requested:j.angle,reviewed:true},pixelFinish:'PixelOE mixed3px body/2px face'};
 if(!q.sourceUnchanged||!q.baseUnchanged||!q.deterministic||!q.wholeCommonCells||q.outsideMaskChangedPixels!==0||q.selectedDetailDifferingPixels!==0)throw Error('Mixed pixel QA failed '+j.slug);
 console.log(JSON.stringify({complete:j.slug,final:row.final,sourceUnchanged:c.sourceUnchanged,outsideMaskChangedPixels:q.outsideMaskChangedPixels}));
 return row;
}
async function main(){
 const all=[];for(let i=0;i<jobs.length;i+=2)all.push(...await Promise.all(jobs.slice(i,i+2).map(one)));
 fs.writeFileSync(path.join(ROOT,'source','common-b-catalog.json'),JSON.stringify({libraryId:'everfolk-figure-inner-art-v14-common-b',expected:10,complete:all.length===10,assets:all},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
