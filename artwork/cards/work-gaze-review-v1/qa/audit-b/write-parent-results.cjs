const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const REPO=path.resolve(__dirname,'../../../../..');
const notes={
 alexander:'Head follows the commanding riding direction; neck joins naturally to the armoured torso.',
 aristotle:'Frontal teaching gesture addresses the viewer/listeners; no strained head rotation.',
 euclid:'Slight downward three-quarter head over the geometry table; neck is aligned with shoulders.',
 lysippos:'Raised chin follows the tall sculpture in front/right; looking upward is justified by the subject.',
 pytheas:'Gaze follows the seaward horizon; normal lookout posture.',
 menander:'Moderate head turn addresses the stage gathering; suitable speaking/storytelling pose.',
 demetrius:'Raised commanding gaze with an indicating arm; head/neck remain plausibly joined to the torso.',
 theophrastus:'Head and eyes examine the raised botanical specimen.',
 zeno:'Head addresses the visible student; open-hand teaching gesture supports the gaze.',
 ptolemy:'Modest outward statesman portrait gaze; hands rest on documents rather than a precision task.',
 cleomenes:'Head and eyes inspect the raised grain sample; neck inclination suits the examination.',
 nearchus:'Outward lookout gaze suits the shipboard navigator role; no neck defect.',
 eumenes:'Slight outward portrait gaze while holding a scroll; no extreme head/shoulder rotation.'
};
const rows=JSON.parse(fs.readFileSync(path.join(REPO,'client/models/card-art-registry.json'))).assets.filter(r=>r.kind==='parent').map(r=>({id:r.id,title:r.title,portraitSrc:r.portraitSrc,portraitSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO,'public'+r.portraitSrc))).digest('hex'),verdict:'valid',reason:notes[r.figureId]}));
if(rows.length!==13||rows.some(r=>!r.reason))throw Error('Incomplete parent review');
const report={parentsReviewed:13,sharedRarityVariants:19,method:'Inspected labelled thirteen-parent contact sheet at224×280 per portrait. No actual suspect requiring enlargement found. Parent portrait, command, teaching, lookout and specimen-examination poses were judged by their depicted action rather than requiring every subject to look down.',clearHeadNeckDefects:[],productionEdits:false,rows};
fs.writeFileSync(path.join(__dirname,'parent-audit.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'parent-audit.md'),['# Parent portrait neck/gaze review','', '**13 parent portraits reviewed**, also covering19 rarity variants that share those portraits. No clear head/neck defect found; no parent edit is recommended.','', '| Parent | Verdict | Reason |','|---|---|---|',...rows.map(r=>`| ${r.id} | valid | ${r.reason} |`)].join('\n')+'\n');
console.log(JSON.stringify({reviewed:rows.length,clearDefects:0,workersRemaining:0}));
