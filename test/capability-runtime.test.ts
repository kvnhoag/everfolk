import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack, LifeEngine } from "../src/types.ts";
import { buildCapabilityWorld } from "../src/vocations/capability-world.ts";
import { capabilityView } from "../src/capabilities/view.ts";
import { eligibleJobsForAssessment } from "../src/capabilities/engine.ts";
import { validateWorld } from "../src/validate.ts";
import { CAPABILITY_NODES } from "../src/capabilities/catalog.ts";
import { artisanLimits, productionQuote } from "../src/capabilities/production.ts";
import { loseReservedStock, workQuote } from "../src/capabilities/work.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };

function fixture() {
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  for (const event of world.events) { event.when = { type: "age", op: "gte", value: 1000 }; event.maxOccurrences = 1; }
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  delete world.health!.mortalityCalibration;
  delete world.eventPacing; delete world.character!.encounterPacing;
  world.yearlyRules = []; world.yearlyEffects = [];
  // An authored adult-expertise fixture isolates proofs from training and survival balance.
  for (const skill of Object.values(world.character!.skills)) skill.initial = 90;
  world.stats.wealth.max = 10000;
  world.stats.wealth.initial = 10000 / world.economy!.unitsPerPoint;
  for (const stat of Object.values(world.stats)) delete stat.initialRange;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = {}; }
  delete world.demo!.startingResources;
  world.demo!.household.startingGrain = 12000; world.demo!.household.storeCapacity = 20000;
  return createEngine(world);
}
function parents(target: string): string[] {
  const result: string[] = [];
  function visit(id: string) { for (const parent of CAPABILITY_NODES.find(n=>n.id===id)!.prerequisites.all) visit(parent); if(!result.includes(id)) result.push(id); }
  visit(target); return result;
}
function progress(engine: LifeEngine, target: string) {
  let life=engine.start(`proof-${target}`);
  while(life.age<12)life=engine.advance(life);
  const path=parents(target);
  for(let turn=0;turn<65 && !life.capabilities!.learned[target];turn++) {
    const next=path.find(id=>!life.capabilities!.learned[id])!;
    if(next==='FC8') {
      const grainDone=life.capabilities!.evidence.some(e=>e.nodeId===next&&e.kind==='farm-settlement'&&e.data.qualifies&&e.data.crop==='grain');
      life=engine.demo(life,{type:'plan',flaxPlots:grainDone?life.demo!.household.plots:0});
      while(grainDone&&(life.vocations!.inventory['flax-seed']??0)<8)life=engine.act(life,'v-buy-flax-seed');
    } else if(life.demo!.household.flaxPlots)life=engine.demo(life,{type:'plan',flaxPlots:0});
    const workNode=next==='PP10'&&life.demo!.reputation<60?'PP8':next;
    const action=engine.getActivities(life).find(a=>a.id===`cap-work-${workNode.toLowerCase()}`)!;
    assert.equal(action.available,true,`${target}/${next}: ${action.reason}`);
    life=engine.act(life,action.id);
    if(!life.capabilities!.learned[target])life=engine.advance(life);
  }
  assert.ok(life.capabilities!.learned[target],`${target} reachable through actual proof work`);
  return life;
}

test("all eight mastery paths can be earned with real accepted work and exact replay", () => {
  for(const target of ['FC10','FR10','AT10','AC10','AS10','PS10','PP10','T10']) {
    const engine=fixture(),life=progress(engine,target);
    assert.deepEqual(engine.replay(life.seed,life.commands),life);
    assert.deepEqual(engine.load(engine.save(life)),life);
    assert.ok(life.capabilities!.evidence.filter(e=>e.nodeId===target).length>0);
    assert.ok(Object.values(life.vocations!.accounts).every(n=>n>=0));
    assert.ok(Object.values(life.vocations!.inventory).every(n=>n>=0));
  }
});

