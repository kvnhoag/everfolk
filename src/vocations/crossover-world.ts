import type { Condition, WorldPack } from "../types.ts";
import { buildCapabilityWorld } from "./capability-world.ts";
import { ATTRIBUTE_NODES, CROSSOVER_NODES } from "../capabilities/attribute-catalog.ts";
import { capabilityAction } from "../capabilities/catalog.ts";
import { MILITARY_QUALIFICATIONS } from "../capabilities/military.ts";
import { LIVES_WORLD_VERSION } from "./ids.ts";

/** New births opt in. Version 1 capability packs and all previous saves remain immutable. */
export function buildCrossoverWorld(base:WorldPack):WorldPack {
  const world=buildCapabilityWorld(base), character=world.character!, definition=world.vocations!;
  world.version=LIVES_WORLD_VERSION;
  world.title="Alexandria — Attributes and connected paths";
  world.description="Develop Physique, Handmade, Knowledge and Trade. A small military lane combines physical preparation, knowledge and proved service to open career opportunities.";
  world.capabilities={version:2,nodes:structuredClone([...ATTRIBUTE_NODES])};
  for(const [id,label]of Object.entries({strength:"Strength",endurance:"Endurance"})) character.skills[id]={label,min:0,max:100,initial:0,branch:"Physique",tier:0,description:`Trainable ${label.toLowerCase()} developed through physical work and conditioning; distinct from current Health.`};
  for(const [id,skill]of Object.entries(character.skills)) skill.branch=["strength","endurance","farming","warfare","seamanship"].includes(id)?"Physique":["craft","pottery","carving","sculpture","music"].includes(id)?"Handmade":"Knowledge";
  const physicalWork=character.activities.find(a=>a.id===capabilityAction("F1"))!;
  physicalWork.text="Physical work · recorded fieldwork";
  for(const id of ["strength","endurance","warfare"]) {
    const action=`practice-${id}`;
    definition.actions[action]={kind:"work",primary:id,supports:[],fee:2,pay:0,payer:"workshop",practice:true};
    character.activities.push({id:`v-${action}`,text:`Practice ${character.skills[id].label} (2 dr)`,category:"training",minAge:8,usesYearlyActivity:true,
      outcomes:[{id:`v-${action}-done`,text:`Completed ${character.skills[id].label} practice.`,weight:1,effects:[{type:"vocation",action}]}]});
  }
  for(const node of CROSSOVER_NODES) character.activities.push({id:capabilityAction(node.id),text:`${node.title} · recorded work`,category:"training",minAge:12,usesYearlyActivity:true,
    outcomes:[{id:`${capabilityAction(node.id)}-done`,text:`Completed ${node.title} work.`,weight:1,effects:[{type:"capability",node:node.id}]}]});
  for(const job of character.jobs) if(MILITARY_QUALIFICATIONS[job.id]) {
    const node=world.capabilities.nodes.find(n=>n.id===MILITARY_QUALIFICATIONS[job.id])!;
    job.requirements={...node.minimumProficiency};
    job.description=`A ${job.id} appointment requires demonstrated ${node.title.toLowerCase()}, physical preparation and recorded Knowledge. Wages and rations come from finite army accounts.`;
    job.yearlyEffects=[{type:"skill",skill:"warfare",delta:2},{type:"stat",stat:"health",delta:-1},{type:"stat",stat:"bonds",delta:-1}];
  }
  const qualify=(job:string):Condition=>({type:"capability",node:MILITARY_QUALIFICATIONS[job]});
  for(const activity of character.activities) {
    const military=activity.outcomes.flatMap(o=>o.effects).find(e=>e.type==="job"&&e.job&&MILITARY_QUALIFICATIONS[e.job]);
    if(military?.type!=="job"||!military.job)continue;
    activity.when=activity.when?{type:"all",conditions:[activity.when,qualify(military.job)]}:qualify(military.job);
    for(const outcome of activity.outcomes) outcome.effects=outcome.effects.filter(e=>!(e.type==="stat"&&e.stat==="wealth"));
  }
  // Global job-effect checks enforce qualification even in random appointments.
  const jobs=Object.keys(MILITARY_QUALIFICATIONS), availability=world.demo!.availability;
  availability.unavailableJobs=availability.unavailableJobs.filter(id=>!jobs.includes(id));
  for(const id of jobs)if(!availability.playableJobs.includes(id))availability.playableJobs.push(id);
  availability.unavailableSkills=availability.unavailableSkills.filter(id=>!["strength","endurance","warfare"].includes(id));
  for(const event of world.events) for(const choice of event.choices) {
    const job=choice.outcomes.flatMap(o=>o.effects).find(e=>e.type==="job"&&e.job&&MILITARY_QUALIFICATIONS[e.job]);
    if(job?.type==="job"&&job.job)choice.when=choice.when?{type:"all",conditions:[choice.when,qualify(job.job)]}:qualify(job.job);
  }
  return world;
}
