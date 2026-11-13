const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),PROJECT=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(PROJECT,'package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
const cat=require('./common-b-catalog.json');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main(){
 if(cat.assets.length!==10||!cat.complete)throw Error('Incomplete B catalogue');
 const layers=[],rows=[];
 for(let i=0;i<cat.assets.length;i++){
  const a=cat.assets[i],file=path.join(ROOT,a.final),m=await sharp(file).metadata(),q=JSON.parse(fs.readFileSync(path.join(ROOT,a.qa)));
  if(m.width!==840||m.height!==1050||sha(file)!==a.finalSha256||sha(path.join(ROOT,a.source))!==a.sourceSha256||!q.sourceUnchanged||!q.baseUnchanged||!q.registeredExactIntegerBlocks||!q.wholeCommonCells||!q.deterministic||q.outsideMaskChangedPixels!==0||q.selectedDetailDifferingPixels!==0)throw Error('QA mismatch '+a.slug);
  layers.push({input:await sharp(file).resize(280,350,{kernel:'nearest'}).png().toBuffer(),left:(i%5)*280,top:Math.floor(i/5)*380});
  layers.push({input:Buffer.from(`<svg width="280" height="30"><text x="140" y="20" text-anchor="middle" fill="#eee4ce" font-family="sans-serif" font-size="12">${a.slug}</text></svg>`),left:(i%5)*280,top:Math.floor(i/5)*380+350});
  rows.push({slug:a.slug,sourceUnchanged:true,output:[m.width,m.height],mixedGrid:[q.basePixelSize,q.detailPixelSize],deterministic:q.deterministic,outsideMaskChangedPixels:q.outsideMaskChangedPixels,selectedDetailDifferingPixels:q.selectedDetailDifferingPixels});
 }
 await sharp({create:{width:1400,height:760,channels:4,background:'#0b2523'}}).composite(layers).png().toFile(path.join(ROOT,'qa','common-b-contact.png'));
 const report={passed:true,total:10,male:5,female:5,bodyPixelSize:3,facePixelSize:2,allSourceHashesUnchanged:true,allOutsideMaskChangedPixels:0,contactSheet:'qa/common-b-contact.png',assets:rows};
 fs.writeFileSync(path.join(ROOT,'qa','common-b-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
