import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import baseline from "../worlds/alexandria-0.4.1.json" with { type: "json" };
// Content builders run as ordinary JavaScript, while their output is validated.
// @ts-expect-error The build-time JavaScript module deliberately has no TS wrapper.
import { applySpecialists } from "../scripts/alexandria-specialists.mjs";

function controlledWorld(prepared = false): WorldPack {
  const world = applySpecialists(structuredClone(baseline)) as WorldPack;
  world.version = "specialist-tests";
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.stats.wealth.initial = 90;
  if (prepared) for (const skill of Object.values(world.character!.skills)) skill.initial = 80;
  return world;
}

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  life = settle(engine, life);
  while (life.phase !== "ended" && life.age < target) life = settle(engine, engine.advance(life));
  return life;
}

function available(engine: LifeEngine, life: LifeState, id: string): boolean {
  return engine.getActivities(life).find(activity => activity.id === id)?.available ?? false;
}

test("specialist content validates, keeps four main stats and adds reachable craft specialisms", () => {
  const world = controlledWorld();
  validateWorld(world);
  assert.equal(Object.keys(world.stats).length, 4);
  assert.equal(Object.keys(world.character!.skills).length, 12);
  assert.equal(world.character!.jobs.length, 16);
  assert.equal(new Set(world.character!.activities.map(activity => activity.id)).size, world.character!.activities.length);
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("pottery-apprentice"), 12);
  assert.equal(available(engine, life, "work-ceramic-decorator"), false);
  life = engine.act(life, "train-pottery");
  life = engine.act(ageTo(engine, life, 13), "train-pottery");
  life = engine.act(ageTo(engine, life, 14), "train-pottery");
  life = engine.act(ageTo(engine, life, 15), "train-craft");
  life = ageTo(engine, life, 16);
  assert.ok(life.character!.skills.pottery >= 24);
  assert.equal(available(engine, life, "work-ceramic-decorator"), true);
  life = engine.act(life, "work-ceramic-decorator");
  assert.equal(life.character!.jobId, "ceramic-decorator");
  const pottery = life.character!.skills.pottery;
  life = ageTo(engine, life, 17);
  assert.ok(life.character!.skills.pottery >= pottery + 2);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("royal appointments disclose low authored odds and never bypass a prior commission", () => {
  const world = controlledWorld(true);
  const general = world.character!.activities.find(activity => activity.id === "seek-general-command")!;
  const court = world.character!.activities.find(activity => activity.id === "seek-court-appointment")!;
  assert.equal(general.outcomes.find(outcome => outcome.id === "general-appointed")!.weight / general.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0), .02);
  assert.equal(court.outcomes.find(outcome => outcome.id === "court-appointed")!.weight / court.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0), .03);
  assert.equal(general.cooldownYears, 6);
  assert.equal(court.cooldownYears, 5);
  const engine = createEngine(world);
  const life = ageTo(engine, engine.start("uncommissioned"), 28);
  assert.equal(available(engine, life, "seek-general-command"), false);
  assert.throws(() => engine.act(life, "seek-general-command"), /requirements/);
});

test("enlisting in either Alexandrian War year records actual service despite personal decision pacing", () => {
  const engine = createEngine(controlledWorld());
  let prepared = ageTo(engine, engine.start("wartime-enlistment"), 14);
  prepared = engine.act(prepared, "train-warfare");
  prepared = engine.act(ageTo(engine, prepared, 15), "train-warfare");
  const atEighteen = ageTo(engine, prepared, 18);
  assert.equal(atEighteen.year, -48);
  assert.equal(atEighteen.character!.jobId, "porter");
  const enlisted = engine.act(atEighteen, "enlist-royal-army");
  assert.equal(enlisted.character!.jobId, "soldier");
  assert.equal(enlisted.pendingEventId, "royal-campaign-muster", "A fixed-year war order is not blocked by the personal decision interval.");
  const served = engine.choose(enlisted, "guard-army-stores");
  assert.equal(served.flags["joined-alexandrian-war"], true);
  assert.deepEqual(engine.load(engine.save(served)), served);

  const atNineteen = ageTo(engine, atEighteen, 19);
  assert.equal(atNineteen.year, -47);
  const lateEnlistment = engine.act(atNineteen, "enlist-royal-army");
  assert.equal(lateEnlistment.character!.jobId, "soldier");
  assert.equal(lateEnlistment.flags["joined-alexandrian-war"], true);
  assert.ok(lateEnlistment.journal.some(entry => entry.id === "royal-garrison-reorganisation"));
  assert.deepEqual(engine.load(engine.save(lateEnlistment)), lateEnlistment);
});

