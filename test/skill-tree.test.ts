import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { CharacterActivity, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.4.0.json" with { type: "json" };
import { buildSkillTree, guaranteedSkillRequirements, layoutSkillTree, practiceBlockReason, skillActionRequirements, trainingSkillChanges } from "../client/skill-tree.ts";

const main = pack as WorldPack;
function adult(world = main): { engine: ReturnType<typeof createEngine>; life: LifeState } {
  const engine = createEngine(world), initial = engine.start("skill-tree-ui");
  return { engine, life: { ...initial, age: 20, year: world.startYear + 20, phase: "ready", pendingEventId: null, stats: { ...initial.stats, wealth: 100 }, character: { ...initial.character!, skills: { ...initial.character!.skills } } } };
}

test("the thirteen-skill board uses actual authored dependencies and genuine left-to-right tiers", () => {
  const { engine, life } = adult();
  const model = buildSkillTree(main, life, engine.getActivities(life));
  assert.equal(model.nodes.length, 13);
  assert.deepEqual(model.branches, ["Crafts", "Letters & ideas", "Numbers & sky", "Practical service", "Performance"]);
  assert.deepEqual(model.edges.map(edge => `${edge.from}:${edge.to}:${edge.threshold}`).sort(), [
    "craft:pottery:15", "craft:carving:15", "carving:sculpture:20", "pottery:sculpture:10",
    "literacy:oratory:10", "literacy:philosophy:20", "oratory:philosophy:10",
    "reckoning:astronomy:15", "literacy:astronomy:10", "astronomy:astrology:10", "reckoning:astrology:10", "craft:warfare:10",
  ].sort());
  const layout = layoutSkillTree(model);
  for (const edge of model.edges) assert.ok(layout.positions[edge.from].x < layout.positions[edge.to].x);
  for (const node of model.nodes) {
    const position = layout.positions[node.id];
    assert.ok(position.x >= 0 && position.x + layout.cardWidth <= layout.width);
    assert.ok(position.y >= 0 && position.y + layout.cardHeight <= layout.height);
    for (const other of model.nodes.filter(other => other.id !== node.id)) {
      const right = layout.positions[other.id];
      assert.ok(position.x + layout.cardWidth <= right.x || right.x + layout.cardWidth <= position.x || position.y + layout.cardHeight <= right.y || right.y + layout.cardHeight <= position.y, `${node.id} overlaps ${other.id}`);
    }
  }
});

test("locked, ready, learning and mastered describe progression, independently of the annual budget", () => {
  const { engine, life } = adult();
  life.character!.skills.literacy = 6;
  life.character!.skills.seamanship = 100;
  const read = () => buildSkillTree(main, life, engine.getActivities(life));
  const model = read();
  assert.equal(model.nodes.find(node => node.id === "craft")!.state, "ready");
  assert.equal(model.nodes.find(node => node.id === "literacy")!.state, "learning");
  assert.equal(model.nodes.find(node => node.id === "seamanship")!.state, "mastered");
  assert.equal(model.nodes.find(node => node.id === "pottery")!.state, "locked");
  life.character!.lastActivityAge = life.age;
  assert.equal(read().nodes.find(node => node.id === "craft")!.state, "ready");
  assert.equal(read().nodes.find(node => node.id === "craft")!.canPractice, false);
  life.character!.lastActivityAge = null;
  life.phase = "choice";
  life.pendingEventId = main.events.find(event => event.mode !== "automatic" && event.choices.length > 0)!.id;
  assert.equal(read().nodes.find(node => node.id === "craft")!.state, "ready");
  assert.equal(read().nodes.find(node => node.id === "craft")!.canPractice, false);
  life.phase = "ready";
  life.pendingEventId = null;
  life.stats.wealth = 0;
  life.economy = { ...life.economy!, cash: 0 };
  assert.equal(read().nodes.find(node => node.id === "craft")!.state, "ready");
  assert.equal(read().nodes.find(node => node.id === "craft")!.canPractice, false);
});

test("practice shows the canonical activity, real thresholds and all career requirements", () => {
  const { engine, life } = adult();
  life.character!.skills.craft = 15;
  let model = buildSkillTree(main, life, engine.getActivities(life));
  const pottery = model.nodes.find(node => node.id === "pottery")!;
  assert.equal(pottery.state, "ready");
  assert.equal(pottery.canPractice, true);
  assert.deepEqual(pottery.training.map(activity => activity.id), ["train-pottery"]);
  assert.equal(model.nodes.find(node => node.id === "craft")!.training[0].id, "train-craft", "secondary craft gains do not replace direct practice");
  const sculpture = model.nodes.find(node => node.id === "sculpture")!;
  assert.deepEqual(sculpture.requirements.map(item => [item.id, item.met]), [["carving", false], ["pottery", false]]);
  const career = model.nodes.flatMap(node => node.careers).find(career => Object.keys(career.job.requirements ?? {}).length > 1)!;
  assert.ok(career, "a multi-skill occupation must be visible");
  assert.equal(career.requirements.length, Object.keys(career.job.requirements!).length);
  for (const requirement of career.requirements) life.character!.skills[requirement.id] = requirement.required;
  model = buildSkillTree(main, life, engine.getActivities(life));
  const qualified = model.nodes.flatMap(node => node.careers).find(item => item.job.id === career.job.id)!;
  assert.equal(qualified.thresholdsMet, life.age >= qualified.job.minAge);
  assert.ok(qualified.activities.length > 0, "career actions expose their additional real availability");
  assert.notEqual(life.character!.jobId, qualified.job.id, "meeting displayed thresholds does not assign a job");
});

test("legacy four-skill worlds get a complete display without invented dependencies or rule changes", () => {
  const world = legacy as WorldPack;
  const { engine, life } = adult(world);
  const before = JSON.stringify({ world, life });
  const model = buildSkillTree(world, life, engine.getActivities(life));
  assert.deepEqual(model.nodes.map(node => node.id), ["literacy", "reckoning", "craft", "seamanship"]);
  assert.equal(model.edges.length, 0);
  for (const node of model.nodes) assert.ok(node.training.length > 0);
  assert.equal(JSON.stringify({ world, life }), before);
});

test("legacy conditions infer only guaranteed positive bounds, preserving alternative paths", () => {
  assert.deepEqual(guaranteedSkillRequirements({ type: "any", conditions: [
    { type: "all", conditions: [{ type: "skill", skill: "craft", op: "gte", value: 20 }, { type: "skill", skill: "letters", op: "gte", value: 10 }] },
    { type: "skill", skill: "craft", op: "gte", value: 5 },
  ] }), { craft: 5 });
  assert.deepEqual(guaranteedSkillRequirements({ type: "any", conditions: [{ type: "skill", skill: "craft", op: "gte", value: 20 }, { type: "age", op: "gte", value: 18 }] }), {});
  assert.deepEqual(guaranteedSkillRequirements({ type: "not", condition: { type: "skill", skill: "craft", op: "gte", value: 10 } }), {});
});

function tinyWorld(): WorldPack {
  const training = (id: string): CharacterActivity => ({ id: `train-${id}`, category: "training", text: `Practice ${id}`, minAge: 6, outcomes: [{ id: "done", text: "You practice.", weight: 1, effects: [{ type: "skill", skill: id, delta: 10 }, { type: "stat", stat: "wealth", delta: -1 }] }] });
  return {
    schemaVersion: 1, id: "tree-fixture", version: "1.0.0", title: "Skill tree", description: "Test world", startYear: -50, maxAge: 100,
    stats: { wealth: { label: "Resources", min: 0, max: 100, initial: 40 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "death", title: "Died", text: "Life ends.", kind: "death" }], defaultEnding: "death",
    character: { skills: {
      craft: { label: "Craft", min: 0, max: 100, initial: 0, prerequisites: {}, trainingActivity: "train-craft" },
      pottery: { label: "Pottery", min: 0, max: 100, initial: 0, prerequisites: { craft: 10 }, trainingActivity: "train-pottery" },
      sculpture: { label: "Sculpture", min: 0, max: 100, initial: 0, prerequisites: { pottery: 10 }, trainingActivity: "train-sculpture" },
    }, jobs: [{ id: "sculptor", title: "Sculptor", description: "Carve figures.", minAge: 8, requirements: { sculpture: 10, pottery: 10 }, yearlyEffects: [] }],
    partners: [], activities: [training("craft"), training("pottery"), training("sculpture")], childNames: ["Ada"], deathCauses: [{ id: "fever", title: "Fever", text: "A fever.", weight: 1 }], deathCauseDescription: "Fictional test." },
  };
}

test("following a path unlocks real engine training, spends one yearly action and reaches job thresholds", () => {
  const world = tinyWorld(), engine = createEngine(world);
  let life = engine.start("path");
  while (life.age < 6) life = engine.advance(life);
  let model = buildSkillTree(world, life, engine.getActivities(life));
  assert.equal(model.nodes.find(node => node.id === "pottery")!.canPractice, false);
  life = engine.act(life, "train-craft");
  model = buildSkillTree(world, life, engine.getActivities(life));
  assert.equal(model.nodes.find(node => node.id === "pottery")!.state, "ready");
  assert.equal(model.nodes.find(node => node.id === "pottery")!.canPractice, false);
  life = engine.advance(life);
  assert.equal(buildSkillTree(world, life, engine.getActivities(life)).nodes.find(node => node.id === "pottery")!.canPractice, true);
  life = engine.act(life, "train-pottery");
  life = engine.advance(life);
  life = engine.act(life, "train-sculpture");
  const final = buildSkillTree(world, life, engine.getActivities(life));
  assert.equal(final.nodes.find(node => node.id === "sculpture")!.careers[0].thresholdsMet, true);
  assert.equal(life.character!.jobId, null);
});

test("building, laying out and previewing are read-only and preserve the RNG and bounded changes", () => {
  const { engine, life } = adult();
  life.character!.skills.literacy = 99;
  const activities = engine.getActivities(life), before = JSON.stringify({ life, world: main, activities });
  const model = buildSkillTree(main, life, activities);
  layoutSkillTree(model);
  const practice = model.nodes.find(node => node.id === "literacy")!.training[0];
  const changes = trainingSkillChanges(practice, main, life);
  const literacy = changes.find(change => change.id === "literacy")!;
  assert.equal(literacy.label, "Literacy");
  assert.ok(Math.abs(literacy.min - 0.018) < 1e-10);
  assert.equal(literacy.max, literacy.min);
  assert.equal(practiceBlockReason(practice, life), undefined);
  assert.equal(JSON.stringify({ life, world: main, activities }), before);
});

test("a skill lists occupations that develop it as well as those requiring it", () => {
  const { engine, life } = adult();
  const model = buildSkillTree(main, life, engine.getActivities(life));
  const pottery = model.nodes.find(node => node.id === "pottery")!;
  const potter = pottery.careers.find(career => career.job.id === "potter")!;
  assert.ok(potter, "A pottery interest must show the ordinary potter occupation.");
  assert.deepEqual(potter.requirements.map(requirement => [requirement.id, requirement.required]), [["craft", 15]], "A display connection does not invent a new job requirement.");
  assert.ok(pottery.careers.some(career => career.job.id === "ceramic-decorator"));
  assert.ok(model.nodes.find(node => node.id === "craft")!.careers.some(career => career.job.id === "apprentice"));
  assert.equal(life.character!.jobId, null, "Opening career options never starts an occupation.");
});

function paidWorkFixture(): WorldPack {
  const world = tinyWorld();
  const paid = (id: string, effects: CharacterActivity["outcomes"][number]["effects"], when?: CharacterActivity["when"]): CharacterActivity => ({
    id, text: id, category: "career", minAge: 6, cooldownYears: 3, ...(when ? { when } : {}),
    outcomes: [{ id: `${id}-done`, text: "A task is completed.", weight: 1, effects }],
  });
  world.character!.activities.push(
    paid("craft-commission", [{ type: "stat", stat: "wealth", delta: 2 }], { type: "skill", skill: "craft", op: "gte", value: 10 }),
    paid("sculpture-commission", [{ type: "stat", stat: "wealth", delta: 2 }, { type: "skill", skill: "sculpture", delta: 2 }]),
    paid("unpaid-craft", [{ type: "stat", stat: "wealth", delta: -1 }, { type: "skill", skill: "craft", delta: 2 }]),
    paid("occupation-with-payment", [{ type: "stat", stat: "wealth", delta: 2 }, { type: "skill", skill: "pottery", delta: 1 }, { type: "job", job: "sculptor" }]),
    paid("unrelated-income", [{ type: "stat", stat: "wealth", delta: 2 }]),
    paid("alternative-skills", [{ type: "stat", stat: "wealth", delta: 2 }], { type: "any", conditions: [
      { type: "skill", skill: "craft", op: "gte", value: 10 }, { type: "skill", skill: "pottery", op: "gte", value: 10 },
    ] }),
    paid("no-income-after-death", [{ type: "skill", skill: "craft", delta: 2 }, { type: "end", ending: "death" }, { type: "stat", stat: "wealth", delta: 2 }]),
  );
  return world;
}

test("paid skill work is connected by genuine skill use and excludes occupation changes and unrelated income", () => {
  const world = paidWorkFixture(), { engine, life } = adult(world);
  const activities = engine.getActivities(life);
  const before = JSON.stringify({ world, life, activities });
  const model = buildSkillTree(world, life, activities);
  assert.deepEqual(model.nodes.find(node => node.id === "craft")!.paidWork.map(activity => activity.id), ["craft-commission"]);
  assert.deepEqual(model.nodes.find(node => node.id === "sculpture")!.paidWork.map(activity => activity.id), ["sculpture-commission"]);
  assert.deepEqual(model.nodes.find(node => node.id === "pottery")!.paidWork, []);
  const allWork = model.nodes.flatMap(node => node.paidWork);
  for (const id of ["unpaid-craft", "occupation-with-payment", "unrelated-income", "alternative-skills", "no-income-after-death"]) assert.equal(allWork.some(activity => activity.id === id), false, id);
  assert.equal(JSON.stringify({ world, life, activities }), before, "Projecting earning paths cannot consume RNG, accept work or alter a life.");
});

test("paid-work projections retain engine availability and the same annual, decision and cooldown guards", () => {
  const world = paidWorkFixture(), engine = createEngine(world);
  let life = engine.start("paid-work-availability");
  while (life.age < 6) life = engine.advance(life);
  const work = () => buildSkillTree(world, life, engine.getActivities(life)).nodes.find(node => node.id === "craft")!.paidWork[0];
  assert.equal(work().available, false);
  assert.match(practiceBlockReason(work(), life)!, /Craft.*10/);
  life = engine.act(life, "train-craft");
  assert.equal(work().available, false);
  assert.match(practiceBlockReason(work(), life)!, /Action used/);
  life = engine.advance(life);
  const candidates = engine.getActivities(life), model = buildSkillTree(world, life, candidates);
  assert.equal(model.nodes.find(node => node.id === "craft")!.paidWork[0], candidates.find(activity => activity.id === "craft-commission"), "The model retains the engine's exact activity and availability.");
  assert.equal(practiceBlockReason(work(), { ...life, phase: "choice" }), "Make the pending choice first.");
  assert.equal(practiceBlockReason(work(), { ...life, phase: "ended" }), "This life has ended.");
  assert.equal(practiceBlockReason(work(), life), undefined);
  life = engine.act(life, "craft-commission");
  life = engine.advance(life);
  assert.equal(work().available, false);
  assert.match(practiceBlockReason(work(), life)!, /Available again at age 10/);
});

test("action notes explain shared material and era gates without presenting one alternative as mandatory", () => {
  const activity: CharacterActivity = { id: "noted-work", text: "A paid task", category: "career", minAge: 14, cooldownYears: 2,
    when: { type: "all", conditions: [
      { type: "skill", skill: "pottery", op: "gte", value: 20 },
      { type: "asset", asset: "tool-chest", op: "gte", value: 1 },
      { type: "cash", op: "gte", value: 10 },
      { type: "year", op: "gte", value: -29 },
      { type: "any", conditions: [
        { type: "skill", skill: "craft", op: "gte", value: 15 },
        { type: "skill", skill: "carving", op: "gte", value: 15 },
      ] },
    ] }, outcomes: [{ id: "done", text: "Done.", weight: 1, effects: [] }] };
  assert.deepEqual(skillActionRequirements(activity, main), ["Age 14+", "Pottery 20", "Own tool chest", "Cash at least 10 dr", "From 29 BCE", "Every 2 years"]);
  assert.deepEqual(skillActionRequirements({ ...activity, when: { type: "year", op: "gte", value: 0 } }, main), ["Age 14+", "Every 2 years"], "A valid year comparison at the BCE/CE boundary must not render a nonexistent year zero.");
});
