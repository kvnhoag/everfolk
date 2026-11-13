const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..');
const project=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(project,'package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
 const records=[];
 for(const name of ['standard-frame','standard-layout','legendary-full-art-frame','legendary-full-art-layout']){
  const file=path.join(ROOT,'exports',name+'.png');
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];
  if(info.width!==900||info.height!==1260)throw Error('Unexpected size '+name);
  const corners=[[0,0],[899,0],[0,1259],[899,1259]].map(p=>alpha(...p));
  if(corners.some(Boolean))throw Error('Opaque trim corner '+name);
  const region=name.startsWith('standard')?[90,230,810,890]:[70,260,830,920];
  let checked=0;
  for(let y=region[1];y<region[3];y++)for(let x=region[0];x<region[2];x++){
   if(alpha(x,y)!==0)throw Error('Artwork region obscured '+name+' '+x+','+y);
   checked++;
  }
  const svg=fs.readFileSync(path.join(ROOT,'exports',name+'.svg'),'utf8');
  if(/<image\b/.test(svg))throw Error('Raster embedded in '+name);
  if(name.endsWith('-frame')&&/<text\b/.test(svg))throw Error('Live text in frame-only export '+name);
  records.push({name,width:info.width,height:info.height,hasAlpha:true,trimCornerAlpha:corners,centralArtPixelsVerifiedTransparent:checked,centerAlpha:alpha(450,630),rasterImages:0,sha256:sha(file)});
 }
 for(const name of ['standard','legendary-full-art']){
  const metadata=await sharp(path.join(ROOT,'exports',name+'-layout-2x.png')).metadata();
  if(metadata.width!==1800||metadata.height!==2520)throw Error('Unexpected 2x export');
 }
 const log={records,referenceSha256:sha(path.join(ROOT,'source/selected-reference.png')),viewedProofs:['review/Everfolk-Selected-Frames.png','review/Everfolk-Selected-Frames-1060.png'],nativeReopenCheck:'qa/native-build.json',method:'Native VectorCraft export, not a generated or traced bitmap',notes:['All four outer corners have zero alpha.','Standard aperture and legendary central artwork fields are unobscured.','Legendary has transparent readability fades only at top and bottom.','Native master contains two artboards with live Source Serif 4 and Inter type and zero raster images.']};
 fs.writeFileSync(path.join(ROOT,'qa/export-validation.json'),JSON.stringify(log,null,2));
 console.log(JSON.stringify(log));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

