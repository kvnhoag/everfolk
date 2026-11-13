const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../../..');
const load=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const reports=['a','b'].map(name=>load(path.join(root,'qa/audit-'+name+'/audit.json')));
const rows=reports.flatMap(report=>report.rows);
const ids=new Set(rows.map(row=>row.id));
const current=load(path.join(repo,'client/models/card-art-registry.json')).assets.filter(row=>row.kind==='contribution');
if(rows.length!==104||ids.size!==104||current.some(row=>!ids.has(row.id)))throw Error('Incomplete contribution-card coverage');
const selected=['ptolemy-rare-male','ptolemy-rare-female','euclid-rare-male','demetrius-rare-female','eumenes-rare-male','eumenes-rare-female'];
const pairs=new Set(rows.map(row=>row.id.replace(/-(male|female)$/,'')));
const result={
  schemaVersion:1,reviewMethod:'Visual inspection of all active portraits in labelled paired sheets, with full-size review of suspected defects; no automated anatomy score.',
  contributionCardsReviewed:rows.length,male:rows.filter(row=>row.gender==='male').length,female:rows.filter(row=>row.gender==='female').length,pairedRoles:pairs.size,figureSets:new Set(rows.map(row=>row.figureId)).size,
  selectedForCorrection:selected,
  selection:'Correct the user-reported Supply Commissioner pair and four other clear strained-neck or work-gaze mismatches. Preserve contextual command, teaching, conversation and navigation glances. Camera-facing portraits with coherent necks are recorded as optional refinements.',
  additionalFullSizeDecision:{'nearchus-common-female':'Coherent head/neck with modest outward portrait gaze while handling a line; no strained-neck repair selected.','nearchus-rare-female':'Pilot observing the horizon is role-appropriate; neck/shoulders support this moderate turn.'},
  rows:rows.map(row=>({...row,status:row.status||row.verdict,selectedForCorrection:selected.includes(row.id)}))
};
if(result.male!==52||result.female!==52||pairs.size!==52||result.figureSets!==13)throw Error('Incomplete male/female or figure coverage');
fs.writeFileSync(path.join(root,'qa/audit-summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({reviewed:104,male:52,female:52,pairedRoles:52,selected:selected.length}));
