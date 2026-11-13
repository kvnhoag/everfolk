const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),project=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(project,'package.json')),sharp=createRequire(req.resolve('next/package.json'))('sharp');
const cfg=require('../rarity-editions.json');
async function main(){
 const build=JSON.parse(fs.readFileSync(path.join(ROOT,'qa/native-build.json'),'utf8')),records=[];
 for(const spec of cfg.rarities){
  const label=spec.editionLimitPerCard===null?cfg.unlimitedDisplay:String(cfg.exampleCopyNumber).padStart(3,'0')+'/'+String(spec.editionLimitPerCard).padStart(3,'0');
  const type=build.text.filter(t=>t.name==='Edition / '+spec.label+' / editable example');
  if(type.length!==2||type.some(t=>t.value!==label||t.bounds.x<690||t.bounds.x+t.bounds.width>817))throw Error('Edition content or footer placement incorrect: '+spec.id);
  for(const suffix of ['frame','layout']){
   const name=spec.id+'-'+suffix,file=path.join(ROOT,'exports',name+'.png');
   const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const alpha=(x,y)=>data[(y*info.width+x)*4+3];
   if(info.width!==900||info.height!==1260)throw Error('Wrong size '+name);
   const corners=[[0,0],[899,0],[0,1259],[899,1259]].map(p=>alpha(...p));
   if(corners.some(Boolean))throw Error('Opaque corner '+name);
   const region=spec.fullArt?[70,260,830,920]:[90,230,810,890];
   let count=0;
   for(let y=region[1];y<region[3];y++)for(let x=region[0];x<region[2];x++){if(alpha(x,y))throw Error('Art field obscured '+name);count++;}
   const svg=fs.readFileSync(path.join(ROOT,'exports',name+'.svg'),'utf8');
   if(/<image\b/.test(svg))throw Error('Unexpected raster '+name);
   records.push({name,dimensions:[info.width,info.height],editionDisplay:label,editionLimitPerCard:spec.editionLimitPerCard,fullArt:spec.fullArt,cornerAlpha:corners,centralArtPixelsTransparent:count,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
  }
  const meta=await sharp(path.join(ROOT,'exports',spec.id+'-layout-2x.png')).metadata();
  if(meta.width!==1800||meta.height!==2520)throw Error('Wrong 2x size '+spec.id);
 }
 if(!build.nativeReopenIdentical||build.rasterImages!==0||build.warnings.length)throw Error('Native verification failed');
 const log={records,nativeReopenIdentical:true,rasterImages:0,warnings:[],proofVisuallyReviewed:'review/Everfolk-Rarity-Frames-1570.png'};
 fs.writeFileSync(path.join(ROOT,'qa/export-validation.json'),JSON.stringify(log,null,2));
 console.log(JSON.stringify({variants:cfg.rarities.length,checkedPngExports:records.length,editionLabels:cfg.rarities.map(s=>({rarity:s.label,label:s.editionLimitPerCard===null?'UNLIMITED':'001/'+String(s.editionLimitPerCard).padStart(3,'0')})),nativeReopenIdentical:true}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
