import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import { settleCapabilities } from "../src/capabilities/engine.ts";
import { farmProofProgress } from "../src/capabilities/farming.ts";
import { workQuote } from "../src/capabilities/work.ts";
import { activityProofSkills, jobProofSkills, laneOf, nextProofNode, proofFromWork, recordActivityProof, recordWorkProofs, SKILL_LANES } from "../src/capabilities/work-proof.ts";
import { learnedThisYear } from "../client/models/skill-learned-notice.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { runWoodworkerPolicy } from "./work-proof-policy.ts";
import currentPack from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import retainedPack from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };

const current = currentPack as unknown as WorldPack, retained = retainedPack as unknown as WorldPack;
const adult = (world: WorldPack, age = 16): LifeState => {
  const life = structuredClone(createEngine(world).start("work-proof")) as LifeState;
  Object.assign(life, { age: age + 1, year: life.year + age + 1 });
  life.character!.jobId = null;
  return life;
};
const proofs = (life: LifeState) => life.capabilities!.evidence.filter(e => e.kind === "activity-proof" || e.kind === "job-proof");
const handmade = (world: WorldPack, life: LifeState) => Object.keys(life.capabilities?.learned ?? {}).filter(id => laneOf(world.capabilities!.nodes.find(n => n.id === id)!).startsWith("Handmade/"));

test("only the new revision opts in to proof from everyday work", () => {
  assert.equal(current.version, "alexandria-lives-6");
  assert.equal(current.capabilities!.proofFromWork, true);
  assert.equal(proofFromWork(current), true);
  assert.equal(retained.capabilities!.proofFromWork, undefined);
  assert.equal(proofFromWork(retained), false);
  const broken = structuredClone(current);
  (broken.capabilities as unknown as Record<string, unknown>).proofFromWork = "yes";
  assert.throws(() => validateWorld(broken), /proofFromWork/);
});

test("every mapped lane exists in the graph, and every trained skill of the graph has a lane", () => {
  const lanes = new Set(current.capabilities!.nodes.map(laneOf));
  for (const [skill, list] of Object.entries(SKILL_LANES)) for (const lane of list) assert.ok(lanes.has(lane), `${skill} -> ${lane}`);
  for (const skill of ["craft", "pottery", "carving", "sculpture", "literacy", "philosophy", "oratory", "astronomy", "reckoning", "farming", "strength", "endurance", "warfare"]) assert.ok(SKILL_LANES[skill]?.length, skill);
  for (const lane of lanes) assert.ok(Object.values(SKILL_LANES).some(list => list.includes(lane)), `${lane} has no matching work`);
});

test("activities train the skills of their effects; recorded capability work and job applications are not passive proof", () => {
  assert.deepEqual(activityProofSkills(current, "train-craft"), ["craft"]);
  assert.deepEqual(activityProofSkills(current, "train-literacy"), ["literacy"]);
  assert.deepEqual(activityProofSkills(current, "train-pottery")[0], "pottery");
  assert.deepEqual(activityProofSkills(current, "v-practice-reckoning"), ["reckoning"]);
  assert.deepEqual(activityProofSkills(current, "v-apprentice-textiles"), ["craft", "reckoning"]);
  assert.deepEqual(activityProofSkills(current, "cap-work-a1"), []);
  assert.deepEqual(activityProofSkills(current, "v-qualify-tailor"), []);
  assert.deepEqual(activityProofSkills(current, "visit-a-friend"), []);
});

test("jobs map to the skills they practise", () => {
  assert.deepEqual(jobProofSkills(current, "apprentice"), ["craft"]);
  assert.deepEqual(jobProofSkills(current, "potter")[0], "pottery");
  assert.deepEqual(jobProofSkills(current, "farmhand"), ["farming"]);
  assert.deepEqual(jobProofSkills(current, "tenant-farmer"), ["farming"]);
  assert.deepEqual(jobProofSkills(current, "soldier")[0], "warfare");
  assert.deepEqual(jobProofSkills(current, "clerk"), ["reckoning", "literacy"]);
  assert.deepEqual(jobProofSkills(current, "unknown-job"), []);
});