test("every non-farming receipt reconciles real payments and stock", () => {
  for(const target of ['AT10','AC10','AS10','PS10','PP10','T10']) {
    const engine=fixture(),life=progress(engine,target);
    const records=life.capabilities!.evidence.filter(e=>e.kind!=='farm-ledger'&&e.kind!=='farm-plan'&&e.kind!=='farm-settlement');
    assert.ok(records.every(e=>e.data.reconciled===true && e.data.cashConserved===true));
    const last=records.at(-1)!;
    assert.equal(last.data.cashAtClosing,life.economy!.cash);
  }
});

test("the trading assessment reserves two paid orders and sends each to its buyer", () => {
  const engine=fixture(),life=progress(engine,'T10');
  const records=life.capabilities!.evidence.filter(e=>e.nodeId==='T10');
  assert.equal(records.length,2);
  assert.deepEqual(records.map(e=>e.data.payer),['merchant','council']);
  assert.deepEqual(records.map(e=>e.data.activeWorkYear),[1,2]);
  assert.equal(records[0].data.completedAssessment,false);
  assert.equal(records[1].data.completedAssessment,true);
  assert.equal(life.capabilities!.civicGrain,10);
  assert.equal(life.capabilities!.reservedPayment,0);
  assert.equal(life.capabilities!.project,undefined);
  assert.equal(records[0].data.reservedGrain,10);
  assert.equal(records[1].data.reservedGrain,0);
});

test("master artisan assessments reserve inputs once and wait for two work years",()=>{
  for(const target of ['AT10','AC10','AS10']) {
    const life=progress(fixture(),target),records=life.capabilities!.evidence.filter(e=>e.nodeId===target);
    assert.equal(records.length,2);
    assert.equal(records[0].data.completedAssessment,false);
    assert.equal(records[1].data.completedAssessment,true);
    assert.equal(records[1].data.materialsPaid,0);
    assert.equal(records[1].data.feePaid,0);
    assert.ok(Number(records[0].data.quality)>=4);
    assert.ok(Number(records[0].data.quantity)>0);
  }
});

test("viewing the whole atlas never changes any ledger or random stream",()=>{
  const engine=fixture(),life=engine.start('atlas-pure'),before=structuredClone(life);
  const view=capabilityView(engine.world,life);
  assert.equal(view.nodes.length,65);assert.deepEqual(life,before);
  assert.ok(view.nodes.every(n=>n.state==='locked'));
});

test("learned artisan rewards change actual production limits and material quotes",()=>{
  const engine=fixture(),tailor=progress(engine,'AT10'),potter=progress(engine,'AC10');
  assert.deepEqual(artisanLimits(tailor,'Clothing'),{quality:5,batch:12});
  assert.deepEqual(artisanLimits(potter,'Ceramics'),{quality:5,batch:16});
  assert.equal(productionQuote(engine.world,tailor,'garment',4).inputs.linen,7);
  assert.equal(productionQuote(engine.world,potter,'vessel',8).inputs.fuel,4);
});

test("assessment quotes reject unfunded buyers and missing upfront cash without changing a life",()=>{
  const engine=fixture();
  const trading=structuredClone(engine.advance(progress(engine,'T10')));
  trading.vocations!.accounts.council=0;
  const before=structuredClone(trading);
  assert.match(workQuote(engine.world,trading,'T10').reason!,/Both buyers/);
  assert.deepEqual(trading,before);
  const artisan=structuredClone(engine.advance(progress(engine,'AT10')));
  artisan.economy!.cash=0;
  assert.match(workQuote(engine.world,artisan,'AT10').reason!,/up front/);
});

test("a paused assessment retains its escrow and counts only active work years",()=>{
  const engine=fixture();
  let life=engine.advance(progress(engine,'AT10'));
  life=engine.act(life,'cap-work-at10');
  const reserved=life.capabilities!.reservedPayment,project=structuredClone(life.capabilities!.project);
  life=engine.advance(life);
  assert.match(engine.getActivities(life).find(a=>a.id==='v-make-thread')!.reason!,/registered capability/);
  life=engine.act(life,'v-practice-craft');
  life=engine.advance(life);
  assert.deepEqual(life.capabilities!.project,project);
  assert.equal(life.capabilities!.reservedPayment,reserved);
  life=engine.act(life,'cap-work-at10');
  assert.equal(life.capabilities!.project,undefined);
  assert.equal(life.capabilities!.reservedPayment,0);
  assert.deepEqual(engine.replay(life.seed,life.commands),life);
});