test("a rare army command has reproducible success and refusal, then ends under Roman rule", () => {
  const world = controlledWorld(true);
  // Prepare an eligible officer inside the authored fixture; the skill-training
  // path is tested above, while this check isolates the exceptional appointment.
  world.events.push({ id: "prepared-officer", title: "Prepared officer", text: "A controlled test commission.", mode: "automatic", trigger: { type: "age", at: 22 }, choices: [], effects: [{ type: "job", job: "officer" }, { type: "flag", flag: "officer-commission", value: true }] });
  const engine = createEngine(world);
  let appointed: LifeState | undefined, refused: LifeState | undefined;
  for (let seed = 0; seed < 500 && (!appointed || !refused); seed++) {
    const before = ageTo(engine, engine.start(`rare-command-${seed}`), 28);
    assert.equal(available(engine, before, "seek-general-command"), true);
    const after = engine.act(before, "seek-general-command");
    assert.deepEqual(engine.load(engine.save(after)), after);
    if (after.character!.jobId === "general") appointed = after;
    else { refused = after; assert.equal(after.character!.jobId, "officer"); }
  }
  assert.ok(appointed, "The deterministic fixture includes a rare successful appointment.");
  assert.ok(refused, "A failed application remains an officer and still uses the year's activity.");
  assert.equal(refused.character!.lastActivityAge, 28);
  appointed = settle(engine, appointed);
  assert.ok(appointed.flags["protected-granary"] || appointed.flags["escorted-supplies"]);
  const postConquest = ageTo(engine, appointed, 36);
  assert.equal(postConquest.year, -30);
  assert.equal(postConquest.character!.jobId, null);
  assert.equal(postConquest.flags["royal-service-ended"], true);
  assert.equal(available(engine, postConquest, "enlist-royal-army"), false);
  assert.equal(available(engine, postConquest, "seek-general-command"), false);
  assert.equal(available(engine, postConquest, "seek-court-appointment"), false);
});

test("a court proposal can change a specific grain order with an immediate recorded follow-up", () => {
  const world = controlledWorld(true);
  world.events.push({ id: "prepared-adviser", title: "Prepared adviser", text: "A controlled court-appointment fixture.", mode: "automatic", trigger: { type: "age", at: 24 }, choices: [], effects: [{ type: "job", job: "court-adviser" }, { type: "flag", flag: "court-appointed", value: true }] });
  const engine = createEngine(world);
  let accepted: LifeState | undefined;
  for (let seed = 0; seed < 100 && !accepted; seed++) {
    const before = ageTo(engine, engine.start(`grain-proposal-${seed}`), 25);
    const after = engine.act(before, "propose-royal-grain-order");
    if (after.flags["grain-policy-adopted"]) accepted = after;
  }
  assert.ok(accepted);
  assert.equal(accepted.flags["district-grain-delivered"], true);
  assert.ok(accepted.journal.some(entry => entry.id === "royal-grain-order-carried-out"));
  assert.deepEqual(engine.load(engine.save(accepted)), accepted);
});

test("professional horoscope work is gated to the later evidence context without changing death risk", () => {
  const world = controlledWorld(true);
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("later-horoscope-work"), 36);
  assert.equal(life.year, -30);
  assert.equal(available(engine, life, "work-astrologer"), false);
  life = ageTo(engine, life, 37);
  assert.equal(life.year, -29);
  assert.equal(available(engine, life, "work-astrologer"), true);
  life = engine.act(life, "work-astrologer");
  assert.equal(life.character!.jobId, "astrologer");
  assert.deepEqual(engine.world.mortality, world.mortality);
  assert.ok(engine.world.character!.activities.find(activity => activity.id === "research-astrological-readings")!.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end")));
});