test("the next proof goes to the lowest open step of the matching lane", () => {
  const life = adult(current);
  life.character!.skills.craft = 30; life.character!.skills.reckoning = 0;
  assert.equal(nextProofNode(current, life, ["craft"]), "A1");
  life.capabilities!.learned.A1 = { age: 13, year: 0 };
  assert.equal(nextProofNode(current, life, ["craft"]), undefined, "A2 still needs Reckoning 8");
  life.character!.skills.reckoning = 10;
  assert.equal(nextProofNode(current, life, ["craft"]), "A2");
  for (const id of ["A2", "A3", "A4"]) life.capabilities!.learned[id] = { age: 14, year: 0 };
  life.character!.skills.craft = 40; life.character!.skills.pottery = 10;
  assert.equal(nextProofNode(current, life, ["craft"]), "AT5");
  assert.equal(nextProofNode(current, life, ["pottery", "craft"]), "AC5");
});

test("steps whose recorded work feeds the next step, or is itself assessed, still need recorded work", () => {
  const life = adult(current, 40);
  for (const node of current.capabilities!.nodes) life.capabilities!.learned[node.id] = { age: 30, year: 0 };
  for (const skill of Object.keys(life.character!.skills)) life.character!.skills[skill] = 100;
  Object.assign(life.stats, { health: 90, knowledge: 90 });
  for (const id of ["T2", "PS8", "AS5", "FC8", "T10", "AT10", "PS10", "PP9"]) {
    delete life.capabilities!.learned[id];
    const skills = id.startsWith("A") ? ["craft", "sculpture"] : id.startsWith("T") ? ["reckoning"] : id.startsWith("F") ? ["farming"] : ["philosophy"];
    assert.equal(nextProofNode(current, life, skills), undefined, id);
    life.capabilities!.learned[id] = { age: 30, year: 0 };
  }
  delete life.capabilities!.learned.T3;
  assert.equal(nextProofNode(current, life, ["reckoning"]), "T3", "the step after the recorded cost basket is open to practice again");
});

test("after material preparation learned from practice, controlled making prepares its own clay; older worlds keep the prepared-clay input", () => {
  for (const [world, inputs] of [[current, { clay: 2, fuel: 1 }], [retained, { "prepared-clay": 2, fuel: 1 }]] as const) {
    const life = adult(world, 20);
    for (const id of ["A1", "A2", "A3"]) life.capabilities!.learned[id] = { age: 15, year: 0 };
    life.character!.skills.craft = 30;
    assert.deepEqual(workQuote(world, life, "A4").inputs, inputs, world.version);
  }
  const life = adult(current, 20);
  life.vocations!.inventory["prepared-clay"] = 2;
  assert.deepEqual(workQuote(current, life, "A4").inputs, { "prepared-clay": 2, fuel: 1 }, "recorded preparation keeps its clay in use");
});

test("a year of practice and a year of work each record one proof, and change no money or goods", () => {
  const life = adult(current);
  life.age = 16;
  life.character!.skills.craft = 10;
  life.character!.jobId = "apprentice";
  const before = JSON.stringify({ economy: life.economy, demo: life.demo, vocations: life.vocations, stats: life.stats, skills: life.character!.skills });
  recordActivityProof(current, life, "train-craft");
  life.age = 17;
  recordWorkProofs(current, life, 16);
  assert.deepEqual(proofs(life).map(e => [e.nodeId, e.age, e.kind, e.data.qualifies]), [["A1", 16, "activity-proof", true]], "one proof per step and age");
  assert.equal(JSON.stringify({ economy: life.economy, demo: life.demo, vocations: life.vocations, stats: life.stats, skills: life.character!.skills }), before);
  recordWorkProofs(current, life, 16);
  assert.equal(proofs(life).length, 1, "settling twice adds nothing");
});

test("proof needs the age for capability work and an actual year of work", () => {
  const child = adult(current);
  child.age = 11;
  recordActivityProof(current, child, "train-craft");
  assert.equal(proofs(child).length, 0, "capability work begins at 12");
  const busy = adult(current);
  busy.character!.jobId = "apprentice"; busy.vocations!.workedAge = 16;
  recordWorkProofs(current, busy, 16);
  assert.equal(proofs(busy).length, 0, "a job set aside for other work is not a work year");
});

