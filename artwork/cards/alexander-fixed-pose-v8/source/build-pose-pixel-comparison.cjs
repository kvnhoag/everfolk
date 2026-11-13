// Bounded review board: actual upper machaira photograph, previous pose, corrected pose.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname,'..');
const cards = path.resolve(ROOT,'..');
const master = path.join(ROOT,'masters','Alexander-Fixed-Pose-Comparison.vectorcraft');
const png = path.join(ROOT,'review','Alexander-Fixed-Pose-Comparison.png');
const inputs = [
  { label:'Actual Greek machaira', file:path.join(ROOT,'references','greek-machaira-met-2001.346.jpg'), x:40, kind:'Actual public-domain photograph / upper specimen' },
  { label:'Blade-only painting', file:path.join(ROOT,'source','alexander-blade-only.png'), x:630, kind:'Original approved pose / metal and nearby sky patch only', dimensions:[1122,1402], crop:[0,0,1122,900] },
  { label:'Coarser pixel finish / 280×350 · 3×', file:path.join(ROOT,'assets','alexander-card-pixel.png'), x:1220, kind:'PixelOE / 280×350 logical grid at exact 3× output', dimensions:[840,1050], crop:[0,0,840,674] },
];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const folder of ['masters','review','qa'])fs.mkdirSync(path.join(ROOT,folder),{recursive:true});
for(const input of inputs)input.sha256=sha(input.file);
const unwrap=result=>{const text=result.content?.find(item=>item.type==='text');return text?JSON.parse(text.text):result;};
const warnings=[];

async function main(){
  await withMcp('VectorCraft',{readRoot:cards,writeRoot:ROOT,timeoutMs:60000},async({callTool})=>{
    const call=async(name,args={})=>{const result=unwrap(await callTool(name,args));if(result?.warning)warnings.push(result.warning);if(result?.warnings?.length)warnings.push(...result.warnings);return result;};
    const run=(command,params={})=>call('run_command',{command,params});
    const text=async(value,x,top,size,font='Inter',color='#24312c')=>{
      const created=await run('text.create',{text:value,x,y:0,font,size,style:'Regular',color});
      const b=(await call('inspect_document',{ids:[created.id],depth:0})).nodes[0].bounds;
      await run('object.move',{ids:[created.id],dx:x-b.x,dy:top-b.y});
    };
    await run('file.new',{name:'Alexander / approved pose and coarser pixel finish / review only',width:1810,height:960,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
    await run('layer.setProps',{name:'00 Light review field'});
    await call('draw_shape',{shape:'rectangle',name:'Light museum-review background',x:0,y:0,width:1810,height:960,fill:'#f2efe7',stroke:'none'});
    await run('layer.new',{name:'10 Heading and comparison labels',top:true});
    await text('Alexander / original pose, corrected blade, coarser finish',40,30,34,'Source Serif 4');
    for(const input of inputs)await text(input.label,input.x,98,22);
    for(let index=0;index<inputs.length;index++){
      const input=inputs[index];
      await run('layer.new',{name:`${20+index} ${input.label} / original embedded input`,top:true});
      await call('draw_shape',{shape:'rectangle',name:'Neutral panel field',x:input.x,y:140,width:550,height:620,fill:'#e8e5dc',stroke:'none'});
      let placed,clip;
      if(index===0){
        // Non-rectangular native view crop retains the upper specimen's whole handle
        // while leaving the lower specimen outside the view. Original JPG is unmodified.
        const scale=.5, ox=20, oy=347.5;
        placed=await run('file.place',{path:input.file,link:false,rect:[ox,oy,1200*scale,591*scale]});
        clip=await call('draw_path',{name:'Actual upper specimen / faithful view crop',points:[[40,55],[1140,55],[1140,285],[290,285],[260,355],[40,355]].map(([x,y])=>[ox+x*scale,oy+y*scale]),closed:true,fill:'#ffffff',stroke:'none'});
        input.view={scale,sourcePolygon:[[40,55],[1140,55],[1140,285],[290,285],[260,355],[40,355]]};
      }else{
        // Identical source-space view for V6 and V7 makes the changed wrist angle legible.
        const scale=550/input.crop[2],height=input.crop[3]*scale,top=140+(620-height)/2;
        placed=await run('file.place',{path:input.file,link:false,rect:[input.x,top,input.dimensions[0]*scale,input.dimensions[1]*scale]});
        clip=await call('draw_shape',{shape:'rectangle',name:'Whole weapon, grip and forearm / matched view',x:input.x,y:top,width:550,height,fill:'#ffffff',stroke:'none'});
        input.view={scale,sourceCrop:input.crop};
      }
      await run('object.setProps',{id:placed.ids[0],name:input.kind,data:{source:input.file,source_sha256:input.sha256,role:input.kind}});
      const group=await run('object.clippingMask.make',{ids:[placed.ids[0],clip.id]});
      await run('object.setProps',{id:group.id,name:`${input.label} / native clipping frame`});
      await call('draw_shape',{shape:'rectangle',name:'Quiet panel outline',x:input.x-.5,y:139.5,width:551,height:621,fill:'none',stroke:'#c9c6b9',strokeWidth:.8});
    }
    await run('layer.new',{name:'40 Actual photo credit and heroic-exaggeration note',top:true});
    await text('Actual photograph / upper specimen',40,780,15,'Inter','#667367');
    await text('Original pose preserved; metal / nearby sky only',630,780,15,'Inter','#667367');
    await text('PixelOE / 280×350 logical grid, exact 3× output',1220,780,15,'Inter','#667367');
    await text('Reference: public-domain photograph; former Met record 2001.346, restituted September 2025.',40,829,17,'Inter','#48564b');
    await text('The enlarged blade is a deliberate heroic exaggeration of reference-derived form, not a literal-scale replica.',40,867,16,'Inter','#667367');
    await text('Review only. The approved hand, arm, face and all pixels below y280 are unchanged in the painting; source QA verifies the patch.',40,915,14,'Inter','#667367');
    const fonts=await run('text.fonts');
    if(fonts.some(font=>font.status!=='exact'||font.missingGlyphs))throw new Error('Font substitution');
    await call('save_file',{path:master,compress:true,preview:true});
    await call('export',{format:'png',path:png,scale:1});
    await run('file.close');
  });
  const bytes=fs.readFileSync(png),unchanged=inputs.every(input=>sha(input.file)===input.sha256);
  if(!unchanged||warnings.length||bytes.readUInt32BE(16)!==1810||bytes.readUInt32BE(20)!==960)throw new Error(JSON.stringify({unchanged,warnings}));
  fs.writeFileSync(path.join(ROOT,'qa','fixed-pose-comparison.json'),JSON.stringify({master,png,reviewOnly:true,unchanged,inputs,warnings},null,2));
  console.log(JSON.stringify({master,png,unchanged,warnings}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
