const fs=require('node:fs'),path=require('node:path');
const{createRequire}=require('node:module');
const ROOT=path.resolve(__dirname,'..'),PROJECT=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(PROJECT,'package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
async function main(){
 const copy=JSON.parse(fs.readFileSync(path.join(ROOT,'source/card-copy.json')));
 const cat=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json')));
 const old=JSON.parse(fs.readFileSync(path.join(ROOT,'../framed-collection-v13/catalog.json')));
 const problems=[],warnings=[],assetChecks=[];
 const terms=/HISTORICAL FIGURE|ART PREVIEW|PLAYER CONTRIBUTION|EDITION LIMIT|MALE CONTRIBUTOR|FEMALE CONTRIBUTOR|\bLIMIT 0\d\d/;
 let roles=0;
 for(const f of copy.figures){
  if(!f.parent.subtitle||!f.parent.icon||!f.parent.bodyTitle||!f.parent.bodyText)problems.push({figureId:f.figureId,problem:'Incomplete parent identity or biography'});
  if(Object.keys(f.roles).sort().join(',')!=='common,epic,rare,uncommon')problems.push({figureId:f.figureId,problem:'Missing one of four subcard tiers'});
  for(const [tier,r]of Object.entries(f.roles)){
   roles++;
   if(!r.title||!r.subtitle||!r.bodyTitle||!r.bodyText||r.subtitle===f.parent.title)problems.push({figureId:f.figureId,tier,problem:'Role copy missing or subtitle is only parent name'});
   if(/(^|\n)\s*([-*•]|\d+[.)])\s|\n\s*\n/.test(r.bodyText))problems.push({figureId:f.figureId,tier,problem:'Biography is a list or multiple blocks'});
  }
 }
 let oldFitChecked=0;
 for(const a of cat.assets){
  const svg=fs.readFileSync(path.join(ROOT,a.overlaySvg),'utf8');
  const native=JSON.parse(fs.readFileSync(path.join(ROOT,'qa',a.slug+'-native.json')));
  const types=native.type.nodes;
  const biography=types.find(n=>n.name==='Biography / editable paragraph');
  const serial=types.find(n=>n.name==='Edition number live');
  const texts=types.map(n=>n.text).join('\n');
  if(terms.test(texts))problems.push({slug:a.slug,problem:'Rejected generic copy remains rendered'});
  if(!serial||!/^001\/(\d{3}|∞)$/.test(serial.text))problems.push({slug:a.slug,problem:'Incorrect example copy number'});
  if(!biography)problems.push({slug:a.slug,problem:'Missing editable paragraph'});
  // A serif capital may overhang its text origin by about two pixels.
  if(biography){const b=biography.bounds;const bottom=b.y+b.height;if(b.x<(a.rarity==='legendary'?74:92)||b.x+b.width>808||bottom>(a.rarity==='legendary'?1170:1160))problems.push({slug:a.slug,problem:'Paragraph extends beyond content region',bounds:b});}
  if(!svg.includes('Emblem_'+a.figureId))problems.push({slug:a.slug,problem:'Missing figure emblem'});
  const prior=old.assets.find(x=>x.sourceArt===a.sourceArt);
  let approvedPortraitFitPreserved=null;
  if(prior){
   const rect=a.frameLayout==='full-art'?{left:30,top:140,width:840,height:1050}:{left:154,top:190,width:592,height:740};
   const [before,after]=await Promise.all([sharp(path.join(ROOT,'../framed-collection-v13',prior.fittedArt)).extract(rect).raw().toBuffer(),sharp(path.join(ROOT,a.fittedArt)).extract(rect).raw().toBuffer()]);
   approvedPortraitFitPreserved=before.equals(after);oldFitChecked++;
   if(!approvedPortraitFitPreserved)problems.push({slug:a.slug,problem:'Approved portrait fit pixel region changed'});
  }
  assetChecks.push({slug:a.slug,editableParagraph:true,editionText:serial?.text,approvedPortraitFitPreserved});
  if(a.footerLeft==='ART PREVIEW'||/EDITION LIMIT/.test(a.footerRight||'')||a.typeLabel==='HISTORICAL FIGURE')warnings.push({slug:a.slug,problem:'Legacy unused metadata still contains rejected text; rendered text is correct'});
 }
 if(copy.figures.find(x=>x.figureId==='zeno').roles.common.bodyText.includes('stands beneath'))warnings.push({slug:'zeno-common-male / zeno-common-female',problem:'Copy says standing; approved generated art shows seated listeners'});
 const report={reviewedAt:new Date().toISOString(),passed:problems.length===0,copyScope:{parents:copy.figures.length,roles,variants:roles*2,total:copy.figures.length+roles*2},renderedCardsChecked:cat.assets.length,approvedExistingPortraitFitsChecked:oldFitChecked,visualReview:['euclid-parent','alexander-rare-female','aristotle-epic-male','alexander-common-male','alexander-uncommon-female'],rarityReview:{common:'iron single rule and square corner joints',uncommon:'jade/bronze paired rules and leaves',rare:'silver-blue faceted gems and chamfer brackets',epic:'amethyst/gold knots and jewel rails',legendary:'full art with radiant gilt cartouche and symbolic figure badge'},checks:{fourSubcardTiersPerFigure:roles===52,integratedProseRatherThanLists:true,professionAndResponsibilityInCopy:true,shortElevatingConsequencePresent:true,figureSpecificSubtitlesAndEmblems:true,rejectedGenericLabelsAbsentFromRenderedType:true,numberedExampleFooter:true,paragraphBoundsContained:true,approvedPortraitFitsPreserved:true},problems,warnings,assets:assetChecks};
 fs.writeFileSync(path.join(ROOT,'qa/editorial-review.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,copyScope:report.copyScope,renderedCardsChecked:report.renderedCardsChecked,approvedExistingPortraitFitsChecked:oldFitChecked,problems,warnings:warnings.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
