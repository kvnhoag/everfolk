import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import demo from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import ranked from "../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };
import { buildCareerEconomyTree } from "../client/career-economy-tree.ts";

const world = demo as unknown as WorldPack;
const engine = createEngine(world);
function adult(): LifeState {
  const life = structuredClone(engine.start("career-tree"));
  life.age = 24;
  life.phase = "ready";
  life.pendingEventId = null;
  life.character!.lastActivityAge = null;
  life.character!.jobId = null;
  life.economy!.cash = 500;
  return life;
}
const model = (life: LifeState) => buildCareerEconomyTree(world, life, engine.getActivities(life));

test("the generated tree covers every authored skill, occupation and legacy route without changing the life", () => {
  const life = adult(), before = structuredClone(life), pack = structuredClone(world);
  const tree = model(life);
  assert.deepEqual(tree.skills.map(node => node.id).sort(), Object.keys(world.character!.skills).sort());
  assert.deepEqual(tree.careers.map(node => node.job.id).sort(), world.character!.jobs.map(job => job.id).sort());
  assert.deepEqual(tree.routes.map(route => route.id).sort(), world.legacy!.routes.map(route => route.id).sort());
  for (const id of ["sculptor", "philosophy-tutor", "shopkeeper", "general", "grain-dealer"]) assert.ok(tree.careers.some(node => node.job.id === id));
  assert.ok(tree.links.some(link => link.from === "skill:carving" && link.to === "skill:sculpture"));
  assert.ok(tree.links.some(link => link.from === "skill:warfare" && link.to === "job:general" && link.required === 60));
  assert.ok(tree.careers.find(node => node.job.id === "sculptor")!.foundationIds.includes("craft"));
  assert.ok(tree.links.some(link => link.from === "job:farmhand" && link.to === "skill:farming" && link.kind === "develops"));
  assert.deepEqual(life, before);
  assert.deepEqual(world, pack);
});

test("the grain dealer exposes the real grain and cash gates as well as skills", () => {
  const life = adult();
  life.character!.skills.farming = 35;
  life.character!.skills.reckoning = 30;
  life.demo!.household.grain = 299;
  life.economy!.cash = 19;
  let dealer = model(life).careers.find(node => node.job.id === "grain-dealer")!;
  assert.equal(dealer.state, "Locked");
  const requirements = dealer.actions.flatMap(action => action.requirements);
  assert.ok(requirements.some(item => /300.*grain/i.test(item.text) && !item.met));
  assert.ok(requirements.some(item => /20.*dr/i.test(item.text) && !item.met));
  life.demo!.household.grain = 300;
  life.economy!.cash = 20;
  dealer = model(life).careers.find(node => node.job.id === "grain-dealer")!;
  assert.equal(dealer.state, "Ready");
  const action = dealer.actions.find(action => !action.reason)!;
  const next = engine.act(life, action.activity.id);
  assert.equal(next.character!.jobId, "grain-dealer");
  assert.equal(next.economy!.cash, 0);
  assert.equal(model(next).careers.find(node => node.job.id === "grain-dealer")!.state, "Current");
});

test("a supported soldier action follows the engine's activity budget and choice gates", () => {
  const life = adult();
  life.character!.skills.warfare = 20;
  const soldier = model(life).careers.find(node => node.job.id === "soldier")!;
  assert.equal(soldier.state, "Ready");
  assert.ok(soldier.actions.some(action => !action.reason));
  const enlisted = engine.act(life, soldier.actions.find(action => !action.reason)!.activity.id);
  assert.equal(enlisted.character!.jobId, "soldier");
  for (const node of model(enlisted).careers) for (const action of node.actions) assert.ok(action.reason);
  life.phase = "choice";
  life.pendingEventId = world.events[0].id;
  for (const node of model(life).careers) for (const action of node.actions) assert.ok(action.reason);
});

test("full future careers remain Unavailable in the demo and use real locks in unrestricted worlds", () => {
  const life = adult();
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 100;
  const fullEngine = createEngine(ranked as unknown as WorldPack);
  const unrestricted = structuredClone(fullEngine.start("full-careers"));
  unrestricted.age = 50;
  unrestricted.phase = "ready";
  unrestricted.pendingEventId = null;
  unrestricted.economy!.cash = 10000;
  for (const id of Object.keys(unrestricted.character!.skills)) unrestricted.character!.skills[id] = 100;
  const full = buildCareerEconomyTree(fullEngine.world, unrestricted, fullEngine.getActivities(unrestricted));
  for (const id of ["sculptor", "philosophy-tutor", "general", "pottery-workshop-lead"]) {
    assert.equal(model(life).careers.find(node => node.job.id === id)!.state, "Unavailable");
    assert.notEqual(full.careers.find(node => node.job.id === id)!.state, "Unavailable");
  }
  for (const route of model(life).routes.filter(route => ["sculpture", "philosophy"].includes(route.id))) {
    assert.ok(route.stages.flatMap(stage => stage.nodes).every(node => node.state === "Unavailable"));
  }
  for (const id of ["sculptor", "philosophy-tutor", "shopkeeper"]) {
    const node = full.careers.find(node => node.job.id === id)!;
    assert.equal(node.state, "Ready");
    const next = fullEngine.act(unrestricted, node.actions.find(action => !action.reason)!.activity.id);
    assert.equal(next.character!.jobId, id);
  }
  assert.equal(full.careers.find(node => node.job.id === "general")!.state, "Locked", "skills alone do not bypass the accepted-service command gates");
});

test("economic descriptions use the pack's conversion, production and army budget", () => {
  const life = adult();
  const tree = model(life);
  assert.match(tree.careers.find(node => node.job.id === "apprentice")!.economy.join(" "), new RegExp(`${world.economy!.unitsPerPoint} ${world.economy!.currency.short}`));
  assert.match(tree.careers.find(node => node.job.id === "soldier")!.economy.join(" "), /army purse/i);
  assert.match(tree.careers.find(node => node.job.id === "tenant-farmer")!.economy.join(" "), /harvest/i);
  assert.match(tree.careers.find(node => node.job.id === "grain-dealer")!.economy.join(" "), /market/i);
  assert.ok(tree.futurePaths.some(path => path.id === "kingship"));
});