test("capability pack validation rejects unsupported graphs and accessors without reading them",()=>{
  const variants=[(w:WorldPack)=>{w.capabilities!.nodes[0].id='X1';},(w:WorldPack)=>{w.capabilities!.nodes[0].prerequisites.all=['T10'];},(w:WorldPack)=>{delete w.capabilities!.nodes[1];}];
  for(const mutate of variants){const world=buildCapabilityWorld(base as unknown as WorldPack);mutate(world);assert.throws(()=>validateWorld(world),/capabilit|graph|JSON|node/i);}
  const world=buildCapabilityWorld(base as unknown as WorldPack);let reads=0;
  Object.defineProperty(world.capabilities!.nodes[0].minimumProficiency,'farming',{get(){reads++;return 0;},enumerable:true});
  assert.throws(()=>validateWorld(world),/JSON/);assert.equal(reads,0);
});

function treasuryTotal(life: LifeState): number {
  const cash = life.economy?.cash ?? 0;
  const accounts = life.vocations ? Object.values(life.vocations.accounts).reduce((a, b) => a + b, 0) : 0;
  return cash + accounts + (life.capabilities?.reservedPayment ?? 0);
}

test("Issue #6: quotes disclose terms before acceptance and distinguish accepted calendar deadlines", () => {
  const engine = fixture();
  let start = engine.start("terms-before-accept");
  while (start.age < 12) start = engine.advance(start);

  const employerQuote = workQuote(engine.world, start, "A1");
  assert.equal(employerQuote.terms.materialsOwner, "employer");
  assert.equal(employerQuote.terms.payer, "workshop");
  assert.equal(employerQuote.terms.workYearDeadline, 1);

  const noneQuote = workQuote(engine.world, start, "T1");
  assert.equal(noneQuote.terms.materialsOwner, "none");
  assert.equal(noneQuote.terms.quantity, 1);
  assert.equal(noneQuote.terms.minimumQuality, 1);
  assert.equal(noneQuote.terms.workYearDeadline, 1);

  let ready = engine.advance(progress(engine, "AT9"));
  const preView = capabilityView(engine.world, ready).nodes.find(n => n.id === "AT10")!;
  assert.equal(preView.terms?.materialsOwner, "worker");
  assert.equal(preView.terms?.quantity, 4);
  assert.equal(preView.terms?.minimumQuality, 4);
  assert.ok((preView.terms?.totalPayment ?? 0) > 0);
  assert.equal(preView.terms?.payer, "merchant");
  assert.equal(preView.terms?.workYearDeadline, 2);
  assert.equal(preView.terms?.calendarDeadlineYears, 4);
  assert.equal(preView.terms?.calendarDeadlineYear, undefined);

  const tReady = engine.advance(progress(engine, "T9"));
  const tQuote = workQuote(engine.world, tReady, "T10");
  assert.deepEqual(tQuote.terms.payers, ["merchant", "council"]);
  assert.equal(tQuote.terms.quantity, 20);
  assert.equal(tQuote.terms.calendarDeadlineYears, 4);

  ready = engine.act(ready, "cap-work-at10", { calendarDeadline: true });
  const active = capabilityView(engine.world, ready).nodes.find(n => n.id === "AT10")!;
  assert.equal(active.terms?.calendarDeadlineYear, ready.year + 4);
  assert.equal(active.terms?.completedWorkYears, 1);
  assert.ok(Object.values(ready.capabilities!.project!.consumedInputs ?? {}).some(qty => qty > 0));
  assert.deepEqual(engine.replay(ready.seed, ready.commands), ready);
});

