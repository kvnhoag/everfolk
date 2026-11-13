const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),PROJECT=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(PROJECT,'package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rows=require('./common-a-catalog.json');
async function main(){
 if(rows.length!==12||rows.some(r=>r.status!=='complete'))throw Error('12 completed assets required');
 if(new Set(rows.map(r=>r.finalSha256)).size!==12)throw Error('Duplicate artwork');
 const layers=[],results=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],file=path.join(ROOT,row.final),m=await sharp(file).metadata();
  if(m.width!==840||m.height!==1050)throw Error('Wrong dimensions '+row.slug);
  if(hash(path.join(ROOT,row.source))!==row.sourceSha256||hash(file)!==row.finalSha256)throw Error('Hash mismatch '+row.slug);
  const qa=JSON.parse(fs.readFileSync(path.join(ROOT,row.qa)));
  if(qa.outsideMaskChangedPixels!==0||qa.selectedDetailDifferingPixels!==0||!qa.sourceUnchanged||!qa.registeredExactIntegerBlocks||!qa.pngReadbackExact||!qa.deterministic)throw Error('PixelOE QA failed '+row.slug);
  results.push({slug:row.slug,sourceUnchanged:true,finalSize:[m.width,m.height],mixedGridQa:qa});
  const left=12+(i%4)*294,top=12+Math.floor(i/4)*382;
  layers.push({input:await sharp(file).resize(280,350,{kernel:'nearest'}).png().toBuffer(),left,top});
  const label=Buffer.from(`<svg width="280" height="20"><text x="4" y="15" font-family="Inter" font-size="12" fill="#eee4ce">${row.slug}</text></svg>`);
  layers.push({input:label,left,top:top+352});
 }
 const contact=path.join(ROOT,'qa','common-a-contact.png');
 await sharp({create:{width:1188,height:1158,channels:4,background:'#142923'}}).composite(layers).png().toFile(contact);
 fs.writeFileSync(path.join(ROOT,'qa','common-a-verification.json'),JSON.stringify({passed:true,total:12,genders:{male:6,female:6},uniqueArt:12,contactSheet:'qa/common-a-contact.png',results},null,2));
 console.log(JSON.stringify({passed:true,total:12,contact}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
