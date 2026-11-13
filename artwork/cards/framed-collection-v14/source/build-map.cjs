const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const COPY=require('./card-copy.json');
const PREVIOUS=require('../../framed-collection-v13/source/framing-map.json');
const INNER=require('../../figure-inner-art-v12/catalog.json');
const LIMITS={common:null,uncommon:null,rare:100,epic:25,legendary:10};
const assets=[];
for(const figure of COPY.figures){
 const oldParent=PREVIOUS.assets.find(a=>a.figureId===figure.figureId&&a.kind==='parent');
 const common={figureId:figure.figureId,figureName:figure.parent.title,exampleCopyNumber:1,copySerialIsExample:true,owner:null};
 assets.push({...oldParent,...common,...figure.parent,slug:figure.figureId+'-parent',kind:'parent',gender:'male',canonicalTitle:figure.parent.title,frameLayout:oldParent.rarity==='legendary'?'full-art':'standard',editionLimit:LIMITS[oldParent.rarity],collectionIndex:assets.length+1});
 for(const tier of ['common','uncommon','rare','epic'])for(const gender of ['male','female']){
  const copy=figure.roles[tier];
  const old=INNER.assets.find(a=>a.roleId===copy.sourceRoleSlug&&a.gender===gender);
  const slug=figure.figureId+'-'+tier+'-'+gender;
  const art=old?'artwork/cards/figure-inner-art-v12/'+old.final:'artwork/cards/figure-inner-art-v14/assets/'+slug+'-pixel.png';
  assets.push({...common,...copy,slug,kind:'contribution',gender,tier,rarity:tier,canonicalTitle:copy.title,frameLayout:'standard',sourceArt:art,sourceArtSlug:old?.slug||slug,editionLimit:LIMITS[tier],collectionIndex:assets.length+1,gameplayRarity:old&&old.tier?tier:null,raritySource:copy.newArt?'user-requested-four-tier-collection':old?.tier?'existing-figure-progression-tier':'editorial-four-tier-extension'});
 }
}
for(const asset of assets)for(const key of ['typeLabel','footerLeft','footerRight','intendedEditionLimit','copySerial'])delete asset[key];
if(assets.length!==117||assets.filter(a=>a.newArt).length!==34)throw Error('Roster count mismatch');
fs.writeFileSync(path.join(ROOT,'source','framing-map.json'),JSON.stringify({libraryId:'everfolk-framed-collection-v14',date:'2026-11-13',expected:117,parents:13,subcards:104,rolePairs:52,newInnerArt:34,limits:LIMITS,notes:['Four subcard tiers for every figure, with male and female artwork.','New Common roles and Nearchus/Eumenes lower tiers are an editorial art collection extension; gameplay code is unchanged.','Edition numerators are display examples requested by the user, not an ownership assertion.'],assets},null,2));
console.log(JSON.stringify({cards:assets.length,newArt:assets.filter(a=>a.newArt).length,rarities:Object.fromEntries(Object.keys(LIMITS).map(r=>[r,assets.filter(a=>a.rarity===r).length]))}));