test("Issue #6: missing an accepted calendar deadline forfeits unpaid escrow without recreating consumed inputs", () => {
  const engine = fixture();
  let life = engine.advance(progress(engine, "T9"));
  const tReady = engine.start(life.seed);
  void tReady;
  const openTreasury = treasuryTotal(life);
  const cashBeforeStart = life.economy!.cash;
  const started = engine.act(life, "cap-work-t10", { calendarDeadline: true });
  const startYear = started.year;
  const councilBefore = started.vocations!.accounts.council;
  const reservedAfterYear1 = started.capabilities!.reservedPayment!;
  assert.equal(started.capabilities!.project?.calendarDeadlineYear, startYear + 4);
  assert.ok(reservedAfterYear1 > 0);
  assert.deepEqual(started.capabilities!.project?.consumedInputs, { grain: 10 });
  assert.deepEqual(started.capabilities!.project?.reservedStock, { grain: 10 });

  life = started;
  // Advance past startYear + 4 (i.e. into startYear + 5) without resuming year 2.
  while (life.year <= startYear + 4) life = engine.advance(life);
  assert.equal(life.capabilities!.project, undefined);
  assert.equal(life.capabilities!.reservedPayment, 0);
  assert.equal(life.vocations!.accounts.council, councilBefore + reservedAfterYear1);
  assert.equal(treasuryTotal(life), openTreasury);
  // Upfront fees/consumed grain were spent at registration and are not recreated by expiry.
  const firstDeliveryPay = Number(started.capabilities!.evidence.at(-1)!.data.paymentReceived ?? 0);
  assert.ok(life.economy!.cash < cashBeforeStart + firstDeliveryPay);
  const expiry = life.capabilities!.evidence.at(-1)!;
  assert.equal(expiry.data.deadlineMissed, true);
  assert.equal(expiry.data.qualifies, false);
  assert.equal(expiry.data.forfeitedPayment, reservedAfterYear1);
  assert.equal(expiry.data.cashConserved, true);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("Issue #6: exposed reserved stock loses units to real spoilage/shocks and blocks resuming until replaced", () => {
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  for (const event of world.events) { event.when = { type: "age", op: "gte", value: 1000 }; event.maxOccurrences = 1; }
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  delete world.health!.mortalityCalibration;
  delete world.eventPacing; delete world.character!.encounterPacing;
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const skill of Object.values(world.character!.skills)) skill.initial = 90;
  world.stats.wealth.max = 10000;
  world.stats.wealth.initial = 10000 / world.economy!.unitsPerPoint;
  for (const stat of Object.values(world.stats)) delete stat.initialRange;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = {}; }
  delete world.demo!.startingResources;
  // Tight storage capacity puts combined household + reserved commission grain over capacity.
  world.demo!.household.startingGrain = 5000;
  world.demo!.household.storeCapacity = 300;
  const engine = createEngine(world);

  let life = engine.advance(progress(engine, "T9"));
  // Buy grain into household store so unreserved grain exceeds store capacity when pausing T10.
  while (life.demo!.household.grain < 450) {
    life = engine.advance(life);
  }
  life = engine.act(life, "cap-work-t10");
  assert.equal(life.capabilities!.project?.reservedStock?.grain, 10);

  // Advance one year: ordinary over-capacity spoilage strikes both household and reserved grain.
  life = engine.advance(life);
  const lost = life.capabilities!.project?.reservedMissing?.grain ?? 0;
  assert.ok(lost >= 1, `Expected over-capacity spoilage on reserved grain, got ${lost}`);
  assert.equal(life.capabilities!.project!.reservedStock!.grain, 10 - lost);

  // Terms surface missing reserved stock, and insufficient household stock blocks resuming.
  const tView = capabilityView(engine.world, life).nodes.find(n => n.id === "T10")!;
  assert.equal(tView.terms?.reservedMissing?.grain, lost);
  const missingLife = structuredClone(life);
  missingLife.demo!.household.grain = 0;
  assert.match(workQuote(engine.world, missingLife, "T10").reason ?? "", /Reserved materials were lost.*grain/);
  assert.throws(() => engine.act(missingLife, "cap-work-t10"), /Reserved materials were lost|unavailable/i);

  // Acquiring replacement grain into household store lets resuming replace ONLY the missing units and finish T10.
  const openBeforeResume = treasuryTotal(life);
  const grainBeforeResume = life.demo!.household.grain;
  const finished = engine.act(life, "cap-work-t10");
  assert.equal(finished.capabilities!.project, undefined);
  assert.equal(finished.demo!.household.grain, grainBeforeResume - lost);
  assert.ok(finished.capabilities!.learned["T10"]);
  assert.equal(finished.capabilities!.evidence.at(-1)!.data.cashConserved, true);
  assert.equal(treasuryTotal(finished), openBeforeResume);
  assert.deepEqual(engine.replay(finished.seed, finished.commands), finished);
  assert.deepEqual(engine.load(engine.save(finished)), finished);

  // Also test consumed vs reserved split and loseReservedStock on paused AT10 stock.
  let artisan = structuredClone(engine.act(engine.advance(progress(engine, "AT9")), "cap-work-at10"));
  const reservedEntries = Object.entries(artisan.capabilities!.project!.reservedStock ?? {});
  assert.ok(reservedEntries.length > 0, "Multi-unit inputs reserve unconsumed stock separately from consumedInputs");
  const [reservedItem] = reservedEntries[0];
  const lostArtisan = loseReservedStock(artisan, reservedItem, 1);
  assert.equal(lostArtisan, 1);
  assert.match(workQuote(engine.world, artisan, "AT10").reason ?? "", /Reserved materials were lost/);
  assert.throws(() => engine.act(artisan, "cap-work-at10"), /Reserved materials were lost|unavailable/i);
});