test("the practice that first reaches a step's skill level does not also prove it", () => {
  const engine = createEngine(current);
  let life = engine.start("gate-year");
  while ((life.age < 13 || life.phase === "choice") && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  const draft = structuredClone(life) as LifeState;
  draft.capabilities!.learned.F1 = { age: 12, year: draft.year - 1 };
  draft.character!.skills.farming = 6;
  draft.economy!.cash = 50;
  const practised = engine.act(draft, "v-practice-farming");
  assert.ok(practised.character!.skills.farming >= 8, "this year's practice reaches Farming 8");
  assert.deepEqual(proofs(practised), [], "F2 was not open when the year's practice began");
  const draftTwo = structuredClone(life) as LifeState;
  Object.assign(draftTwo.capabilities!.learned, { F1: { age: 12, year: draftTwo.year - 1 } });
  draftTwo.character!.skills.farming = 9; draftTwo.economy!.cash = 50;
  assert.deepEqual(proofs(engine.act(draftTwo, "v-practice-farming")).map(e => [e.nodeId, e.kind]), [["F2", "activity-proof"]]);
});

test("the retained lives-5 world records nothing", () => {
  const life = adult(retained);
  life.age = 16; life.character!.jobId = "apprentice";
  recordActivityProof(retained, life, "train-craft");
  life.age = 17;
  settleCapabilities(retained, life, 16);
  assert.equal(proofs(life).length, 0);
  assert.deepEqual(life.capabilities!.learned, {});
});

test("years as a farmhand count toward the next farming step", () => {
  const life = adult(current, 20);
  life.character!.jobId = "farmhand"; life.character!.skills.farming = 10;
  recordWorkProofs(current, life, 20);
  assert.deepEqual(proofs(life).map(e => [e.nodeId, e.kind]), [["F1", "job-proof"]]);
  assert.equal(farmProofProgress(current, life, "F1").complete, true);
  assert.equal(farmProofProgress(retained, life, "F1").done, 0, "older worlds count only harvest receipts");
});

test("service years prove military steps only when the army's accounts reconcile", () => {
  const life = adult(current, 20);
  for (const id of ["F1", "B2", "B3", "P1", "M4"]) life.capabilities!.learned[id] = { age: 18, year: 0 };
  Object.assign(life.character!.skills, { warfare: 30, endurance: 30, strength: 30 });
  life.stats.health = 80;
  life.character!.jobId = "soldier";
  recordWorkProofs(current, life, 20);
  assert.equal(proofs(life).length, 0, "no settled service year");
  life.capabilities!.military = { service: [{ age: 20, role: "soldier", paid: 10, wage: 10, rations: 5, ration: 5, purseBefore: 100, purseAfter: 90, grainBefore: 50, grainAfter: 45 }] };
  recordWorkProofs(current, life, 20);
  assert.deepEqual(proofs(life).map(e => [e.nodeId, e.kind]), [["M5", "job-proof"]]);
});

test("a serving soldier's woodwork does not prove civilian steps", () => {
  const life = adult(current);
  life.age = 16; life.character!.jobId = "soldier"; life.character!.skills.craft = 10;
  recordActivityProof(current, life, "train-craft");
  assert.deepEqual(proofs(life).filter(e => e.nodeId.startsWith("A")), []);
});

test("lives-6: a young woodworker learns a handmade skill by 20 and is told so; lives-5 learns none", () => {
  const notices: string[] = [];
  const life = runWoodworkerPolicy(current, "woodworker-0", 20, year => notices.push(...learnedThisYear(year, current).map(notice => notice.id)));
  assert.ok(handmade(current, life).length >= 1, JSON.stringify(life.capabilities!.learned));
  assert.ok(notices.includes(handmade(current, life)[0]), "the Skill learned notice fires for an automatic step");
  assert.ok(proofs(life).every(e => e.data.qualifies === true));
  for (const seed of ["woodworker-0", "woodworker-1", "woodworker-2"]) {
    assert.deepEqual(runWoodworkerPolicy(retained, seed, 20).capabilities!.learned, {}, seed);
  }
});

test("lives-6 proof from work replays deterministically", () => {
  const engine = createEngine(current);
  const life = runWoodworkerPolicy(current, "woodworker-1", 24);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(runWoodworkerPolicy(current, "woodworker-1", 24), life);
});
