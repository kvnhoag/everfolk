const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'../../../../..');
const sharp=createRequire(require.resolve('next/package.json'))('sharp');
const figures=['alexander','aristotle','euclid','lysippos','pytheas','menander','demetrius'];
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'client/models/card-art-registry.json')));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
(async()=>{
 for(const figure of figures){
  const rows=registry.assets.filter(r=>r.figureId===figure&&r.kind==='contribution');
  const composite=[];
  for(let i=0;i<rows.length;i++){
   const row=rows[i],x=(i%4)*250+10,y=Math.floor(i/4)*390+55;
   const image=await sharp(path.join(ROOT,'public'+row.portraitSrc)).resize(230,288,{kernel:'nearest'}).png().toBuffer();
   composite.push({input:image,left:x,top:y});
   const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70"><text x="2" y="20" fill="#eee5d3" font-family="Arial" font-size="14">${escape(row.id)}</text><text x="2" y="42" fill="#c4b896" font-family="Arial" font-size="12">${escape(row.displayTitle)}</text></svg>`);
   composite.push({input:label,left:x,top:y+290});
  }
  const title=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="50"><text x="20" y="35" fill="#eee5d3" font-family="Arial" font-size="25">${figure} — current active male/female contribution art</text></svg>`);
  composite.push({input:title,left:0,top:0});
  await sharp({create:{width:1000,height:790,channels:3,background:'#152b29'}}).composite(composite).png().toFile(path.join(__dirname,figure+'.png'));
 }
 console.log('Built seven labelled contact sheets for 56 current portraits.');
})().catch(e=>{console.error(e);process.exitCode=1;});
