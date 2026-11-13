// Run the real map generator in a read-only sandbox and compare its art choices.
const {fs,path,ROOT,LIB,at,load,need,json,definitions,copyKeys}=require('./common.cjs');
const vm=require('node:vm'),{createRequire}=require('node:module');
const file=at(LIB+'/source/build-map.cjs'),req=createRequire(file);
let predicted;
const readonlyFs={...fs,writeFileSync:(destination,bytes)=>{need(path.resolve(destination)===at(LIB+'/source/framing-map.json'),'Unexpected generator output');predicted=JSON.parse(bytes);}};
vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:name=>name==='node:fs'?readonlyFs:req(name),__dirname:path.dirname(file),console:{log:()=>{}}},{filename:file});
need(predicted?.assets?.length===117,'Generator did not produce117 cards');
const current=load(at(LIB+'/source/framing-map.json')),selected=new Set(definitions().map(e=>e.id));
for(const row of current.assets){const next=predicted.assets.find(r=>r.slug===row.slug);need(next?.sourceArt===row.sourceArt,'Regeneration changes art choice '+row.slug);for(const key of copyKeys)need(JSON.stringify(next[key])===JSON.stringify(row[key]),'Regeneration changes copy '+row.slug+'/'+key);if(selected.has(row.slug))need(next.sceneBrief===row.sceneBrief&&next.newArt===true,'Selected pose direction missing '+row.slug);}
const result={passed:true,cards:117,selectedCards:[...selected],perGenderArtworkPreserved:true,cardCopyPreserved:true};
json(path.join(ROOT,'qa/map-regeneration.json'),result);console.log(JSON.stringify(result));
