// A bounded, coordinate-authored VectorCraft bristle pass over a generated base.
// The 30 paths below are actual app brush.freehand strokes, not generated texture.
// Normal-blend transparent glazes permit exact source + stroke compositing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const project = path.resolve(ROOT, '../../..');
const projectRequire = createRequire(path.join(project, 'package.json'));
const sharp = createRequire(projectRequire.resolve('next/package.json'))('sharp');
for (const name of ['masters', 'assets', 'qa']) fs.mkdirSync(path.join(ROOT, name), { recursive: true });
const basePath = path.join(ROOT, 'source', 'alexander-painterly-base.png');
const overlayPath = path.join(ROOT, 'assets', 'ArtCraft-brush-strokes.png');
const compositePath = path.join(ROOT, 'source', 'alexander-painterly-brushed.png');
const master = path.join(ROOT, 'masters', 'Alexander-Painterly-Brushwork.vectorcraft');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const unwrap = result => { const text = result.content?.find(item => item.type === 'text'); return text ? JSON.parse(text.text) : result; };
const brushes = {
  shadow: { name: 'HL Shadow Bristle', shape: 'roundPoint', size: 10, density: 55, thickness: 18, opacity: 14, stiffness: 70, length: 100 },
  halftone: { name: 'HL Halftone Bristle', shape: 'roundPoint', size: 8, density: 45, thickness: 14, opacity: 18, stiffness: 70, length: 100 },
  fold: { name: 'HL Broken Fold Bristle', shape: 'flatFan', size: 12, density: 18, thickness: 12, opacity: 24, stiffness: 65, length: 100 },
  hair: { name: 'HL Fine Hair Bristle', shape: 'roundPoint', size: 4, density: 25, thickness: 12, opacity: 18, stiffness: 80, length: 100 },
  eye: { name: 'HL Eye Accent Bristle', shape: 'roundPoint', size: 2, density: 70, thickness: 10, opacity: 15, stiffness: 90, length: 100 },
};
// Layer, description, brush, colour, object opacity %, nominal width, authored points.
const strokes = [
  ['shadow','Cool cheek-side glaze','shadow','#50584c',18,8,[[553,404,.2],[558,420,.7],[557,439,.2]]],
  ['shadow','Jaw plane transition','shadow','#555a48',18,10,[[538,470,.2],[515,483,.7],[483,481,.2]]],
  ['shadow','Cool right neck turn','shadow','#373f37',18,14,[[541,499,.2],[540,527,.8],[533,549,.2]]],
  ['shadow','Lower neck reflected shadow','shadow','#5a604b',16,12,[[468,523,.2],[483,542,.7],[497,557,.2]]],
  ['shadow','Raised forearm cool turn','shadow','#55594a',16,10,[[113,390,.2],[93,427,.8],[77,469,.2]]],
  ['shadow','Lower lip plane only','shadow','#594f41',12,5,[[518,450,.2],[536,454,.6],[549,451,.2]]],
  ['halftone','Olive cheek halftone','halftone','#8b8f70',20,9,[[463,405,.2],[475,414,.7],[482,427,.2]]],
  ['halftone','Olive-grey neck halftone','halftone','#969477',18,12,[[479,490,.2],[492,516,.8],[503,534,.2]]],
  ['halftone','Ear-side reflected colour','halftone','#9c9575',18,7,[[443,425,.2],[454,445,.7],[461,454,.2]]],
  ['halftone','Small warm nose-plane light','halftone','#cdaa7d',20,3,[[525,383,.3],[527,389,.65],[529,395,.2]]],
  ['halftone','Cheek light below eye, not eyelid','halftone','#b79c79',15,5,[[474,386,.2],[487,390,.7],[498,396,.2]]],
  ['halftone','Broken forehead plane light','halftone','#c9a67f',18,6,[[486,332,.2],[502,337,.65],[513,342,.2]]],
  ['halftone','Raised arm warm/cool transition','halftone','#998e70',18,9,[[136,349,.2],[120,376,.75],[107,403,.2]]],
  ['halftone','Lower neck reflected light','halftone','#aea786',18,7,[[470,551,.2],[483,562,.65],[494,566,.2]]],
  ['fold','Ivory shoulder fold, broken edge','fold','#d7c6a4',28,12,[[183,540,.2],[220,555,.7],[254,571,.2]]],
  ['fold','Upper sleeve diagonal plane','fold','#dfccaf',28,10,[[244,594,.2],[264,616,.75],[278,637,.2]]],
  ['fold','Long turning sleeve fold','fold','#c8bda7',27,13,[[308,656,.2],[294,688,.8],[278,714,.2]]],
  ['fold','Sleeve lower fold crest','fold','#e0ceb2',27,8,[[259,700,.2],[244,729,.7],[233,744,.2]]],
  ['fold','Sleeve underside reflected break','fold','#b8b198',24,7,[[207,753,.2],[224,772,.7],[244,787,.2]]],
  ['fold','Red cloak shoulder ridge','fold','#bd563e',25,10,[[283,520,.2],[312,528,.75],[339,540,.2]]],
  ['fold','Red cloak turn after clasp','fold','#9b4d3b',25,10,[[470,608,.2],[502,624,.75],[533,632,.2]]],
  ['fold','Red cloak right fold break','fold','#8e4434',23,10,[[550,653,.2],[576,673,.7],[597,683,.2]]],
  ['fold','Falling cloak left broken light','fold','#b0523e',25,12,[[127,868,.2],[101,899,.75],[83,923,.2]]],
  ['fold','Lower cloak broken accent','fold','#a94f3d',23,9,[[128,1050,.2],[99,1080,.75],[77,1097,.2]]],
  ['fold','Lower ivory fold crest','fold','#d7c7ac',24,10,[[215,1176,.2],[237,1167,.7],[260,1161,.2]]],
  ['fold','Lower ivory fold direction','fold','#d4c8b2',24,10,[[157,1225,.2],[182,1205,.7],[205,1190,.2]]],
  ['fold','Selected lit hair strand','hair','#ba8e59',22,4,[[374,321,.2],[390,307,.7],[414,303,.2]]],
  ['fold','Selected crown curl light','hair','#c49d66',22,4,[[458,273,.2],[480,269,.7],[498,267,.2]]],
  ['eye','Near existing catchlight only','eye','#c4b99a',12,.8,[[486.1,364.0,.25],[486.8,364.1,.6],[487.1,364.2,.2]]],
  ['eye','Far existing catchlight only','eye','#bcb199',10,.7,[[552.9,372.0,.25],[553.5,372.1,.55],[553.8,372.2,.2]]],
].map(([layer,description,brush,color,opacity,width,points],index)=>({ index:index+1, layer, description, brush, color, opacity, width, points, blend:'Normal' }));
const layerNames = {
  shadow: '10 Shadow Glazes / cool face and neck turns',
  halftone: '20 Halftone / olive-grey reflections and warm planes',
  fold: '30 Fold Highlights / broken cloth and selected hair accents',
  eye: '40 Eye Accents / tiny existing catchlights only',
};

