const {fs,path,ROOT,REPO,LIB,KIT,at,old,load,hash,sha,need,json,definitions}=require('./common.cjs');
const {createRequire}=require('node:module'),req=createRequire(path.join(REPO,'package.json')),sharp=createRequire(req.resolve('next/package.json'))('sharp');
const catalog=load(at(LIB+'/catalog.json')),kit=load(old(KIT+'/data/cards.json')),sourceManifest=load(old('public/assets/cards/collection-v14/manifest.json'));
const rgba=async b=>sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
async function metadata(bytes){const r=await rgba(bytes);return{width:r.info.width,height:r.info.height,bytes:bytes.length,sha256:hash(bytes),rgbaSha256:hash(r.data)};}
async function encode(input,file){const source=await rgba(input),bytes=await sharp(input).webp({lossless:true,exact:true,alphaQuality:100,effort:4}).toBuffer();need((await rgba(bytes)).data.equals(source.data),'Lossless pixels changed '+file);fs.writeFileSync(at(file),bytes);return{src:'/'+file.slice('public/'.length),...await metadata(bytes)};}
(async()=>{
 for(const edit of definitions()){
  const id=edit.id,row=catalog.assets.find(r=>r.slug===id),template=structuredClone(kit.assets.find(r=>r.id===id));
  need(row.sourceArt===edit.sourceArt&&row.sourceArtSha256===sha(at(edit.sourceArt)),'Native card not rebuilt '+id);
  const [currentFrame,approvedFrame]=await Promise.all([rgba(fs.readFileSync(at(LIB+'/qa/'+id+'-overlay.png'))),rgba(fs.readFileSync(at(KIT+'/'+template.frame)))]);
  need(currentFrame.data.equals(approvedFrame.data),'Native frame/type pixels changed '+id);
  for(const key of ['frame','footerlessFrame','overlaySvg','footerlessOverlaySvg'])need(sha(at(KIT+'/'+template[key]))===template.hashes[key].sha256,'Approved protected frame changed '+id+'/'+key);
  const fitted=fs.readFileSync(at(LIB+'/'+row.fittedArt));
  const fullPNG=await sharp(fitted).composite([{input:fs.readFileSync(at(KIT+'/'+template.frame))}]).png().toBuffer();
  const cleanPNG=await sharp(fitted).composite([{input:fs.readFileSync(at(KIT+'/'+template.footerlessFrame))}]).png().toBuffer();
  const [full,clean,native]=await Promise.all([rgba(fullPNG),rgba(cleanPNG),rgba(fs.readFileSync(at(LIB+'/'+row.export)))]);
  need(full.data.equals(native.data),'Approved frame does not reproduce native card '+id);
  let editionRemovedPixels=0;
  for(let p=0;p<full.data.length;p+=4)if(full.data.readUInt32LE(p)!==clean.data.readUInt32LE(p)){const x=p/4%900,y=Math.floor(p/4/900);need(x>=700&&x<826&&y>=1180&&y<1224,'Difference outside edition area '+id);editionRemovedPixels++;}
  need(editionRemovedPixels>0,'Example serial was not removed '+id);
  const base='public/assets/cards/collection-v14/'+id;
  const files={full:await encode(fullPNG,base+'.webp'),footerless:await encode(cleanPNG,base+'-footerless.webp'),thumbnail:await encode(fs.readFileSync(at(LIB+'/'+row.thumbnail)),base+'-thumb.webp'),portrait:await encode(fs.readFileSync(at(row.sourceArt)),base+'-portrait.webp')};
  fs.copyFileSync(at(base+'-portrait.webp'),at(KIT+'/'+template.sourcePortrait));
  fs.copyFileSync(at(base+'-thumb.webp'),at(KIT+'/'+template.preview));
  template.sourceArtworkSha256=row.sourceArtSha256;template.sceneBrief=edit.sceneBrief;
  for(const key of ['sourcePortrait','preview'])template.hashes[key]=await metadata(fs.readFileSync(at(KIT+'/'+template[key])));
  const briefPath=KIT+'/briefs/'+id+'.md',brief=fs.readFileSync(at(briefPath),'utf8'),needle=/(keep the scene concise enough to read at card size\. )[^\n]*/g;
  need([...brief.matchAll(needle)].length===1,'Expected one generation direction '+id);
  fs.writeFileSync(at(briefPath),brief.replace(needle,(_,prefix)=>prefix+`A clearly adult ${row.gender==='female'?'woman':'man'}. ${edit.sceneBrief}`));
  const prior=sourceManifest.deliveries.find(r=>r.id===id),delivery={...prior,sourcePNG:row.export,sourceSha256:row.exportSha256,portraitSourceSha256:row.sourceArtSha256,editionRemovedPixels,outsideEditionChangedPixels:0,...files};
  json(path.join(ROOT,'qa/derivatives',id+'.json'),{id,template,delivery,approvedFrameBytesUnchanged:true,nativeFrameExact:true,uncoveredPixelDifferences:0,outsideEditionChangedPixels:0});
  console.log(JSON.stringify({complete:id,approvedFrameBytesUnchanged:true,nativeFrameExact:true}));
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
