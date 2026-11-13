const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const REPO=path.resolve(__dirname,'../../../../..');
const registry=JSON.parse(fs.readFileSync(path.join(REPO,'client/models/card-art-registry.json')));
const sets=['theophrastus','zeno','ptolemy','cleomenes','nearchus','eumenes'];
const notes={
 'theophrastus-common-male':['valid','Head inclined toward the pot and watering task; neck follows the torso.'],
 'theophrastus-common-female':['mild_turn','Watering beside plants while glancing to the right; a modest turn with a relaxed neck.','Optional: lower eyes toward the watering vessel or plant.'],
 'theophrastus-uncommon-male':['optional_task_gaze','Frontal portrait gaze while holding a sprig and marking a tablet; no extreme neck rotation.','Optional: look at the raised specimen or tablet.'],
 'theophrastus-uncommon-female':['optional_task_gaze','Frontal portrait gaze while holding a sprig and marking a tablet; no extreme neck rotation.','Optional: look at the raised specimen or tablet.'],
 'theophrastus-rare-male':['valid','Profile turns toward the plant held at eye level; neck and shoulders form a plausible seated posture.'],
 'theophrastus-rare-female':['valid','Gaze follows the raised specimen; head rotation suits the examination task.'],
 'theophrastus-epic-male':['valid','Gaze and open hand address visible students; lecture pose rather than solitary writing.'],
 'theophrastus-epic-female':['valid','Gaze addresses the visible listeners and plant discussion; neck turn is modest.'],
 'zeno-common-male':['valid','Listening pose with gaze directed toward the gathering; tablet is resting rather than being written on.'],
 'zeno-common-female':['valid','Profile faces the gathering; head and torso align plausibly for listening.'],
 'zeno-uncommon-male':['valid','Open-hand discussion gesture addresses a nearby listener; forward head is consistent with the conversation.'],
 'zeno-uncommon-female':['valid','Discussion gesture and gaze address the nearby listener; no forced neck twist.'],
 'zeno-rare-male':['valid','Head follows the open hand toward visible interlocutors; natural seated discussion profile.'],
 'zeno-rare-female':['valid','Head follows the open hand toward visible interlocutors; natural seated discussion profile.'],
 'zeno-epic-male':['valid','Slight turn toward the right-side listener suits the teaching gesture.'],
 'zeno-epic-female':['valid','Slight turn toward the right-side listener suits the teaching gesture.'],
 'ptolemy-common-male':['valid','Recently revised desk-work pose; eyes and slight head inclination follow the records.'],
 'ptolemy-common-female':['valid','Recently revised desk-work pose; eyes and slight head inclination follow the records.'],
 'ptolemy-uncommon-male':['optional_task_gaze','Looks forward while holding a coin and marking a tablet; no excessive neck twist.','Optional: redirect eyes toward the coin or tablet.'],
 'ptolemy-uncommon-female':['optional_task_gaze','Looks forward while holding a coin and marking a tablet; no excessive neck twist.','Optional: redirect eyes toward the coin or tablet.'],
 'ptolemy-rare-male':['needs_fix','Head turns sharply left while shoulders, held tablet and sealing hand work toward the front/right. This is the user-reported strained pose.','Relax head into a downward three-quarter view aligned with torso; look at the sack seal or tablet.'],
 'ptolemy-rare-female':['needs_fix','Head turns sharply left above a forward-working torso, with a visibly elongated/twisted neck while the hands hold a tablet and check a seal.','Relax head into a downward three-quarter view aligned with torso; look at the sack seal or tablet.'],
 'ptolemy-epic-male':['valid','Forward/right gaze follows an open-hand administrative instruction toward visible staff; plausible speaking posture.'],
 'ptolemy-epic-female':['valid','Gaze follows the open-hand administrative instruction toward staff; modest three-quarter neck angle.'],
 'cleomenes-common-male':['valid','Head inclines toward grain held for inspection; gaze suits the task.'],
 'cleomenes-common-female':['valid','Head inclines toward the sack closure and both working hands.'],
 'cleomenes-uncommon-male':['optional_task_gaze','Frontal portrait gaze while writing; head/neck remain centred and unstrained.','Optional: lower eyes toward the tablet.'],
 'cleomenes-uncommon-female':['optional_task_gaze','Frontal portrait gaze while writing; head/neck remain centred and unstrained.','Optional: lower eyes toward the tablet.'],
 'cleomenes-rare-male':['valid','Profile looks toward balance and grain measurement; natural torso/head relationship.'],
 'cleomenes-rare-female':['valid','Profile looks toward balance and grain measurement; natural torso/head relationship.'],
 'cleomenes-epic-male':['valid','Downward gaze follows the sealing/document task with a natural neck inclination.'],
 'cleomenes-epic-female':['valid','Downward gaze follows the held record and writing tablet.'],
 'nearchus-common-male':['valid','Eyes lowered toward the line being worked, with head aligned to torso.'],
 'nearchus-common-female':['task_gaze_improvement','Hands visibly work a knot while eyes look outward at the viewer; neck anatomy is plausible, but the task focus is disconnected.','Lower head and eyes toward the knot; preserve rope and both hands.'],
 'nearchus-uncommon-male':['valid','Coastal scout turns toward visible coast/horizon while recording observations; task justifies outward gaze.'],
 'nearchus-uncommon-female':['valid','Coastal scout turns toward visible coast/horizon while recording observations; task justifies outward gaze.'],
 'nearchus-rare-male':['valid','Pilot looks outward toward the coastal passage with a restrained head turn; observing the sea is part of the role.'],
 'nearchus-rare-female':['task_gaze_improvement','Chin lifts and turns away from the chart while pen remains on it, producing an upward neck emphasis. A pilot can observe the horizon, so this is a work-gaze improvement rather than a definite anatomical defect.','Bring chin down and eyes to the route on the chart; keep the sea-observation alternative only if the writing action pauses.'],
 'nearchus-epic-male':['valid','Navigator looks along the sailing route; tablet and cup are held/resting rather than an active precision task.'],
 'nearchus-epic-female':['valid','Navigator watches the route from a seated position; head turn is plausible for lookout/navigation.'],
 'eumenes-common-male':['valid','Head and eyes follow the scroll bundle being checked on the shelf.'],
 'eumenes-common-female':['valid','Head and eyes follow the scroll bundle being checked on the shelf.'],
 'eumenes-uncommon-male':['valid','Natural downward gaze to the dispatch being copied; neck follows the writing action.'],
 'eumenes-uncommon-female':['valid','Natural downward gaze to the dispatch being copied; neck follows the writing action.'],
 'eumenes-rare-male':['task_gaze_fix','Pen touches the map while the other hand holds a dispatch, but the head tilts up and away without a visible interlocutor. Clear task-focus mismatch; neck itself is less extreme than Supply Commissioner.','Slight downward three-quarter head, eyes comparing held dispatch and desk map; preserve hands, pen, papers and lamp.'],
 'eumenes-rare-female':['task_gaze_fix','Pen touches the dispatch/map while the head tilts up and away without a visible interlocutor. Clear task-focus mismatch; neck itself is less extreme than Supply Commissioner.','Slight downward three-quarter head, eyes toward the pen and dispatch/map; preserve hands, pen, papers and lamp.'],
 'eumenes-epic-male':['valid','Head and eyes follow the document being reviewed and written on.'],
 'eumenes-epic-female':['valid','Head and eyes follow the document being reviewed and written on.']
};
const rows=registry.assets.filter(r=>sets.includes(r.figureId)&&r.kind==='contribution').map(row=>{
 const n=notes[row.id];if(!n)throw Error('Missing visual verdict: '+row.id);
 const image=fs.readFileSync(path.join(REPO,'public'+row.portraitSrc));
 return{id:row.id,figureId:row.figureId,gender:row.gender,title:row.displayTitle,portraitSrc:row.portraitSrc,portraitSha256:crypto.createHash('sha256').update(image).digest('hex'),verdict:n[0],reason:n[1],recommendation:n[2]||null};
});
if(rows.length!==48)throw Error('Expected48');
const report={scope:'Read-only visual audit of six figure sets, all four contribution tiers, both male/female variants.',cardsReviewed:48,reviewMethod:'All six labelled 280×350-per-card sheets inspected; suspected Eumenes Rare and Nearchus female mismatches inspected at full840×1050. Anatomy judgments are visual composition assessments, not clinical claims.',counts:Object.fromEntries([...new Set(rows.map(r=>r.verdict))].map(k=>[k,rows.filter(r=>r.verdict===k).length])),requiredSupplyFixes:rows.filter(r=>r.verdict==='needs_fix').map(r=>r.id),clearAdditionalTaskFixes:rows.filter(r=>r.verdict==='task_gaze_fix').map(r=>r.id),mediumPriorityImprovements:rows.filter(r=>r.verdict==='task_gaze_improvement').map(r=>r.id),rows};
fs.writeFileSync(path.join(__dirname,'audit.json'),JSON.stringify(report,null,2)+'\n');
const md=['# Work gaze review — six figure sets','',report.scope,'',`Reviewed: **${rows.length} cards**.`, '', 'Supply Commissioner requires both gender variants to be corrected. Additional clear task-focus repairs are Campaign Correspondent male/female. Fleet Deckhand female and Pilot of the Indus Fleet female are medium-priority gaze improvements, with less certainty of a neck-anatomy defect. Frontal writers are separately marked optional; outward-looking speakers, scouts and navigators have role-appropriate gaze.', '', '| Card | Verdict | Reason |', '|---|---|---|',...rows.map(r=>`| ${r.id} | ${r.verdict} | ${r.reason} |`)];
fs.writeFileSync(path.join(__dirname,'audit.md'),md.join('\n')+'\n');
console.log(JSON.stringify({cards:rows.length,counts:report.counts,required:report.requiredSupplyFixes,additional:report.clearAdditionalTaskFixes,medium:report.mediumPriorityImprovements}));