async function main() {
  const sourceHash = sha(basePath);
  const metadata = await sharp(basePath).metadata();
  const width = metadata.width, height = metadata.height;
  if (width !== 1122 || height !== 1402 || strokes.length !== 30) throw new Error('Unexpected source geometry or stroke count');
  const ledger = { source: basePath, sourceSha256: sourceHash, dimensions: [width,height], generatedBase: true, authoredBrushPass: true, totalStrokes: strokes.length, brushLayers: 4, brushes, strokes, master, overlayPath, compositePath, warnings: [] };
  await withMcp('VectorCraft',{readRoot:path.join(ROOT,'source'),writeRoot:ROOT,timeoutMs:60000},async({callTool})=>{
    const call = async(name,args={})=>{const result=unwrap(await callTool(name,args));if(result?.warning)ledger.warnings.push(result.warning);if(result?.warnings?.length)ledger.warnings.push(...result.warnings);return result;};
    const run = (command,params={})=>call('run_command',{command,params});
    await run('file.new',{name:'Alexander / generated painterly base plus 30 authored bristle strokes',width,height,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
    await run('layer.setProps',{name:'00 Generated Base / reference-led image, unchanged'});
    const initial = await call('inspect_document',{depth:0});
    const baseLayer = initial.layers[0].id;
    await run('file.place',{path:basePath,link:false,rect:[0,0,width,height]});
    await run('layer.setProps',{id:baseLayer,locked:true});
    for(const brush of Object.values(brushes))await run('brush.new',{type:'bristle',name:brush.name,params:brush});
    for(const [key,name] of Object.entries(layerNames)){
      const createdLayer=await run('layer.new',{name,top:true});
      for(const stroke of strokes.filter(item=>item.layer===key)){
        await run('paint.setFill',{none:true,ids:[]});
        await run('paint.setStroke',{color:stroke.color,ids:[]});
        const created=await run('brush.freehand',{brush:brushes[stroke.brush].name,points:stroke.points,fidelity:.35,fit:true,closed:false,keepSelected:true});
        await run('stroke.set',{ids:[created.id],weight:stroke.width/brushes[stroke.brush].size});
        await run('object.setProps',{id:created.id,name:`${String(stroke.index).padStart(2,'0')} / ${stroke.description}`,opacity:stroke.opacity,blend:'Normal'});
        stroke.objectId=created.id;stroke.layerId=createdLayer.id;
      }
    }
    await run('layer.setProps',{id:baseLayer,visible:false});
    ledger.overlayExport=await call('export',{format:'png',path:overlayPath,scale:1,options:{background:'transparent',includeArtboardFill:false}});
    await run('layer.setProps',{id:baseLayer,visible:true});
    await call('save_file',{path:master,compress:true,preview:true});
    ledger.nativeStructure=await call('inspect_document',{depth:1,childLimit:35});
    await run('file.close');
  });
  const base=await sharp(basePath).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const overlay=await sharp(overlayPath).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(overlay.info.width!==width||overlay.info.height!==height)throw new Error('Wrong stroke PNG dimensions');
  const png=await sharp(base.data,{raw:{width,height,channels:4}}).composite([{input:overlay.data,raw:{width,height,channels:4},left:0,top:0}]).png().toBuffer();
  fs.writeFileSync(compositePath,png);
  const composite=await sharp(png).ensureAlpha().raw().toBuffer();
  let alphaPixels=0,changedPixels=0,unchangedRegionDifferences=0,maxAlpha=0;
  for(let i=0;i<overlay.data.length;i+=4){
    const alpha=overlay.data[i+3];if(alpha)alphaPixels++;maxAlpha=Math.max(maxAlpha,alpha);
    const changed=base.data[i]!==composite[i]||base.data[i+1]!==composite[i+1]||base.data[i+2]!==composite[i+2];
    if(changed)changedPixels++;if(changed&&!alpha)unchangedRegionDifferences++;
  }
  ledger.qa={overlayNonzeroAlphaPixels:alphaPixels,changedCompositePixels:changedPixels,maxOverlayAlpha:maxAlpha,unchangedRegionDifferences,sourceUnchanged:sha(basePath)===sourceHash,compositeSha256:sha(compositePath),nativeStrokeCount:ledger.nativeStructure.layers.reduce((n,layer)=>n+layer.children.filter(child=>child.kind==='Path').length,0),nativeLayerCount:ledger.nativeStructure.layers.length};
  if(!alphaPixels||!changedPixels||unchangedRegionDifferences||!ledger.qa.sourceUnchanged||ledger.qa.nativeStrokeCount!==30)throw new Error(`Brush proof QA failed: ${JSON.stringify(ledger.qa)}`);
  fs.writeFileSync(path.join(ROOT,'source','ArtCraft-brush-stroke-ledger.json'),JSON.stringify(ledger,null,2));
  fs.writeFileSync(path.join(ROOT,'qa','brush-proof.json'),JSON.stringify({provenance:'Generated reference-led base; 30 individually authored VectorCraft brush.freehand bristle strokes on four named paint layers. Exact source + transparent-stroke PNG composite; no resampling.',...ledger.qa},null,2));
  console.log(JSON.stringify({master,overlayPath,compositePath,totalStrokes:strokes.length,brushLayers:4,...ledger.qa,warnings:ledger.warnings}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
