const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const REPO=path.resolve(__dirname,'../../../../..');
const sharp=createRequire(require.resolve('next/package.json'))('sharp');
const registry=JSON.parse(fs.readFileSync(path.join(REPO,'client/models/card-art-registry.json')));
const sets=['theophrastus','zeno','ptolemy','cleomenes','nearchus','eumenes'];
const ranks=['common','uncommon','rare','epic'];
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
(async()=>{for(const figureId of sets){
 const layers=[];
 for(const row of registry.assets.filter(r=>r.figureId===figureId&&r.kind==='contribution')){
  const x=ranks.indexOf(row.tier)*300,y=row.gender==='male'?0:422;
  layers.push({input:await sharp(path.join(REPO,'public'+row.portraitSrc)).resize(280,350,{kernel:'nearest'}).png().toBuffer(),left:x+10,top:y+52});
  layers.push({input:Buffer.from(`<svg width="300" height="48"><text x="150" y="18" text-anchor="middle" fill="#eee5d2" font-family="Arial" font-size="15">${esc(row.id)}</text><text x="150" y="40" text-anchor="middle" fill="#eee5d2" font-family="Arial" font-size="14">${esc(row.displayTitle)}</text></svg>`),left:x,top:y});
 }
 await sharp({create:{width:1200,height:844,channels:4,background:'#14201e'}}).composite(layers).png().toFile(path.join(__dirname,figureId+'-sheet.png'));
 console.log(figureId);
}})().catch(e=>{console.error(e);process.exitCode=1;});
