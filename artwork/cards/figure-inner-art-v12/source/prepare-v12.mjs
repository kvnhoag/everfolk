import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const old=path.resolve(root,'../figure-inner-art-v11');
const original=JSON.parse(fs.readFileSync(path.join(old,'catalog.json'),'utf8'));
const female=new Set(['euclid','menander','theophrastus','ptolemy']);
const reused=[];
function copyAsset(a,slug,gender){
 const mappings=[['source/'+a.slug+'.png','source/'+slug+'.png'],['prompts/'+a.slug+'.txt','prompts/'+slug+'.txt'],['source/'+a.slug+'-face.json','source/'+slug+'-face.json'],['assets/'+a.slug+'-coarse.png','assets/'+slug+'-coarse.png'],['assets/'+a.slug+'-pixel.png','assets/'+slug+'-pixel.png'],['qa/'+a.slug+'-coarse.json','qa/'+slug+'-coarse.json'],['qa/'+a.slug+'-pixel.json','qa/'+slug+'-pixel.json'],['qa/'+a.slug+'-face-mask.png','qa/'+slug+'-face-mask.png']];
 for(const [from,to]of mappings){const dest=path.join(root,to);if(fs.existsSync(dest))throw Error('Refusing overwrite '+dest);fs.copyFileSync(path.join(old,from),dest)}
 reused.push({slug,originalSlug:a.slug,figureId:a.figureId,gender,sourceLibrary:'figure-inner-art-v11',reason:a.kind==='parent'?'Unchanged parent portrait':a.kind==='title'?'Retained male title scene; counterpart will use a different head angle':'Retained three-quarter epic scene; front and profile stages will be regenerated'});
}
for(const a of original.assets){
 if(a.kind==='parent'&&a.figureId!=='ptolemy')copyAsset(a,a.slug,'male');
 else if(a.kind==='contribution'&&a.tier==='epic'&&a.figureId!=='alexander'){const gender=female.has(a.figureId)?'female':'male';copyAsset(a,a.slug+'-'+gender,gender)}
 else if(a.kind==='title')copyAsset(a,a.slug+'-male','male');
}
fs.writeFileSync(path.join(root,'reuse-manifest.json'),JSON.stringify({count:reused.length,assets:reused},null,2)+'\n');
console.log(JSON.stringify({reused:reused.length,plannedNew:59,total:83,subcardRoles:35,subcardVariants:70}));
