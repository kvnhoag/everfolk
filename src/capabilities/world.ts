import type { Condition, Effect, WorldPack } from "../types.ts";
import { CAPABILITY_RULES } from "./rules.ts";
import { CAPABILITY_OPERATIONS } from "./operations.ts";
import { adaptSkillTreeEvents } from "./events.ts";

export const DEEP_SKILL_WORLD_VERSION = "alexandria-lives-3";
const cap = (node: string): Condition => ({ type: "capability", node });
/** A new immutable free-play revision; all earlier packs retain their own rules. */
export function buildDeepSkillWorld(base: WorldPack): WorldPack {
  const world = structuredClone(base);
  if (!world.character || !world.vocations || !world.demo || !world.economy) throw new Error("Deep skills need a vocation, household and money world.");
  world.version = DEEP_SKILL_WORLD_VERSION;
  world.title = "Alexandria — Work, inquiry and learned capabilities";
  world.description = "Learn by doing: develop farming, artisan work, inquiry, public service and trade through practice, recorded achievements and consequential decisions.";
  world.capabilities = { version: "deep-1", rules: structuredClone([...CAPABILITY_RULES]) };
  world.vocations.materials["flax-seed"] = { price: 2, stock: 400 };
  const supported = ["farming", "craft", "pottery", "carving", "sculpture", "philosophy", "literacy", "reckoning", "oratory"];
  for (const id of supported) { delete world.character.skills[id].gainCurve; delete world.character.skills[id].prerequisites; }
  const support: Record<string,string[]> = { farming:["reckoning","craft"],craft:["carving","reckoning"],pottery:["craft","reckoning"],carving:["craft","sculpture"],sculpture:["craft","carving"],philosophy:["literacy","oratory"],literacy:["philosophy","reckoning"],reckoning:["literacy","oratory"],oratory:["philosophy","literacy"] };
  const add = (id:string,text:string, action: import("../vocations/types.ts").VocationAction, yearly=true, when?:Condition, effects:Effect[]=[]) => {
    world.vocations!.actions[id] = action;
    world.character!.activities.push({ id:`v-${id}`,text,category:yearly?"career":"finance",minAge:12,usesYearlyActivity:yearly,...(when?{when}:{}),outcomes:[{id:`v-${id}-done`,text,weight:1,effects:[{type:"vocation",action:id},...effects]}] });
  };
  // Existing generic vocation work cannot bypass the actual branch evidence.
  const keepPaid = new Set(["paid-tutoring","paid-research","public-service"]);
  const removed = new Set(Object.entries(world.vocations.actions).filter(([id,a])=>a.kind==="work"&&!a.practice&&!keepPaid.has(id)).map(([id])=>id));
  world.character.activities = world.character.activities.filter(a=>!a.outcomes.some(o=>o.effects.some(e=>e.type==="vocation"&&removed.has(e.action))));
  for(const id of removed)delete world.vocations.actions[id];
  // Events that only announced old vocational work are superseded by the new receipts and branch events.
  const referencesRemoved=(condition:Condition|undefined):boolean=>condition?.type==="vocation"?removed.has(condition.action):condition?.type==="all"||condition?.type==="any"?condition.conditions.some(referencesRemoved):condition?.type==="not"?referencesRemoved(condition.condition):false;
  world.events=world.events.filter(event=>!referencesRemoved(event.when)&&!event.choices.some(choice=>referencesRemoved(choice.when)));
  for(const [id,action]of Object.entries(world.vocations.actions))if(action.kind==="work"&&action.practice)action.supports=support[action.primary]??[];
  for(const id of supported)if(!world.vocations.actions[`practice-${id}`])add(`practice-${id}`,`Deliberately practise ${world.character.skills[id].label} (2 dr)`,{kind:"work",fee:2,pay:0,payer:"workshop",primary:id,supports:support[id]??[],practice:true},true,undefined,[{type:"stat",stat:"knowledge",delta:1}]);
  for(const [id,operation]of Object.entries(CAPABILITY_OPERATIONS)){
    const effects:Effect[]=operation.minor?[]:[{type:"stat",stat:"knowledge",delta:operation.primary==="philosophy"?2:1},...(operation.kind==="farm"||operation.kind==="work"?[{type:"stat" as const,stat:"health",delta:-1}]:[]),...(operation.primary==="philosophy"&&["public-address","negotiate-agreement","coalition-agreement","public-service"].includes(id)?[{type:"stat" as const,stat:"bonds",delta:1}]:[])];
    add(`cap-${id.toLowerCase()}`,operation.title,{kind:"capability",operation:id},!operation.minor,operation.node?cap(operation.node):undefined,effects);
  }
  add("buy-flax-seed","Buy 4 flax seed units (8 dr)",{kind:"buy",item:"flax-seed",quantity:4},false);
  for(const [id,recipe]of Object.entries(world.vocations.recipes)){
    const sizes=id.includes("vessel")?[4,8,12]:id.includes("garment")?[4,8]:[];
    for(const quantity of sizes)for(const inspected of [false,true])add(`make-${id}-${quantity}${inspected?"-inspected":""}`,`Make ${quantity} ${recipe.title.toLowerCase()}${inspected?" with paid inspection":""}`,{kind:"make",recipe:id,quantity,inspected});
    add(`make-${id}-inspected`,`Make ${recipe.title.toLowerCase()} with paid inspection`,{kind:"make",recipe:id,inspected:true});
    if(id.includes("vessel"))add(`make-${id}-fired`,`Make ${recipe.title.toLowerCase()} with controlled firing and inspection`,{kind:"make",recipe:id,inspected:true,controlledFiring:true});
  }
  const roleNodes:Record<string,string>={apprentice:"A1",tailor:"AT5",potter:"AC5",sculptor:"AS5","philosophy-tutor":"P4",scientist:"PS10",politician:"PP10","master-cultivator":"FC10","master-household-farmer":"FR10","master-tailor":"AT10","master-potter":"AC10","master-sculptor":"AS10",merchant:"T10","trading-house-manager":"T10"};
  for(const [id,node]of Object.entries(roleNodes)){
    let job=world.character.jobs.find(j=>j.id===id);
    if(!job){job={id,title:id.replaceAll("-"," ").replace(/^./,c=>c.toUpperCase()),description:"Recorded mastery opens real work and commissions; no automatic salary is created.",minAge:18,yearlyEffects:[]};world.character.jobs.push(job);}
    job.requirements={};job.yearlyEffects=[];
    const old=world.character.activities.find(a=>a.id===`v-qualify-${id}`);
    if(old)old.when=cap(node);else world.character.activities.push({id:`v-qualify-${id}`,text:`Take up work as ${job.title.toLowerCase()}`,category:"career",minAge:18,when:cap(node),usesYearlyActivity:false,outcomes:[{id:`v-appointed-${id}`,text:`Your recorded work qualifies you as ${job.title.toLowerCase()}.`,weight:1,effects:[{type:"job",job:id}]}]});
    if(!world.demo.availability.playableJobs.includes(id))world.demo.availability.playableJobs.push(id);
    world.demo.availability.unavailableJobs=world.demo.availability.unavailableJobs.filter(j=>j!==id);
  }
  for(const [id,node]of Object.entries({"paid-tutoring":"P4","paid-research":"PS10","public-service":"PP10"})){
    const activity=world.character.activities.find(a=>a.id===`v-${id}`);if(activity)activity.when=cap(node);
  }
  // Legacy event appointments into a supported career must meet the same earned-node gate.
  const gateEffects=(effects:Effect[],when:Condition|undefined):Condition|undefined=>{
    const nodes=[...new Set(effects.filter((e):e is Extract<Effect,{type:"job"}>=>e.type==="job"&&Boolean(e.job&&roleNodes[e.job])).map(e=>roleNodes[e.job!]))];
    return nodes.length?{type:"all",conditions:[...(when?[when]:[]),...nodes.map(cap)]}:when;
  };
  for(const event of world.events)for(const choice of event.choices){const when=gateEffects(choice.outcomes.flatMap(o=>o.effects),choice.when);if(when)choice.when=when;else delete choice.when;}
  return adaptSkillTreeEvents(world);
}
