const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),req=createRequire(path.resolve(ROOT,'../../../package.json')),sharp=createRequire(req.resolve('next/package.json'))('sharp');
const catalog=require('../catalog.json');
async function sheet(slugs,file,cols,width=270){
 const height=Math.round(width*1.4),gap=16,layers=[];
 for(let i=0;i<slugs.length;i++)layers.push({input:await sharp(path.join(ROOT,'exports',slugs[i]+'.png')).resize(width,height,{kernel:'nearest'}).png().toBuffer(),left:gap+(i%cols)*(width+gap),top:gap+Math.floor(i/cols)*(height+gap)});
 await sharp({create:{width:cols*(width+gap)+gap,height:Math.ceil(slugs.length/cols)*(height+gap)+gap,channels:4,background:'#162521'}}).composite(layers).png().toFile(path.join(ROOT,'review',file));
}
async function main(){
 await sheet(catalog.assets.filter(a=>a.kind==='parent').map(a=>a.slug),'parents.png',5);
 const ranks=['alexander-common-female','alexander-uncommon-female','alexander-rare-female','alexander-epic-female','alexander-parent'];
 if(ranks.every(s=>fs.existsSync(path.join(ROOT,'exports',s+'.png'))))await sheet(ranks,'rarity-treatments.png',5,300);
 const sample=['euclid-parent','alexander-parent','alexander-rare-female','aristotle-epic-male','alexander-common-female','aristotle-common-male','ptolemy-parent','theophrastus-common-female'];
 if(sample.every(s=>fs.existsSync(path.join(ROOT,'exports',s+'.png'))))await sheet(sample,'framed-preview.png',4);
 if(catalog.complete)await sheet(catalog.assets.map(a=>a.slug),'full-collection.png',9,180);
 console.log(JSON.stringify({parents:catalog.assets.filter(a=>a.kind==='parent').length,complete:catalog.complete}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
