import type { LifeState, WorldPack } from "../types.ts";
import type { VocationAction } from "../vocations/types.ts";
import { applyStatDelta } from "../progression.ts";
import { syncEconomyStat } from "../economy.ts";
import { capabilityRewards, quoteCapabilityProduction } from "./rewards.ts";
import { recordEvidence, protectedGrain, syncCapabilities } from "./runtime.ts";
import { CAPABILITY_OPERATIONS } from "./operations.ts";
import { capabilityServiceReason, applyCapabilityService } from "./services.ts";
import type { CapabilityWorkState } from "./runtime-types.ts";
import { evaluateCapabilities, recordCapabilityEvidence } from "./evaluate.ts";
import type { CapabilityEvidence } from "./types.ts";

type DetailedWork = CapabilityWorkState & {
  buyerStock?: Record<string,Record<string,number>>;
  commissionStart?:number;
  civicBudget?: { id:string; escrow:number; year:number };
  policy?: { id:string; escrow:number; years:number; evidenceIds:string[]; openingGrain:number };
};
const details = (life:LifeState):DetailedWork => life.vocations!.capabilityWork as DetailedWork;
const orderActions = ["supply-plan","delivery-order","enterprise-contract"];
function orderQuote(world:WorldPack,life:LifeState) {
  const shipment=cargo(world,life);if(!shipment)return;
  const last=refs(life).filter(e=>e.kind==="contract"&&e.facts.buyerAccount!==undefined).at(-1);
  const buyer:"merchant"|"workshop"=last?.facts.buyerAccount==="merchant"?"workshop":"merchant";
  const recipe=Object.values(world.vocations!.recipes).find(r=>r.output===shipment.item);
  const payment=shipment.item==="grain"?life.demo!.town.prices.grain.buy*shipment.quantity:Math.floor((recipe?.baseAsk??0)*shipment.quantity*.8);
  return {...shipment,buyer,payment,haulage:12};
}
function stockMatches(life:LifeState):boolean {
  return Object.entries(life.vocations!.inventory).every(([item,n])=>Number.isFinite(n)&&n>=0&&life.vocations!.lots.filter(l=>l.item===item).reduce((sum,l)=>sum+l.quantity,0)===n)
    && Object.values(deepInventory(life)).every(n=>Number.isFinite(n)&&n>=0);
}
function assessmentReason(world:WorldPack,life:LifeState,node:string):string|undefined {
  const records=assessmentRecords(life,node);
  if(new Set(records.map(e=>e.year)).size<2)return "The registered assessment needs qualifying work in two different years.";
  const candidate:CapabilityEvidence={id:`assessment-preview-${node}-${life.capabilities!.evidence.length}`,year:life.year,kind:"assessment",action:`assess-${node}`,successful:true,group:details(life).assessment!.id,references:records.map(e=>e.id),facts:assessmentFacts(life,node,records)};
  const result=evaluateCapabilities({skills:life.character!.skills,reputation:life.demo?.reputation,year:life.year,state:recordCapabilityEvidence(life.capabilities!,candidate),rules:world.capabilities!.rules});
  if(!result.progress[node]?.eligible)return "The registered work does not yet meet the assessment's proficiency, quality, payment and delivery requirements.";
}
const score = (life: LifeState, id: string) => life.character?.skills[id] ?? 0;
const learned = (life: LifeState, node: string) => Boolean(life.capabilities?.learned[node]);
const profile = (life: LifeState) => capabilityRewards(Object.keys(life.capabilities?.learned ?? {}));
export const deepInventory = (life: LifeState): Record<string, number> => ({ ...life.vocations?.inventory, ...(life.demo ? { grain: life.demo.household.grain, flax: life.demo.household.flax, linen: life.demo.goods.linen } : {}) });
const refs = (life: LifeState, action?: string) => life.capabilities!.evidence.filter(e => e.successful && (!action || e.action === action));
function give(life: LifeState, item: string, amount: number, quality = 1): void {
  if (life.demo && ["grain", "flax", "linen"].includes(item)) {
    if (item === "linen") life.demo.goods.linen += amount;
    else life.demo.household[item as "grain" | "flax"] += amount;
  } else {
    const ledger = life.vocations!; ledger.inventory[item] = (ledger.inventory[item] ?? 0) + amount;
    const lot = ledger.lots.find(l => l.item === item && l.quality === quality);
    if (lot) lot.quantity += amount; else ledger.lots.push({ item, quality, quantity: amount });
  }
}
function take(life: LifeState, item: string, amount: number, minimumQuality = 1): void {
  if ((deepInventory(life)[item] ?? 0) < amount) throw new Error(`Insufficient ${item}.`);
  if (life.demo && ["grain", "flax", "linen"].includes(item)) { give(life, item, -amount); return; }
  const ledger = life.vocations!;
  const lots = ledger.lots.filter(l => l.item === item && l.quality >= minimumQuality);
  if (lots.reduce((n, l) => n + l.quantity, 0) < amount) throw new Error("The delivered products do not meet the commission grade.");
  ledger.inventory[item] -= amount;
  for (const lot of lots) { const n = Math.min(amount, lot.quantity); lot.quantity -= n; amount -= n; }
}
function acquire(life: LifeState, item: string, quantity: number, cost: number, traced = true): void {
  if (!traced) return;
  const work = life.vocations!.capabilityWork ??= {};
  work.tradeAcquisitionCost ??= {}; work.tradeAcquisitionQuantity ??= {};
  work.tradeAcquisitionCost[item] = (work.tradeAcquisitionCost[item] ?? 0) + cost;
  work.tradeAcquisitionQuantity[item] = (work.tradeAcquisitionQuantity[item] ?? 0) + quantity;
}
function consumeBasis(life: LifeState, item: string, quantity: number): { cost: number; traced: boolean } {
  const work = life.vocations!.capabilityWork ??= {}, n = work.tradeAcquisitionQuantity?.[item] ?? 0;
  const total = work.tradeAcquisitionCost?.[item] ?? 0;
  const cost = n > 0 ? Math.ceil(total * Math.min(n, quantity) / n) : 0;
  if (work.tradeAcquisitionQuantity) work.tradeAcquisitionQuantity[item] = Math.max(0, n - quantity);
  if (work.tradeAcquisitionCost) work.tradeAcquisitionCost[item] = Math.max(0, total - cost);
  return { cost, traced: n >= quantity };
}
function gain(world: WorldPack, life: LifeState, primary: string, supports: string[], practice = false): void {
  for (const [id, amount] of [[primary, practice ? 5 : 3], ...supports.map(id => [id, practice ? 1 : 2])] as [string, number][]) {
    const def = world.character!.skills[id];
    life.character!.skills[id] = applyStatDelta(def, score(life, id), amount);
  }
}
function major(action: VocationAction): boolean { return action.kind === "make" || action.kind === "work" || action.kind === "capability" && !CAPABILITY_OPERATIONS[action.operation]?.minor; }
function productionQuote(world: WorldPack, life: LifeState, action: Extract<VocationAction, { kind: "make" }>) {
  return quoteCapabilityProduction(profile(life), world.vocations!.recipes[action.recipe], { recipeId: action.recipe, quantity: action.quantity, inspected: action.inspected, controlledFiring: action.controlledFiring });
}
function cargo(world: WorldPack, life: LifeState): { item: string; quantity: number } | undefined {
  const inventory = deepInventory(life);
  if ((inventory.grain ?? 0) >= protectedGrain(world, life) + 20) return { item: "grain", quantity: 20 };
  const lot = life.vocations!.lots.find(l => l.quantity > 0 && Object.values(world.vocations!.recipes).some(r=>r.output===l.item));
  return lot ? { item: lot.item, quantity: 1 } : undefined;
}
function operationReason(world: WorldPack, life: LifeState, id: string): string | undefined {
  const op = CAPABILITY_OPERATIONS[id], ledger = life.vocations!, work = ledger.capabilityWork;
  if (!op) return "Unknown capability activity.";
  if(op.kind==="service")return capabilityServiceReason(world,life,id);
  if (op.node && !learned(life, op.node)) return `Learn ${world.capabilities!.rules.find(r => r.id === op.node)?.title ?? op.node} first.`;
  if (op.kind === "farm" && !life.demo?.household.plots) return "The household has no cultivated plot.";
  if (op.kind === "farm" && ["channel-maintenance","integrated-plan"].includes(op.action) && life.economy!.cash < world.demo!.household.plots * 8) return "Channel maintenance costs 8 dr per plot.";
  if (op.action.startsWith("prepare-") || op.action === "wood-relief-practice") {
    const item = op.action === "prepare-textiles" ? "flax" : op.action === "prepare-clay" ? "clay" : "timber";
    if (!(deepInventory(life)[item] > 0)) return `Buy ${item} for this recorded preparation job.`;
  }
  if (op.action === "extend-store") {
    if (work?.storeExtended) return "This household already has its store extension.";
    if ((deepInventory(life).timber ?? 0) < 4 || (deepInventory(life).clay ?? 0) < 5) return "The extension needs 4 timber and 5 clay.";
  }
  if (op.action === "cost-basket" && !refs(life).some(e => e.kind === "trade" && e.facts.paymentRecorded === true)) return "Complete a paid purchase or sale before reconciling its costs.";
  if (op.action === "price-comparison" && new Set(refs(life,"purchase").map(e=>e.facts.item)).size < 3) return "Keep acquisition receipts for three different items before comparing their quotes.";
  if (["test-explanation", "independent-check", "research-synthesis", "original-inquiry"].includes(op.action)) {
    const predecessor = op.action === "test-explanation" ? "observation-project" : op.action === "independent-check" ? "test-explanation" : "independent-check";
    if (!refs(life, predecessor).length) return `Complete a recorded ${predecessor.replaceAll("-", " ")} first.`;
  }
  if(op.action==="original-inquiry"&&work?.assessment?.node!=="PS10")return "Register the original-inquiry assessment first.";
  if(op.action==="public-service"&&!(details(life).civicBudget?.escrow))return "Publish a funded public budget first.";
  if(op.action==="public-budget"&&details(life).civicBudget?.escrow)return "Deliver the existing funded public budget first.";
  const civicCost=op.action==="public-budget"?24:op.action==="policy-project"&&!details(life).policy?24:["negotiate-agreement","coalition-agreement"].includes(op.action)?2:0;
  if(ledger.accounts.council<civicCost)return "The council cannot fund this agreed public service.";
  if(op.pay&&op.action!=="public-service"&&ledger.accounts[op.payer??"workshop"]+(op.payer==="workshop"||!op.payer?op.fee:0)<op.pay)return "The employer cannot fund the quoted wage.";
  if(orderActions.includes(op.action)){
    const order=orderQuote(world,life);if(!order)return "Produce or purchase cargo beyond the household's protected food reserve.";
    if(life.economy!.cash<order.haulage+op.fee)return "The order requires 12 dr cash for actual haulage.";
    if(ledger.accounts[order.buyer]<order.payment)return "The quoted buyer cannot fund this order.";
  }
  if (op.action === "trading-year" && !refs(life).some(e => e.kind === "trade" && e.action === "sale" && e.year === life.year)) return "Complete an actual sale in this market year first.";
  if (op.kind === "assessment") {
    const node = id.split("-")[1];
    if (id.startsWith("register-")) return learned(life,node)?"This assessment is already complete.":work?.assessment ? "Complete the registered assessment first." : undefined;
    if (work?.assessment?.node !== node) return "Register this assessment before completing its work.";
    return assessmentReason(world,life,node);
  }
  if (op.kind === "commission") {
    if (id === "deliver-commission") {
      const order = work?.commission;
      if (!order) return "Accept a funded commission first.";
      const eligible = ledger.lots.filter(l => l.item === order.item && l.quality >= order.minQuality).reduce((n,l) => n+l.quantity,0);
      if (eligible < order.quantity) return "Make enough products at the quoted commission grade first.";
      if(life.economy!.cash<3)return "Commission delivery requires a paid 3 dr inspection.";
      const produced=refs(life).filter(e=>e.kind==="production"&&life.capabilities!.evidence.indexOf(e)>=(details(life).commissionStart??0)&&e.action===order.item&&Number(e.facts.quality)>=order.minQuality);
      if(produced.reduce((n,e)=>n+Number(e.facts.quantity),0)<order.quantity)return "Make the commission products after accepting its funded order.";
    } else {
      if(work?.commission)return "Deliver the current commission before accepting another.";
      const item=id.slice("commission-".length),quantity=item.includes("vessel")?4:1,recipe=Object.values(world.vocations!.recipes).find(r=>r.output===item);
      if(!recipe)return "No workshop supplies this commission.";
      const payment=Math.floor(recipe.baseAsk*quantity*1.15);
      if(ledger.accounts.merchant<payment)return "The customer cannot fund this commission.";
      if((ledger.demand[item]??0)<quantity)return "There are no remaining funded customers for this commission.";
    }
  }
}
export function capabilityActionReason(world: WorldPack, life: LifeState, id: string, applying = false): string | undefined {
  const def = world.vocations, ledger = life.vocations, action = def?.actions[id];
  if (!world.capabilities || !life.capabilities || !def || !ledger || !life.economy || !life.character || !action) return "This capability activity is unavailable.";
  if (major(action) && (ledger.workedAge === life.age || !applying && life.character.lastActivityAge === life.age)) return "This year's major work is complete.";
  if (major(action) && life.character.jobId === "soldier") return "Leave military service before taking civilian work.";
  if (major(action) && life.stats.health < 20) return "Recover to Health 20 before taking a demanding year of work.";
  const cash = life.economy.cash;
  if (action.kind === "buy") {
    if (ledger.stock[action.item] < action.quantity) return "The material supplier has insufficient stock.";
    if (cash < def.materials[action.item].price * action.quantity) return "You cannot afford these materials.";
  } else if (action.kind === "sell") {
    if (!(deepInventory(life)[action.item] > 0)) return "Produce this item before selling it.";
    if (!(ledger.demand[action.item] > 0)) return "There are no remaining buyers for this product.";
  } else if (action.kind === "work") {
    if (cash < action.fee) return "You cannot afford this practice fee.";
    if (Object.entries(action.inputs ?? {}).some(([item, quantity]) => (deepInventory(life)[item] ?? 0) < quantity)) return "Supply the project's quoted materials first.";
    if ((action.inputs?.grain ?? 0) > 0 && life.demo!.household.grain - action.inputs!.grain < protectedGrain(world, life) && life.vocations!.capabilityWork?.reserveOverrideAge !== life.age) return "Keep protected household food and seed, or explicitly authorise reserve use before supplying this project.";
    if (ledger.accounts[action.payer] + (action.payer === "workshop" ? action.fee : 0) < action.pay) return "The employer has insufficient funds.";
  } else if (action.kind === "capability") {
    const reason = operationReason(world, life, action.operation); if (reason) return reason;
    if (cash < CAPABILITY_OPERATIONS[action.operation].fee) return "You cannot afford this work's quoted fee.";
  } else {
    if (ledger.project && ledger.project.recipe !== action.recipe) return "Complete the current large work before starting another product.";
    const quote = productionQuote(world, life, action);
    if (!quote.allowed) return quote.reason;
    if (!ledger.project && cash < quote.fee) return "You cannot afford workshop access and inspection.";
    if (!ledger.project && Object.entries(quote.inputs).some(([item,n]) => (deepInventory(life)[item] ?? 0) < n)) return "Buy or make all the quoted materials first.";
  }
}
function exerciseFacts(world: WorldPack, life: LifeState, action: string): Record<string, string | number | boolean> {
  const facts: Record<string,string|number|boolean>={workCompleted:true,datasetId:`${action}-${life.year}`,issueId:`district-issue-${life.year}`};
  const grain=life.demo!.household.grain, quote=life.demo!.town.prices.grain;
  if(action==="tool-practice")facts.supervised=true;
  if(action==="measurement-exercise"||action==="measurement-calculation")Object.assign(facts,{targetValue:10000,errorBps:Math.max(0,(action==="measurement-exercise"?600:400)-score(life,action==="measurement-exercise"?"craft":"reckoning")*10),calculationRetained:true});
  if(action==="guided-reading")Object.assign(facts,{questionRecorded:true,evidenceRecorded:true,question:"How much food can this household keep after its actual costs?",grainObserved:grain,priceObserved:quote.sell});
  if(action==="argument-exercise")Object.assign(facts,{claimRecorded:true,reasons:2,firstReason:`The store holds ${grain} grain.`,secondReason:`Replacement grain costs ${quote.sell} dr.`,counterargumentRecorded:true,counterargument:"Tools also need cash.",responseRecorded:true,response:"Compare the recorded food and workshop costs before allocating cash."});
  if(action==="evidence-comparison")Object.assign(facts,{recordsCompared:2,disagreementRecorded:quote.buy!==quote.sell,firstQuote:quote.buy,secondQuote:quote.sell});
  if (world.figurePaths && action === "evidence-comparison") Object.assign(facts, { comparisonRecorded: true, comparisonFinding: quote.buy === quote.sell ? "The recorded bid and ask agree at the current whole-unit price." : "The recorded bid and ask differ; the spread and its direction are retained.", quoteDifference: quote.sell - quote.buy });
  if(action==="reviewed-inquiry")facts.reviewAccepted=refs(life,"evidence-comparison").length>=2;
  if(action==="public-dilemma")Object.assign(facts,{reasons:1,evidenceRecorded:true,tradeoffRecorded:true,reason:`Buying grain at ${quote.sell} dr leaves less for workshop fees.`});
  if(action==="observation-project")Object.assign(facts,{evidenceRecorded:true,referenceValue:life.demo!.household.plots*100+grain});
  if(action==="test-explanation"){const source=refs(life,"observation-project").at(-1)!;Object.assign(facts,{predictionDeclared:true,predictedValue:Number(source.facts.referenceValue),resultCompared:true,referenceValue:Number(source.facts.referenceValue)});}
  if(action==="independent-check"){const source=refs(life,"test-explanation").at(-1)!,error=Math.max(0,400-score(life,"reckoning")*10);Object.assign(facts,{referenceValue:Number(source.facts.referenceValue),reviewerValue:Number(source.facts.referenceValue)*(10000+error)/10000,errorBps:error,independentCheck:error<=200});}
  if(action==="research-synthesis")facts.conclusionRecorded=true;
  if(action==="original-inquiry"){const group=life.vocations!.capabilityWork!.assessment?.id,prior=refs(life,action).filter(e=>e.group===group),error=Math.max(0,400-score(life,"reckoning")*10);Object.assign(facts,{questionRecorded:true,question:"Does the recorded allocation account for the observed output?",referenceValue:life.demo!.household.plots*100+grain,conclusionRecorded:prior.length>0,resultCompared:true,independentCheck:prior.length>0&&error<=200,errorBps:error,reviewerValue:(life.demo!.household.plots*100+grain)*(10000+error)/10000});}
  if(action==="public-address")Object.assign(facts,{factsCited:2,tradeoffRecorded:true,grainObserved:grain,priceObserved:quote.sell,tradeoff:"Food reserves and cash cannot both be spent twice."});
  return facts;
}
function assessmentRecords(life: LifeState,node: string): CapabilityEvidence[]{
  const registered=life.vocations!.capabilityWork!.assessment!;
  const records=life.capabilities!.evidence.filter(e=>e.successful&&e.group===registered.id&&registered.evidenceIds.includes(e.id)&&e.year>=registered.registeredYear);
  if(node==="AT10")return records.filter(e=>e.kind==="production"&&e.action==="ceremonial-garment");
  if(node==="AC10")return records.filter(e=>e.kind==="production"&&e.action==="decorated-vessel");
  if(node==="AS10")return records.filter(e=>e.kind==="production"&&e.action==="monument");
  if(node==="PS10")return records.filter(e=>e.action==="original-inquiry");
  if(node==="PP10")return records.filter(e=>e.action==="policy-work"||e.action==="civic-assessment-work");
  return records.filter(e=>e.kind==="contract"&&["fixed-price-order","delivery-order","enterprise-contract"].includes(e.action));
}
function assessmentFacts(life: LifeState,node:string,records:CapabilityEvidence[]):Record<string,string|number|boolean>{
  const facts:Record<string,string|number|boolean>={registered:true,accepted:true,paidInputs:records.length>0&&records.every(e=>e.facts.paidInputs===true),feesPaid:records.every(e=>e.facts.feesPaid===true),reconciled:records.every(e=>e.facts.reconciled===true)};
  if(node==="AS10")facts.inspectionAccepted=records.some(e=>e.facts.inspectionAccepted===true);
  if(node==="PS10")Object.assign(facts,{questionRecorded:records.every(e=>e.facts.questionRecorded===true),conclusionRecorded:records.some(e=>e.facts.conclusionRecorded===true)});
  if(node==="PP10")Object.assign(facts,{fundedPlan:records.every(e=>e.facts.fundedPlan===true),agreementSecured:records.every(e=>e.facts.agreementSecured===true),delivered:records.every(e=>e.facts.delivered===true)});
  return facts;
}
function addReceipt(world: WorldPack, life: LifeState, kind: CapabilityEvidence["kind"], action: string, facts: Record<string,string|number|boolean>, references: string[] = []) {
  return recordEvidence(world, life, { kind, action, facts: { ...facts, workCompleted: true }, ...(references.length ? { references } : {}), ...(life.vocations?.capabilityWork?.assessment ? {group:life.vocations.capabilityWork.assessment.id}: {}) });
}
export function applyCapabilityAction(world: WorldPack, life: LifeState, id: string): string {
  const reason = capabilityActionReason(world, life, id, true); if (reason) throw new Error(`Capability action is unavailable: ${reason}`);
  const ledger = life.vocations!, def = world.vocations!, action = def.actions[id], cash = life.economy!;
  const work = ledger.capabilityWork ??= {};
  let text = "";
  if (action.kind === "buy") {
    const price = def.materials[action.item].price * action.quantity;
    cash.cash -= price; ledger.accounts.merchant += price; ledger.stock[action.item] -= action.quantity;
    give(life, action.item, action.quantity); acquire(life, action.item, action.quantity, price);
    addReceipt(world,life,"trade" as never,"purchase",{item:action.item,quantity:action.quantity,payment:price,paymentRecorded:true,paidInputs:true,feesPaid:true,reconciled:true});
    text = `Bought ${action.quantity} ${action.item} for ${price} dr; receipt retained.`;
  } else if (action.kind === "sell") {
    const lot = ledger.lots.find(l => l.item === action.item && l.quantity > 0), quality = lot?.quality ?? 1;
    const recipe = Object.values(def.recipes).find(r => r.output === action.item)!;
    const price = Math.floor(recipe.baseAsk * [10000,11500,13000,15000,18000][quality-1] / 12500);
    if (ledger.accounts.merchant < price) throw new Error("The buyer cannot afford this product.");
    const basis = consumeBasis(life,action.item,1);take(life,action.item,1);
    ledger.accounts.merchant -= price; cash.cash += price; ledger.demand[action.item] -= 1;
    addReceipt(world,life,"trade" as never,"sale",{item:action.item,quantity:1,payment:price,paymentRecorded:true,paidInputs:basis.traced,feesPaid:true,reconciled:true,costRecorded:basis.traced,realizedMargin:basis.traced?price-basis.cost:-1,supplierDebt:0});
    text = `Sold one grade-${quality} ${action.item} for ${price} dr; realized margin ${price-basis.cost} dr.`;
  } else if (action.kind === "make") {
    const recipe = def.recipes[action.recipe], quote = productionQuote(world,life,action);
    if (!ledger.project) {
      let inputCost=0, traced=true;
      for (const [item,n] of Object.entries(quote.inputs)) { const basis=consumeBasis(life,item,n);inputCost+=basis.cost;traced&&=basis.traced;take(life,item,n); }
      cash.cash-=quote.fee;ledger.accounts.workshop+=quote.fee;
      ledger.project={recipe:action.recipe,completedYears:0,quantity:quote.quantity,quality:Math.min(quote.qualityCap,1+Math.floor(Math.max(0,score(life,"craft")-24)/16)+quote.qualityBonus),inspected:Boolean(action.inspected),controlledFiring:Boolean(action.controlledFiring),inputPaid:traced};
      // Cost basis remains attached to the reserved project until its single completion.
      (ledger.project as typeof ledger.project & { cost?:number }).cost=inputCost+quote.fee;
    }
    const project=ledger.project;project.completedYears+=1;gain(world,life,recipe.primary,recipe.supports);
    const done=project.completedYears>=recipe.workYears, quantity=done ? project.quantity! : 0;
    recordEvidence(world,life,{kind:"production",action:action.recipe==="small-relief"?"small-relief":recipe.output,facts:{item:action.recipe==="small-relief"?"small-relief":recipe.output,quantity,quality:project.quality,paidInputs:Boolean(project.inputPaid),reconciled:true,feesPaid:true,inspectionAccepted:Boolean(project.inspected),supervised:quote.supervised,deadlineMet:false,contract:false,supplierDebt:0,fuelUsed:quote.inputs.fuel ?? 0,matchedSet:Boolean(project.inspected)&&recipe.output.includes("vessel")&&quantity>=4,workCompleted:true},...(work.assessment ? {group:work.assessment.id}: {})});
    if(done){give(life,recipe.output,quantity,project.quality);acquire(life,recipe.output,quantity,(project as typeof project & {cost?:number}).cost ?? quote.fee,Boolean(project.inputPaid));ledger.completed[`product-${recipe.output}`]=(ledger.completed[`product-${recipe.output}`]??0)+1;delete ledger.project;text=`Completed ${quantity} grade-${project.quality} ${recipe.output}; materials and ${quote.fee} dr fee reconciled.`;}
    else text=`Worked on ${recipe.title}; inputs remain reserved for the final work year.`;
  } else if(action.kind === "work") {
    let paidInputs = true;
    for (const [item, quantity] of Object.entries(action.inputs ?? {})) {
      const basis = consumeBasis(life, item, quantity); paidInputs = basis.traced && paidInputs;
      take(life, item, quantity);
    }
    if (action.inputs) recordEvidence(world, life, { kind: "work", action: id, facts: { workCompleted: true, paidInputs, feesPaid: true, reconciled: true, inputs: JSON.stringify(action.inputs), grainDelivered: action.inputs.grain ?? 0, inputUnits: Object.values(action.inputs).reduce((a, b) => a + b, 0), fee: action.fee, payment: action.pay, paymentRecorded: action.pay > 0 } });
    cash.cash-=action.fee;ledger.accounts.workshop+=action.fee;ledger.accounts[action.payer]-=action.pay;cash.cash+=action.pay;
    gain(world,life,action.primary,action.supports,action.practice);
    text=`Completed ${action.practice ? "deliberate practice" : "paid work"}; ${action.primary} improved through one work year.`;
  } else {
    const op=CAPABILITY_OPERATIONS[action.operation], facts=exerciseFacts(world,life,op.action);
    if(op.kind==="service"){text=applyCapabilityService(world,life,action.operation);}
    else {
    cash.cash-=op.fee;ledger.accounts.workshop+=op.fee;
    if(op.pay&&op.action!=="public-service"){ledger.accounts[op.payer??"workshop"]-=op.pay;cash.cash+=op.pay;}
    if(op.fee>0)Object.assign(facts,{paidInputs:true,feesPaid:true,reconciled:true,fee:op.fee});
    if(op.minor){
      if(op.kind === "assessment"){
        const node=action.operation.split("-")[1];
        if(action.operation.startsWith("register-")){work.assessment={node,id:`assessment-${node}-${life.year}-${life.capabilities!.evidence.length}`,registeredYear:life.year,evidenceIds:[]};text=`Registered the ${node} assessment. Work in two different years must be recorded before submission.`;}
        else{const records=assessmentRecords(life,node);recordEvidence(world,life,{kind:"assessment",action:`assess-${node}`,group:work.assessment!.id,references:records.map(e=>e.id),facts:assessmentFacts(life,node,records)});syncCapabilities(world,life);delete work.assessment;text=`The documented ${node} assessment is accepted.`;}
      }else if(op.kind === "plan"){
        if(op.action === "reserve-override")work.reserveOverrideAge=life.age;
        else{work.farmPlan??={age:life.age,mode:"fieldwork",sowing:"ordinary",maintainChannels:false,planRecorded:true};work.farmPlan.sowing=op.action === "plan-dense"?"dense":op.action === "plan-conservative"?"conservative":"ordinary";work.farmPlan.age=life.age;work.farmPlan.planRecorded=true;}
        text=op.title;
      }else if(action.operation === "deliver-commission"){
        const order=work.commission!,source=refs(life).filter(e=>e.kind==="production"&&life.capabilities!.evidence.indexOf(e)>=(details(life).commissionStart??0)&&e.action===order.item&&Number(e.facts.quality)>=order.minQuality);
        const paidInputs=source.every(e=>e.facts.paidInputs===true),quality=Math.min(...source.filter(e=>Number(e.facts.quantity)>0).map(e=>Number(e.facts.quality)));
        const basis=consumeBasis(life,order.item,order.quantity);take(life,order.item,order.quantity,order.minQuality);
        cash.cash+=order.escrow-3;ledger.accounts.workshop+=3;
        ledger.stock[order.item]=(ledger.stock[order.item]??0)+order.quantity;
        const delivered={item:order.item,quantity:order.quantity,quality,paidInputs:paidInputs&&basis.traced,feesPaid:true,reconciled:true,inspectionAccepted:true,contract:true,supervised:false,deadlineMet:life.age<=order.deadlineAge,supplierDebt:0,matchedSet:order.item.includes("vessel")&&order.quantity>=4,paymentRecorded:true,payment:order.escrow,inspectionFee:3,fundedPlan:true,agreementSecured:true,delivered:true,stockReconciled:true,buyerAccount:"merchant",fuelUsed:source.reduce((n,e)=>n+Number(e.facts.fuelUsed??0),0)};
        addReceipt(world,life,"production","commission-delivery",delivered,source.map(e=>e.id));
        addReceipt(world,life,"contract","commission-delivery",delivered,source.map(e=>e.id));
        delete work.commission;delete details(life).commissionStart;text="Delivered the products, paid the 3 dr inspection and collected the funded commission escrow.";
      }else{
        const item=action.operation.slice("commission-".length),quantity=item.includes("vessel")?4:1,advanced=item.includes("vessel")?"AC8":["stone-figure","large-relief"].includes(item)?"AS8":"AT8",minQuality=learned(life,advanced)?3:2;
        const recipe=Object.values(def.recipes).find(r=>r.output===item)!,payment=Math.floor(recipe.baseAsk*quantity*1.15);
        ledger.accounts.merchant-=payment;ledger.demand[item]-=quantity;
        work.commission={id:`commission-${life.year}-${life.capabilities!.evidence.length}`,item,quantity,minQuality,deadlineAge:life.age+3,payment,escrow:payment,acceptedYear:life.year};
        details(life).commissionStart=life.capabilities!.evidence.length;text=`Accepted ${quantity} grade-${minQuality} ${item}; ${payment} dr is held in funded escrow.`;
      }
    }else{
      if(op.action.startsWith("prepare-")||op.action==="wood-relief-practice"){
        const item=op.action==="prepare-textiles"?"flax":op.action==="prepare-clay"?"clay":"timber";const basis=consumeBasis(life,item,1);take(life,item,1);facts.paidInputs=basis.traced;facts.feesPaid=true;facts.reconciled=true;
      }
      if(op.kind === "farm"){
        const prior=work.farmPlan;work.farmPlan={age:life.age,mode:op.action==="integrated-plan"?"integrated":op.action,sowing:prior?.age===life.age?prior.sowing:"ordinary",maintainChannels:op.action==="channel-maintenance"||op.action==="integrated-plan",planRecorded:true,integratedPlan:op.action==="integrated-plan"};
        if(work.farmPlan.maintainChannels){const fee=life.demo!.household.plots*8;cash.cash-=fee;ledger.accounts.council+=fee;work.farmPlan.maintenancePaid=true;facts.feesPaid=true;}
        work.farmWorkAge=life.age;
      }
      if(op.action === "extend-store"){const timber=consumeBasis(life,"timber",4),clay=consumeBasis(life,"clay",5);take(life,"timber",4);take(life,"clay",5);life.demo!.household.capacity+=500;work.storeExtended=true;facts.paidInputs=timber.traced&&clay.traced;facts.feesPaid=true;facts.reconciled=true;}
      if(op.action === "store-inspection"){facts.feesPaid=true;facts.paidInputs=true;facts.reconciled=true;}
      let extraReferences:string[]=[];
      if(["negotiate-agreement","coalition-agreement"].includes(op.action)){
        ledger.accounts.council-=2;ledger.accounts.workshop+=2;
        Object.assign(facts,{fundedPlan:true,agreementSecured:true,delivered:true,reconciled:true,paidInputs:true,feesPaid:true,cost:2,groupCount:2,firstGroup:"households",secondGroup:"workshop"});
      }
      if(op.action==="public-budget"){
        ledger.accounts.council-=24;
        Object.assign(facts,{fundedPlan:true,reconciled:true,allocatedCost:24,serviceMaterials:12,serviceWage:12});
      }
      if(op.action==="public-service"){
        const budget=details(life).civicBudget!;
        ledger.accounts.workshop+=12;cash.cash+=12;budget.escrow-=24;extraReferences=[budget.id];
        Object.assign(facts,{fundedPlan:true,agreementSecured:true,delivered:true,reconciled:true,paidInputs:true,feesPaid:true,cost:24,payment:12});
        delete details(life).civicBudget;
      }
      if(op.action==="policy-project"){
        let policy=details(life).policy;
        if(!policy){ledger.accounts.council-=24;policy={id:`policy-${life.year}`,escrow:24,years:0,evidenceIds:[],openingGrain:life.demo!.household.grain};details(life).policy=policy;}
        policy.escrow-=12;policy.years+=1;ledger.accounts.workshop+=12;
        const workId=addReceipt(world,life,"work","policy-work",{fundedPlan:true,agreementSecured:true,delivered:true,reconciled:true,paidInputs:true,feesPaid:true,workCompleted:true,cost:12,groupCount:2,firstGroup:"households",secondGroup:"workshop"});
        policy.evidenceIds.push(workId);extraReferences=[...policy.evidenceIds];
        Object.assign(facts,{costsDeclared:true,declaredCost:24,groupCount:2,followupRecorded:policy.years>=2,resultCompared:policy.years>=2,openingGrain:policy.openingGrain,closingGrain:life.demo!.household.grain,fundedPlan:true,agreementSecured:true,delivered:true,reconciled:true,paidInputs:true,feesPaid:true});
        if(policy.years>=2)delete details(life).policy;
      }
      if(["negotiate-agreement","public-budget","coalition-agreement","policy-project","public-service"].includes(op.action))life.demo!.reputation=Math.min(world.demo!.works.reputation.max,life.demo!.reputation+2);
      if(orderActions.includes(op.action)){
        const order=orderQuote(world,life)!,basis=consumeBasis(life,order.item,order.quantity);take(life,order.item,order.quantity);
        ledger.accounts[order.buyer]-=order.payment;cash.cash+=order.payment-order.haulage;ledger.accounts.workshop+=order.haulage;
        if(order.buyer==="merchant")ledger.stock[order.item]=(ledger.stock[order.item]??0)+order.quantity;
        else{const stocks=details(life).buyerStock??={};stocks.workshop??={};stocks.workshop[order.item]=(stocks.workshop[order.item]??0)+order.quantity;}
        Object.assign(facts,{item:order.item,quantity:order.quantity,payment:order.payment,haulage:order.haulage,fundedPlan:true,agreementSecured:true,delivered:true,reconciled:true,paidInputs:basis.traced,costRecorded:basis.traced,feesPaid:true,deadlineMet:true,stockReconciled:stockMatches(life),supplierDebt:0,paymentRecorded:true,realizedMargin:basis.traced?order.payment-basis.cost-order.haulage:-1,buyerAccount:order.buyer});
      }
      if(op.action === "trading-year"){const sales=refs(life).filter(e=>e.kind==="trade"&&e.action==="sale"&&e.year===life.year);facts.realizedMargin=sales.every(e=>e.facts.costRecorded===true)?sales.reduce((n,e)=>n+Number(e.facts.realizedMargin??0),0):-1;facts.paymentRecorded=true;facts.paidInputs=sales.every(e=>e.facts.paidInputs===true);facts.stockReconciled=true;facts.reconciled=true;facts.supplierDebt=0;facts.feesPaid=true;}
      if(op.action === "stock-reconciliation"||op.action==="cost-basket"){const purchases=refs(life,"purchase");Object.assign(facts,{reconciled:stockMatches(life),paidInputs:purchases.length>0&&purchases.every(e=>e.facts.paymentRecorded===true),feesPaid:true,stockReconciled:stockMatches(life),paymentRecorded:purchases.length>0,inventory:JSON.stringify(deepInventory(life))});extraReferences=purchases.map(e=>e.id);}
      if(op.action==="project-budget"){facts.reconciled=stockMatches(life);facts.inventory=JSON.stringify(deepInventory(life));extraReferences=refs(life).filter(e=>e.kind==="production").map(e=>e.id);}
      if(op.action === "price-comparison"){
        const purchases=refs(life,"purchase"),items=[...new Set(purchases.map(e=>String(e.facts.item)))].slice(0,3);
        for(const item of items){const bought=purchases.filter(e=>e.facts.item===item),quantity=bought.reduce((n,e)=>n+Number(e.facts.quantity),0),cost=bought.reduce((n,e)=>n+Number(e.facts.payment),0),native=life.demo!.town.prices[item as "grain"];
          const price=def.materials[item]?.price??native?.sell;if(price===undefined)continue;
          addReceipt(world,life,"exercise",op.action,{...facts,item,quoteRecorded:true,costRecorded:true,price,acquisitionCost:cost/quantity},bought.map(e=>e.id));
        }
      }else{
        const referenceAction=op.action==="independent-check"?"test-explanation":op.action==="test-explanation"?"observation-project":op.action==="reviewed-inquiry"?"evidence-comparison":undefined;
        const references=extraReferences.length?extraReferences:referenceAction?refs(life,referenceAction).slice(-3).map(e=>e.id):op.action==="research-synthesis"?refs(life).filter(e=>["independent-check","observation-project","test-explanation"].includes(e.action)).slice(-8).map(e=>e.id):[];
        const kind=op.action==="supply-plan"?"exercise":orderActions.includes(op.action)?"contract":op.action==="stock-reconciliation"?"reconciliation":op.kind==="work"||op.kind==="farm"?"work":"exercise";
        const receipt=addReceipt(world,life,kind,op.action,facts,references);
        if(op.action==="public-budget")details(life).civicBudget={id:receipt,escrow:24,year:life.year};
        if(op.action==="delivery-order")addReceipt(world,life,"contract","fixed-price-order",facts,[receipt]);
      }
      gain(world,life,op.primary,op.supports);text=`${op.title}. Completed work and its supporting records are retained.`;
    }
  }
  }
  if(major(action)){ledger.workedAge=life.age;life.character!.lastActivityAge=life.age;}
  ledger.completed[id]=(ledger.completed[id]??0)+1;syncEconomyStat(world,life);syncCapabilities(world,life);return text;
}
