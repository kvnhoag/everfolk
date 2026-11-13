// ArtCraft review layout with exact nearest-neighbour pixel tiles in the final PNG.
// No filtering, painting, invented eye features or changes to source assets occur here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..');
const pr=createRequire(path.join(path.resolve(ROOT,'../../..'),'package.json'));
const sharp=createRequire(pr.resolve('next/package.json'))('sharp');
for(const folder of ['masters','review','qa'])fs.mkdirSync(path.join(ROOT,folder),{recursive:true});
const master=path.join(ROOT,'masters','Alexander-Eye-Detail-Comparison.vectorcraft');
const output=path.join(ROOT,'review','Alexander-Eye-Detail-Comparison.png');
const layout=path.join(ROOT,'qa','eye-detail-layout.png');
const inputs=[
  {label:'Painting reference',file:'source/alexander-painting.png',x:35,dimensions:[1122,1402],roi:[369,264,240,304],scale:2.25,caption:'Existing generated painting / unchanged'},
  {label:'Current coarse face',file:'assets/alexander-card-pixel-coarse.png',x:610,dimensions:[840,1050],roi:[276,198,180,228],scale:3,caption:'Current uniform coarse finish / exact pixel crop'},
  {label:'Recalibrated face + eyes',file:'assets/alexander-card-pixel.png',x:1185,dimensions:[840,1050],roi:[276,198,180,228],scale:3,caption:'Regional face detail / exact pixel crop'},
];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const unwrap=r=>{const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r;};
const warnings=[];

async function main(){
  for(const input of inputs){input.sha256=sha(path.join(ROOT,input.file));const m=await sharp(path.join(ROOT,input.file)).metadata();if(m.width!==input.dimensions[0]||m.height!==input.dimensions[1])throw new Error('Unexpected input dimensions');}
  await withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:60000},async({callTool})=>{
    const call=async(n,a={})=>{const r=unwrap(await callTool(n,a));if(r?.warning)warnings.push(r.warning);if(r?.warnings?.length)warnings.push(...r.warnings);return r;};
    const run=(command,params={})=>call('run_command',{command,params});
    const text=async(value,x,top,size,font='Inter',color='#24312c')=>{const r=await run('text.create',{text:value,x,y:0,size,font,style:'Regular',color});const b=(await call('inspect_document',{ids:[r.id],depth:0})).nodes[0].bounds;await run('object.move',{ids:[r.id],dx:x-b.x,dy:top-b.y});};
    await run('file.new',{name:'Alexander / matched face and eye calibration / review only',width:1760,height:950,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
    await run('layer.setProps',{name:'00 Light review field'});
    await call('draw_shape',{shape:'rectangle',name:'Light comparison background',x:0,y:0,width:1760,height:950,fill:'#f2efe7',stroke:'none'});
    await run('layer.new',{name:'10 Editable titles and calibration notes',top:true});
    await text('Alexander / face and eye calibration',35,25,34,'Source Serif 4');
    for(const input of inputs){await text(input.label,input.x,95,22);await text(input.caption,input.x,844,15,'Inter','#667367');}
    await text('Matched crops from one unchanged generated painting. Pixel panels are shown at exact 3× nearest-neighbour enlargement.',35,888,16,'Inter','#48564b');
    await text('Filter calibration only. No new painted pupils, catchlights or historical features were added for this comparison.',35,920,14,'Inter','#667367');
    for(let i=0;i<inputs.length;i++){
      const input=inputs[i], [sx,sy]=input.roi;
      const layer=await run('layer.new',{name:`${20+i} ${input.label} / embedded original and native clipping frame`,top:true});input.layerId=layer.id;
      const image=await run('file.place',{path:path.join(ROOT,input.file),link:false,rect:[input.x-sx*input.scale,135-sy*input.scale,input.dimensions[0]*input.scale,input.dimensions[1]*input.scale]});
      await run('object.setProps',{id:image.ids[0],name:input.caption,data:{source:input.file,source_sha256:input.sha256}});
      const clip=await call('draw_shape',{shape:'rectangle',name:'Matched head and eyes / view crop',x:input.x,y:135,width:540,height:684,fill:'#ffffff',stroke:'none'});
      await run('object.clippingMask.make',{ids:[image.ids[0],clip.id]});
    }
    await run('layer.new',{name:'30 Quiet panel outlines',top:true});
    for(const input of inputs)await call('draw_shape',{shape:'rectangle',name:'Panel outline outside the exact-pixel tile',x:input.x-.5,y:134.5,width:541,height:685,fill:'none',stroke:'#c9c6b9',strokeWidth:.8});
    const fonts=await run('text.fonts');if(fonts.some(f=>f.status!=='exact'||f.missingGlyphs))throw new Error('Font substitution');
    for(const input of inputs)await run('layer.setProps',{id:input.layerId,visible:false});
    await call('export',{format:'png',path:layout,scale:1});
    for(const input of inputs)await run('layer.setProps',{id:input.layerId,visible:true});
    await call('save_file',{path:master,compress:true,preview:true});
    await run('file.close');
  });
  const tiles=[];
  for(let i=0;i<inputs.length;i++){
    const input=inputs[i], [left,top,width,height]=input.roi;
    const tile=await sharp(path.join(ROOT,input.file)).extract({left,top,width,height}).resize(540,684,{kernel:i===0?'lanczos3':'nearest'}).ensureAlpha().png().toBuffer();
    tiles.push({input:tile,left:input.x,top:135});
  }
  const png=await sharp(layout).composite(tiles).png().toBuffer();fs.writeFileSync(output,png);
  const final=await sharp(png).ensureAlpha().raw().toBuffer();
  const pixelChecks=[];
  for(let p=1;p<inputs.length;p++){
    const input=inputs[p],[left,top,width,height]=input.roi;
    const crop=await sharp(path.join(ROOT,input.file)).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
    let differingChannels=0;
    for(let y=0;y<684;y++)for(let x=0;x<540;x++){
      const a=(Math.floor(y/3)*180+Math.floor(x/3))*4,b=((y+135)*1760+x+input.x)*4;
      for(let c=0;c<4;c++)if(crop[a+c]!==final[b+c])differingChannels++;
    }
    pixelChecks.push({label:input.label,comparedPixels:540*684,differingChannels,nearestScale:3});
  }
  const unchanged=inputs.every(input=>sha(path.join(ROOT,input.file))===input.sha256);
  if(!unchanged||warnings.length||pixelChecks.some(c=>c.differingChannels))throw new Error(JSON.stringify({unchanged,warnings,pixelChecks}));
  const qa={master,output,layout,inputs,pixelChecks,unchanged,warnings,paintingProvenance:'Existing generated painting, unchanged. This board does not synthesize historical references or paint eyes.'};
  fs.writeFileSync(path.join(ROOT,'qa','eye-detail-comparison.json'),JSON.stringify(qa,null,2));
  console.log(JSON.stringify({master,output,pixelChecks,unchanged,warnings}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