test("Issue #6: multi-job assessment records distinct stable job IDs and grants qualification once without duplicate pay or goods", () => {
  const engine = fixture();
  let life = engine.advance(progress(engine, "AT9"));
  const jobs = eligibleJobsForAssessment(engine.world, life, "AT10");
  assert.ok(jobs.length >= 2, `Expected >= 2 eligible AT lineage jobs, got ${jobs.length}`);
  assert.equal(new Set(jobs.map(job => job.jobId)).size, jobs.length);
  for (const job of jobs) assert.match(job.jobId, /^[a-z]+\d+-\d+--?\d+-\d+$/);

  const viewJobs = capabilityView(engine.world, life).nodes.find(n => n.id === "AT10")!.eligibleJobs!;
  assert.deepEqual(viewJobs, jobs);

  // Reject missing second job ID or duplicate IDs or unrelated branch job ID.
  assert.throws(() => engine.assess(life, "AT10", [jobs[0].jobId]), /2 distinct/);
  assert.throws(() => engine.assess(life, "AT10", [jobs[0].jobId, jobs[0].jobId]), /Duplicate job ID/);
  assert.throws(() => engine.assess(life, "AT10", [jobs[0].jobId, "p1-12-1-1"]), /not an eligible/);

  const cashBefore = life.economy!.cash;
  const accountsBefore = structuredClone(life.vocations!.accounts);
  const stockBefore = structuredClone(life.vocations!.stock);
  const goodsBefore = structuredClone(life.demo!.goods);

  life = engine.assess(life, "AT10", [jobs[0].jobId, jobs[1].jobId]);
  assert.ok(life.capabilities!.learned["AT10"]);
  assert.equal(life.economy!.cash, cashBefore);
  assert.deepEqual(life.vocations!.accounts, accountsBefore);
  assert.deepEqual(life.vocations!.stock, stockBefore);
  assert.deepEqual(life.demo!.goods, goodsBefore);

  const record = life.capabilities!.evidence.at(-1)!;
  assert.equal(record.kind, "job-assessment");
  assert.equal(record.data.qualifies, true);
  assert.equal(record.data.completedAssessment, true);
  assert.equal(record.data.distinctJobCount, 2);
  assert.equal(record.data.assessedJobIds, `${jobs[0].jobId},${jobs[1].jobId}`);
  assert.equal(record.data.paymentReceived, 0);
  assert.equal(record.data.quantity, 0);

  // Cannot submit again after qualification is granted.
  assert.throws(() => engine.assess(life, "AT10", [jobs[0].jobId, jobs[1].jobId]), /already been granted/);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
