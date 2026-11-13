// Source-preserving blade-only patch: ArtCraft creates the editable clip and mask;
// raw original/candidate pixels are blended through that mask without resampling.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..');
const pr=createRequire(path.join(path.resolve(ROOT,'../../..'),'package.json'));
const sharp=createRequire(pr.resolve('next/package.json'))('sharp');
for(const name of ['masters','qa'])fs.mkdirSync(path.join(ROOT,name),{recursive:true});
const original=path.join(ROOT,'source','approved-pose-original.png');
const candidate=path.join(ROOT,'source','blade-edit-generated.png');
const output=path.join(ROOT,'source','alexander-blade-only.png');
const master=path.join(ROOT,'masters','Alexander-Blade-Only.vectorcraft');
const maskPath=path.join(ROOT,'qa','blade-patch-mask.png');
// Lower skyline avoids hair; upper-left coverage includes both blade silhouettes.
// The x250 boundary and hard safeguards protect the guard, hand and all y>=280.
const polygon=[[250,180],[300,130],[450,40],[550,0],[1122,0],[1122,150],[700,175],[550,195],[420,225],[310,260],[250,265]];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes={original:sha(original),candidate:sha(candidate)};
const unwrap=r=>{const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r;};

async function main(){
  const a=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(candidate).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const width=a.info.width,height=a.info.height;
  if(width!==1122||height!==1402||b.info.width!==width||b.info.height!==height)throw new Error('Unexpected source geometry');
  const warnings=[];
  await withMcp('VectorCraft',{readRoot:path.join(ROOT,'source'),writeRoot:ROOT,timeoutMs:60000},async({callTool})=>{
    const call=async(n,args={})=>{const r=unwrap(await callTool(n,args));if(r?.warnings?.length)warnings.push(...r.warnings);if(r?.warning)warnings.push(r.warning);return r;};
    const run=(command,params={})=>call('run_command',{command,params});
    await run('file.new',{name:'Alexander / approved pose retained / blade-only patch',width,height,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
    await run('layer.setProps',{name:'00 Approved original / protected pose and anatomy'});
    const baseDoc=await call('inspect_document',{depth:0}),baseLayer=baseDoc.layers[0].id;
    await run('file.place',{path:original,link:false,rect:[0,0,width,height]});
    await run('layer.setProps',{id:baseLayer,locked:true});
    const editLayer=await run('layer.new',{name:'10 Generated candidate / blade and adjacent upper sky only',top:true});
    const image=await run('file.place',{path:candidate,link:false,rect:[0,0,width,height]});
    const clip=await call('draw_path',{name:'Blade-only native clipping polygon / guard excluded',points:polygon,closed:true,fill:'#ffffff',stroke:'none'});
    await run('object.clippingMask.make',{ids:[image.ids[0],clip.id]});
    const maskLayer=await run('layer.new',{name:'90 Mask export / hidden in review',top:true});
    await call('draw_path',{name:'Exact patch coverage / no paint below y280',points:polygon,closed:true,fill:'#ffffff',stroke:'none'});
    await run('layer.setProps',{ids:[baseLayer,editLayer.id],visible:false});
    await call('export',{format:'png',path:maskPath,scale:1,options:{background:'transparent',includeArtboardFill:false}});
    await run('layer.setProps',{ids:[baseLayer,editLayer.id],visible:true});
    await run('layer.setProps',{id:maskLayer.id,visible:false});
    await call('save_file',{path:master,compress:true,preview:true});
    await run('file.close');
  });
  const mask=await sharp(maskPath).ensureAlpha().raw().toBuffer();
  const out=Buffer.from(a.data);
  let coveredPixels=0,changedPixels=0,protectedDifferences=0,outsideDifferences=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    let alpha=mask[i+3];
    // A strict hard safeguard supplements the editable native clip.
    if(y>=280||(x<250&&y>=210))alpha=0;
    if(alpha){coveredPixels++;for(let c=0;c<3;c++)out[i+c]=Math.round((a.data[i+c]*(255-alpha)+b.data[i+c]*alpha)/255);}
    const changed=out[i]!==a.data[i]||out[i+1]!==a.data[i+1]||out[i+2]!==a.data[i+2]||out[i+3]!==a.data[i+3];
    if(changed)changedPixels++;
    if(changed&&(y>=280||(x<250&&y>=210)))protectedDifferences++;
    if(changed&&!alpha)outsideDifferences++;
  }
  if(!changedPixels||protectedDifferences||outsideDifferences||warnings.length)throw new Error(JSON.stringify({changedPixels,protectedDifferences,outsideDifferences,warnings}));
  await sharp(out,{raw:{width,height,channels:4}}).png().toFile(output);
  const unchangedSources=sha(original)===hashes.original&&sha(candidate)===hashes.candidate;
  if(!unchangedSources)throw new Error('Source file changed');
  const qa={master,output,maskPath,width,height,polygon,feather:'Native mask antialias only; no broad feather',protectedRegions:['all y>=280','all x<250 and y>=210, including hand and guard'],coveredPixels,changedPixels,protectedDifferences,outsideDifferences,unchangedSources,hashes,outputSha256:sha(output),warnings};
  fs.writeFileSync(path.join(ROOT,'qa','blade-only-patch.json'),JSON.stringify(qa,null,2));
  console.log(JSON.stringify(qa));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
