import type { Condition, WorldPack } from "../types.ts";
import { CAPABILITY_NODES, capabilityAction } from "./catalog.ts";

const learned = (node: string): Condition => ({ type: "capability", node });
/** Called only by the new-revision builder, never by retained world packs. */
export function configureCapabilitiesWorld(world: WorldPack): void {
  if (!world.character || !world.vocations || !world.demo) throw new Error("Capability worlds require character, household and vocation ledgers.");
  world.capabilities = { version: 1, nodes: structuredClone([...CAPABILITY_NODES]) };
  world.title = "Alexandria — Skills, work and mastery";
  world.description = "Earn practical capabilities through practice and recorded work. Follow cultivation, household resilience, artisan production, inquiry, civic service or commercial planning to mastery.";
  const def = world.vocations;
  def.materials["flax-seed"] = { price: 3, stock: 200 };
  def.materials["prepared-clay"] = { price: 2, stock: 0 };
  // Proof outputs and their finite buyers share the existing product ledger.
  for (const [id,label] of Object.entries({ "flax-seed": "flax seed", "prepared-clay": "prepared clay" })) {
    if (id === "prepared-clay") continue;
    def.actions[`buy-${id}`] = { kind: "buy", item: id, quantity: 8 };
    world.character.activities.push({ id: `v-buy-${id}`, text: `Buy 8 ${label} (${def.materials[id].price * 8} dr)`, category: "career", minAge: 12, usesYearlyActivity: false,
      outcomes: [{id:`v-buy-${id}-done`,text:`Bought ${label}.`,weight:1,effects:[{type:"vocation",action:`buy-${id}`}]}] });
  }
  const skills = ["farming","craft","pottery","carving","sculpture","philosophy","literacy","reckoning","oratory"];
  for (const id of skills) {
    const action = `practice-${id}`;
    if (!def.actions[action]) {
      def.actions[action] = { kind:"work",primary:id,supports:[],fee:2,pay:0,payer:"workshop",practice:true };
      world.character.activities.push({id:`v-${action}`,text:`Practice ${world.character.skills[id].label} (2 dr)`,category:"training",minAge:8,usesYearlyActivity:true,
        outcomes:[{id:`v-${action}-done`,text:`Completed ${world.character.skills[id].label} practice.`,weight:1,effects:[{type:"vocation",action}]}]});
    }
  }
  // Every node has a normal, replayable engine activity. Views never mutate progression.
  for (const node of world.capabilities.nodes) world.character.activities.push({
    id: capabilityAction(node.id), text: `${node.title} · recorded work`, category: "training", minAge: 12, usesYearlyActivity: true,
    outcomes: [{ id: `${capabilityAction(node.id)}-done`, text: `Completed recorded work on ${node.title}.`, weight:1, effects:[{type:"capability",node:node.id}]}],
  });
  // Batch size, paid inspection and fuel options are real production actions, gated at runtime.
  for (const id of Object.keys(def.recipes)) for (const quantity of [1,2,4,6,8,10,12,14,16]) {
    if (quantity===1) continue;
    const action=`make-${id}-batch-${quantity}`;
    def.actions[action]={kind:"make",recipe:id,quantity};
    world.character.activities.push({id:`v-${action}`,text:`Make ${quantity} recipe units of ${id.replaceAll("-"," ")}`,category:"career",minAge:12,usesYearlyActivity:true,
      outcomes:[{id:`v-${action}-done`,text:"Completed a quoted production batch.",weight:1,effects:[{type:"vocation",action}]}]});
  }
  for (const [id,recipe] of Object.entries(def.recipes)) {
    for (const option of ["inspected",...(id.includes("vessel") ? ["controlled-firing"] : [])]) {
      const action=`make-${id}-${option}`;
      def.actions[action]={kind:"make",recipe:id,...(option==="inspected"?{inspected:true}:{controlledFiring:true})};
      world.character.activities.push({id:`v-${action}`,text:`Make ${recipe.title.toLowerCase()} · ${option.replaceAll("-"," ")}`,category:"career",minAge:12,usesYearlyActivity:true,
        outcomes:[{id:`v-${action}-done`,text:"Completed production using the paid method.",weight:1,effects:[{type:"vocation",action}]}]});
    }
  }
  const jobNodes:Record<string,string>={tailor:"AT5",potter:"AC5",sculptor:"AS5","philosophy-tutor":"P4",scientist:"PS10",politician:"PP10",merchant:"T10",
    "master-tailor":"AT10","master-potter":"AC10","master-sculptor":"AS10","master-cultivator":"FC10","master-household-farmer":"FR10","trading-house-manager":"T10"};
  const newJobs=[
    ["master-tailor","Master tailor","AT10"],["master-potter","Master potter","AC10"],["master-sculptor","Master sculptor","AS10"],
    ["master-cultivator","Master cultivator","FC10"],["master-household-farmer","Master household farmer","FR10"],
    ["trading-house-manager","Trading-house manager","T10"],["merchant","Merchant","T10"],
  ];
  for(const [id,title,nodeId]of newJobs) {
    const node=world.capabilities.nodes.find(node=>node.id===nodeId)!;
    world.character.jobs.push({id,title,minAge:18,requirements:{...node.minimumProficiency},description:"Qualification comes from demonstrated work. Earnings require completed production or a funded contract.",yearlyEffects:[]});
    world.character.activities.push({id:`cap-qualify-${id}`,text:`Apply for ${title.toLowerCase()} work`,category:"career",minAge:18,when:learned(nodeId),
      outcomes:[{id:`cap-appointed-${id}`,text:`Accepted an available ${title.toLowerCase()} role.`,weight:1,effects:[{type:"job",job:id}]}]});
  }
  for(const job of world.character.jobs) if(jobNodes[job.id]) {
    const node=world.capabilities.nodes.find(node=>node.id===jobNodes[job.id])!;
    job.requirements={...node.minimumProficiency};
  }
  for(const activity of world.character.activities) {
    const job=activity.outcomes.flatMap(outcome=>outcome.effects).find(effect=>effect.type==="job" && effect.job && jobNodes[effect.job]);
    if(job?.type==="job" && job.job) {
      const node=world.capabilities.nodes.find(node=>node.id===jobNodes[job.job!])!;
      activity.when=learned(node.id);
      const action=`appointment-${job.job}`;
      const payer=node.id.startsWith("PP")?"council":node.id.startsWith("PS")||node.id==="P4"?"school":"workshop";
      def.actions[action]={kind:"work",primary:Object.keys(node.minimumProficiency)[0],supports:[],fee:0,pay:0,payer,practice:false};
      for(const outcome of activity.outcomes) outcome.effects.unshift({type:"vocation",action});
    }
  }
  // An older random career event must not bypass the new demonstrated qualification.
  world.events=world.events.map(event=>({...event,choices:event.choices.filter(choice=>!choice.outcomes.some(outcome=>outcome.effects.some(effect=>effect.type==="job" && effect.job && jobNodes[effect.job])))})).filter(event=>event.mode==="automatic" || event.choices.length>0);
  const available=world.demo.availability;
  for(const id of Object.keys(jobNodes)) if(!available.playableJobs.includes(id)) available.playableJobs.push(id);
  available.unavailableJobs=available.unavailableJobs.filter(id=>!jobNodes[id]);
  available.unavailableSkills=available.unavailableSkills.filter(id=>!skills.includes(id));
}
