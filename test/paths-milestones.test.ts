import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/index.ts";
import { auditEvents } from "../src/paths/audit.ts";
import { lifeStageAt } from "../src/life-stages/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const byId = new Map(world.events.map(event => [event.id, event]));
const SPECIALIZATIONS = { FC: "farming", FR: "farming", AT: "clothing", AC: "ceramics", AS: "sculpture", PS: "research", PP: "civic", T: "trade", M: "soldiering" } as const;
const DEPTHS = [5, 8, 10] as const;
const milestoneId = (prefix: string, depth: number) => `milestone-${prefix.toLowerCase()}${depth}`;

/** An adult life at 30 in its home district, with the given atlas nodes learned. */
function adult(nodes: string[], seed = "milestones"): LifeState {
  const life = structuredClone(engine.start(seed)) as LifeState;
  life.age = 30;
  life.year = world.startYear + 30;
  for (const node of nodes) life.capabilities!.learned[node] = { age: 29, year: life.year - 1 };
  return life;
}

/** Plays forward (first choice each time) until `stop` or `years` pass; returns the event IDs offered or fired. */
function play(life: LifeState, years: number, stop: (life: LifeState) => boolean = () => false): { life: LifeState; seen: string[] } {
  const seen: string[] = [], until = life.age + years;
  for (let guard = 0; life.phase !== "ended" && life.age < until && !stop(life) && guard < 400; guard++) {
    if (life.phase === "choice") { seen.push(life.pendingEventId!); life = engine.choose(life, engine.getChoices(life)[0].id); }
    else life = engine.advance(life);
  }
  for (const entry of life.journal) if (entry.id.startsWith("milestone-") && !seen.includes(entry.id)) seen.push(entry.id);
  return { life, seen };
}

test("every specialization has milestones at depths 5, 8 and 10, gated by its node and tagged with its field", () => {
  for (const [prefix, field] of Object.entries(SPECIALIZATIONS)) for (const depth of DEPTHS) {
    const event = byId.get(milestoneId(prefix, depth)) as LifeEvent | undefined;
    assert.ok(event, milestoneId(prefix, depth));
    assert.ok(JSON.stringify(event.when).includes(`"node":"${prefix}${depth}"`), `${event.id} is gated by ${prefix}${depth}`);
    assert.deepEqual(event.fields, [field]);
    assert.ok(event.stages!.every(stage => ["adulthood", "later-life"].includes(stage)), event.id);
    assert.equal(event.maxOccurrences ?? 1, 1, `${event.id} happens once`);
  }
});

test("a milestone comes soon after its node is learned, once", () => {
  const { life, seen } = play(adult(["FC5"]), 3, state => state.pendingEventId === "milestone-fc5");
  assert.equal(life.pendingEventId, "milestone-fc5", `seen: ${seen.join(", ")}`);
  const after = play(engine.choose(life, engine.getChoices(life)[0].id), 8);
  assert.equal(after.life.eventCounts["milestone-fc5"], 1, "not offered again");
});

test("no milestone appears for a node the life has not learned", () => {
  for (let i = 0; i < 12; i++) {
    const { life, seen } = play(adult([], `no-milestones-${i}`), 6);
    for (const id of seen.filter(id => id.startsWith("milestone-"))) {
      const node = id.slice("milestone-".length).toUpperCase();
      assert.ok(life.capabilities!.learned[node], `${id} without ${node}`);
    }
  }
});

test("mastery makes the life one of its district's renowned people, with standing to match", () => {
  const life = adult(["FC10"]);
  const field = "farming", before = life.paths!.people[field][3], reputation = life.demo!.reputation;
  const { life: after, seen } = play(life, 2, state => state.journal.some(entry => entry.id.startsWith("milestone-fc10")));
  assert.ok(seen.includes("milestone-fc10") || after.journal.some(entry => entry.id.startsWith("milestone-fc10")), seen.join(", "));
  assert.ok(after.paths!.people[field][3] >= before + 1 || after.paths!.district !== life.paths!.district, "counted among the renowned");
  assert.ok(after.demo!.reputation > reputation, "reputation rises");
  assert.equal(after.flags["recognised-fc"], true);
});

test("youth conditioning builds strength and endurance, and only in youth", () => {
  const event = byId.get("youth-gymnasium")!;
  assert.ok(event, "youth-gymnasium exists");
  assert.deepEqual(event.stages, ["youth"]);
  const gains = event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects)).filter(effect => effect.type === "skill").map(effect => effect.type === "skill" ? effect.skill : "");
  assert.ok(gains.includes("strength") && gains.includes("endurance"), gains.join(", "));
  assert.equal(lifeStageAt(world, 15)!.id, "youth");
});

test("the village seed exchange explains the farming edge and happens only in a farming district", () => {
  const event = byId.get("village-seed-exchange")!;
  assert.ok(event, "village-seed-exchange exists");
  assert.ok(JSON.stringify(event.when).includes('"district":"delta-village"'));
  assert.deepEqual(event.fields, ["farming"]);
});

test("the new events pass every event rule", () => {
  const ids = new Set([...byId.keys()].filter(id => /^(milestone-|youth-gymnasium|youth-drill-ground|village-)/.test(id)));
  assert.ok(ids.size >= 29, `${ids.size} new events`);
  assert.deepEqual(auditEvents(world).filter(item => ids.has(item.eventId)), []);
});

test("joining the district's renowned updates its trade needs at once", async () => {
  const { refreshNeeds } = await import("../src/paths/index.ts");
  const life = adult(["FC10"]);
  const { life: after } = play(life, 2, state => state.journal.some(entry => entry.id.startsWith("milestone-fc10")));
  const fresh = structuredClone(after);
  refreshNeeds(world, fresh);
  assert.deepEqual(after.paths!.needs, fresh.paths!.needs);
});
