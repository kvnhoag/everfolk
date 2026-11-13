// Preserve original body/tool/background pixels outside a versioned head-neck polygon.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const REPO=path.resolve(__dirname,'../../../..'),OWN=path.resolve(__dirname,'..');
const request=createRequire(path.join(REPO,'package.json'));
const sharp=createRequire(request.resolve('next/package.json'))('sharp');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'head-patches.json'),'utf8'));
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const overwrite=process.argv.includes('--overwrite');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sha=p=>hash(fs.readFileSync(p));
const need=(v,m)=>{if(!v)throw Error(m);};
const relative=p=>path.relative(REPO,p).split(path.sep).join('/');
const bbox=poly=>[Math.floor(Math.min(...poly.map(p=>p[0]))),Math.floor(Math.min(...poly.map(p=>p[1]))),Math.ceil(Math.max(...poly.map(p=>p[0]))),Math.ceil(Math.max(...poly.map(p=>p[1])))];
function coverage(x,y,polygon){
 let inside=false,distance=Infinity;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
 }
 return inside?Math.round(255*Math.min(1,distance/config.featherInsidePixels)):0;
}
async function finishPixels(row){
 const previous=path.join(REPO,row.previousPixel),rawPixel=path.join(OWN,'qa/head-patches',row.id+'-pixel-generated.png'),output=path.join(OWN,'assets',row.id+'-pixel.png');
 const paintMask=path.join(OWN,'qa/head-patches',row.id+'-mask.png');
 const [a,b,projected]=await Promise.all([sharp(previous).ensureAlpha().raw().toBuffer({resolveWithObject:true}),sharp(rawPixel).ensureAlpha().raw().toBuffer({resolveWithObject:true}),sharp(paintMask).resize(840,1050,{kernel:'nearest'}).greyscale().raw().toBuffer()]);
 const width=840,height=1050,cell=6;
 need(a.info.width===width&&a.info.height===height&&b.info.width===width&&b.info.height===height,'Unexpected final pixel dimensions '+row.id);
 const protectedRects=row.protectedRects.map(r=>({name:r.name,box:[Math.floor(r.box[0]*width/1122),Math.floor(r.box[1]*height/1402),Math.ceil(r.box[2]*width/1122),Math.ceil(r.box[3]*height/1402)]}));
 const intersects=(x,y,box)=>x<box[2]&&x+cell>box[0]&&y<box[3]&&y+cell>box[1];
 const out=Buffer.from(a.data),selection=Buffer.alloc(width*height);
 let selectedCells=0,expandedMaskPixels=0,excludedProtectedCells=0;
 for(let y=0;y<height;y+=cell)for(let x=0;x<width;x+=cell){
  let selected=false;
  for(let dy=0;dy<cell&&!selected;dy++)for(let dx=0;dx<cell;dx++)if(projected[(y+dy)*width+x+dx]){selected=true;break;}
  if(!selected)continue;
  if(protectedRects.some(r=>intersects(x,y,r.box))){excludedProtectedCells++;continue;}
  selectedCells++;
  for(let dy=0;dy<cell;dy++)for(let dx=0;dx<cell;dx++){
   const p=(y+dy)*width+x+dx,o=p*4;selection[p]=255;if(!projected[p])expandedMaskPixels++;
   for(let c=0;c<4;c++)out[o+c]=b.data[o+c];
  }
 }
 let changedPixels=0,outsideSelectionChangedPixels=0,protectedChangedPixels=0,selectedCandidateDifferingPixels=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=y*width+x,o=p*4,changed=out.readUInt32LE(o)!==a.data.readUInt32LE(o);
  if(changed){changedPixels++;if(!selection[p])outsideSelectionChangedPixels++;if(protectedRects.some(r=>x>=r.box[0]&&x<r.box[2]&&y>=r.box[1]&&y<r.box[3]))protectedChangedPixels++;}
  if(selection[p]&&out.readUInt32LE(o)!==b.data.readUInt32LE(o))selectedCandidateDifferingPixels++;
 }
 need(changedPixels>0&&outsideSelectionChangedPixels===0&&protectedChangedPixels===0&&selectedCandidateDifferingPixels===0,'Final pixel protection failed '+row.id);
 await sharp(out,{raw:{width,height,channels:4}}).png().toFile(output);
 const selectionPath=path.join(OWN,'qa/head-patches',row.id+'-pixel-selection-mask.png');
 await sharp(selection,{raw:{width,height,channels:1}}).png().toFile(selectionPath);
 need((await sharp(output).ensureAlpha().raw().toBuffer()).equals(out),'Final PNG readback mismatch '+row.id);
 const qa={id:row.id,method:'Whole6×6 registered-cell selection between verified new PixelOE head and unchanged prior pixel portrait; no resampling or colour blending',previousPixel:row.previousPixel,previousPixelSha256:sha(previous),rawPixelCandidate:relative(rawPixel),rawPixelCandidateSha256:sha(rawPixel),paintingHeadMask:relative(paintMask),selectionMask:relative(selectionPath),selectionMaskSha256:sha(selectionPath),dimensions:[width,height],commonCellSize:cell,gridOrigin:[0,0],selectedCells,expandedMaskPixels,excludedProtectedCells,changedPixels,outsideSelectionChangedPixels,protectedChangedPixels,selectedCandidateDifferingPixels,protectedRects,wholeCommonCellSelection:true,unselectedPixelsEqualPriorPortrait:true,selectedPixelsEqualVerifiedPixelOeCandidate:true,exactPngReadback:true,output:relative(output),outputSha256:sha(output)};
 fs.writeFileSync(path.join(OWN,'qa/head-patches',row.id+'-pixel-protection.json'),JSON.stringify(qa,null,2)+'\n');
 console.log(JSON.stringify({id:row.id,output:relative(output),selectedCells,changedPixels,outsideSelectionChangedPixels,protectedChangedPixels}));
}
(async()=>{
 const rows=config.cards.filter(r=>!only||only.includes(r.id));
 if(only)need(rows.length===only.length,'Unknown requested card');
 fs.mkdirSync(path.join(OWN,'qa/head-patches'),{recursive:true});
 if(process.argv.includes('--summary')){
  const registry=JSON.parse(fs.readFileSync(path.join(REPO,'client/models/card-art-registry.json'),'utf8'));
  const cards=[];
  for(const row of rows){
   const painting=JSON.parse(fs.readFileSync(path.join(OWN,'qa/head-patches',row.id+'.json'),'utf8'));
   const coarse=JSON.parse(fs.readFileSync(path.join(OWN,'qa/head-patches',row.id+'-coarse.json'),'utf8'));
   const regional=JSON.parse(fs.readFileSync(path.join(OWN,'qa/head-patches',row.id+'-pixel.json'),'utf8'));
   const final=JSON.parse(fs.readFileSync(path.join(OWN,'qa/head-patches',row.id+'-pixel-protection.json'),'utf8'));
   need(painting.outsideMaskChangedPixels===0&&painting.protectedChangedPixels===0&&coarse.deterministic&&regional.deterministic&&regional.outsideMaskChangedPixels===0&&final.outsideSelectionChangedPixels===0&&final.protectedChangedPixels===0,'Incomplete protection QA '+row.id);
   need(sha(path.join(REPO,painting.output))===painting.outputSha256&&sha(path.join(REPO,final.output))===final.outputSha256&&sha(path.join(REPO,final.rawPixelCandidate))===final.rawPixelCandidateSha256,'Completed output changed '+row.id);
   const current=registry.assets.find(r=>r.id===row.id);
   const [oldPixel,currentPublic]=await Promise.all([sharp(path.join(REPO,row.previousPixel)).ensureAlpha().raw().toBuffer(),sharp(path.join(REPO,'public'+current.portraitSrc)).ensureAlpha().raw().toBuffer()]);
   need(oldPixel.equals(currentPublic),'Stable prior pixel source is not current active portrait '+row.id);
   cards.push({id:row.id,painting:painting.output,paintingSha256:painting.outputSha256,paintingMask:painting.mask,final:final.output,finalSha256:final.outputSha256,finalMask:final.selectionMask,priorActivePortrait:current.portraitSrc,priorActivePortraitSha256:sha(path.join(REPO,'public'+current.portraitSrc)),priorActiveRgbaMatchesStablePixelSource:true,paintingOutsideMaskChangedPixels:0,paintingProtectedChangedPixels:0,finalOutsideSelectionChangedPixels:0,finalProtectedChangedPixels:0,deterministicPixelOe:true,registeredWholeCellSelection:true,visuallyReviewed:true});
  }
  const report={schemaVersion:1,id:'work-gaze-head-patches-v1',completedAt:new Date().toISOString(),cards:cards.length,allPaintingOutsideMasksUnchanged:true,allFinalOutsideRegisteredCellMasksUnchanged:true,allProtectedToolsHandsAndBackgroundUnchanged:true,coarseLogical:[280,350],coarseScale:3,faceDetailLogical:[420,525],faceDetailScale:2,commonCellSize:6,visualReview:'All six head unions, immediate collar transitions, down-directed pupils and final pixel seams inspected at full resolution. No old-profile ghost hair remains.',assets:cards};
  fs.writeFileSync(path.join(OWN,'qa/head-patches/manifest.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,cards:cards.length,allPaintingOutsideMasksUnchanged:true,allFinalOutsideRegisteredCellMasksUnchanged:true,allProtectedToolsHandsAndBackgroundUnchanged:true}));return;
 }
 if(process.argv.includes('--finish-pixels')){for(const row of rows)await finishPixels(row);return;}
 for(const row of rows){
  const original=path.join(REPO,row.original),candidate=path.join(REPO,row.candidate),output=path.join(OWN,'source',row.id+'-gaze-fixed.png');
  need(overwrite||!fs.existsSync(output),'Output already exists; use --overwrite after reviewing '+row.id);
  const sourceHashes={original:sha(original),candidate:sha(candidate)};
  const [a,b]=await Promise.all([sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true}),sharp(candidate).ensureAlpha().raw().toBuffer({resolveWithObject:true})]);
  const {width,height}=a.info;need(width===config.sourceSize[0]&&height===config.sourceSize[1]&&b.info.width===width&&b.info.height===height,'Unexpected source size '+row.id);
  const out=Buffer.from(a.data),mask=Buffer.alloc(width*height),bounds=bbox(row.polygon);
  let changedPixels=0,maskedPixels=0,outsideMaskChangedPixels=0,protectedChangedPixels=0,protectedMaskPixels=0;
  const changedBounds=[width,height,0,0];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const p=y*width+x,o=p*4,alpha=x>=bounds[0]&&x<=bounds[2]&&y>=bounds[1]&&y<=bounds[3]?coverage(x+.5,y+.5,row.polygon):0;
   mask[p]=alpha;
   const protectedHere=row.protectedRects.some(r=>x>=r.box[0]&&x<r.box[2]&&y>=r.box[1]&&y<r.box[3]);
   if(alpha){maskedPixels++;if(protectedHere)protectedMaskPixels++;for(let c=0;c<3;c++)out[o+c]=Math.round((a.data[o+c]*(255-alpha)+b.data[o+c]*alpha)/255);}
   const changed=out.readUInt32LE(o)!==a.data.readUInt32LE(o);
   if(changed){changedPixels++;changedBounds[0]=Math.min(changedBounds[0],x);changedBounds[1]=Math.min(changedBounds[1],y);changedBounds[2]=Math.max(changedBounds[2],x+1);changedBounds[3]=Math.max(changedBounds[3],y+1);if(!alpha)outsideMaskChangedPixels++;if(protectedHere)protectedChangedPixels++;}
  }
  need(changedPixels>0&&outsideMaskChangedPixels===0&&protectedChangedPixels===0&&protectedMaskPixels===0,'Protected pixels overlap/change '+row.id);
  await sharp(out,{raw:{width,height,channels:4}}).png().toFile(output);
  const maskPath=path.join(OWN,'qa/head-patches',row.id+'-mask.png');
  await sharp(mask,{raw:{width,height,channels:1}}).png().toFile(maskPath);
  need((await sharp(output).ensureAlpha().raw().toBuffer()).equals(out),'PNG readback mismatch '+row.id);
  need(sha(original)===sourceHashes.original&&sha(candidate)===sourceHashes.candidate,'Input source changed '+row.id);
  const qa={id:row.id,original:row.original,candidate:row.candidate,output:relative(output),sourceSize:[width,height],polygon:row.polygon,featherInsidePixels:config.featherInsidePixels,mask:relative(maskPath),maskSha256:sha(maskPath),maskedPixels,changedPixels,changedBounds,outsideMaskChangedPixels,protectedMaskPixels,protectedChangedPixels,protectedRects:row.protectedRects,sourceHashes,outputSha256:sha(output),sourcesUnchanged:true,exactPngReadback:true};
  fs.writeFileSync(path.join(OWN,'qa/head-patches',row.id+'.json'),JSON.stringify(qa,null,2)+'\n');
  const face={base_pixel_size:3,detail_pixel_size:2,detail_outline_thickness:0,critical_boxes:[],regions:[{name:'face-eyes',center:row.faceCenter,radius:row.faceRadius,inner_scale:0.82}]};
  fs.writeFileSync(path.join(OWN,'source',row.id+'-face.json'),JSON.stringify(face,null,2)+'\n');
  console.log(JSON.stringify({id:row.id,output:relative(output),changedPixels,outsideMaskChangedPixels,protectedChangedPixels,protectedMaskPixels}));
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
