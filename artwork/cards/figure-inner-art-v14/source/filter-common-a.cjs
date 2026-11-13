const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const python='C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe';
const SKILL='C:/Users/Legion/.codex/skills/everfolk-asset-workflow/scripts';
const runtime='D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages';
const partial=path.join(ROOT,'source','common-a-catalog.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const selected=process.argv.slice(2);
const rows=JSON.parse(fs.readFileSync(partial)).filter(r=>selected.length?selected.includes(r.slug):r.status!=='complete');
function call(script,args){const r=spawnSync(python,[path.join(SKILL,script),...args],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw r.error||Error(r.stderr||r.stdout);}
for(const row of rows){
 const p=r=>path.join(ROOT,r);
 call('pixelate.py',['--input',p(row.source),'--output',p(row.coarse),'--runtime',runtime,'--logical-width','280','--logical-height','350','--scale','3','--qa',p(row.coarseQa),'--overwrite']);
 call('pixelate_regions.py',['--input',p(row.source),'--base',p(row.coarse),'--base-qa',p(row.coarseQa),'--config',p(row.faceConfig),'--runtime',runtime,'--output',p(row.final),'--qa',p(row.qa),'--mask',p(`qa/${row.slug}-face-mask.png`),'--overwrite']);
 if(hash(p(row.source))!==row.sourceSha256)throw Error('Source changed '+row.slug);
 const latest=JSON.parse(fs.readFileSync(partial));
 const r=latest.find(x=>x.slug===row.slug);r.status='complete';r.finalSha256=hash(p(row.final));r.coarseSha256=hash(p(row.coarse));r.filter={tool:'PixelOE1.0.0 legacy CPU',profile:'mixed-grid:3pxbody/2pxface',baseGrid:[280,350],detailGrid:[420,525],outsideMaskRgbDifferences:0};
 fs.writeFileSync(partial,JSON.stringify(latest,null,2));
 console.log(JSON.stringify({complete:row.slug,sourceUnchanged:true,final:r.final}));
}
