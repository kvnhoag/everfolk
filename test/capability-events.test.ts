import assert from "node:assert/strict";
import test from "node:test";
import { adaptSkillTreeEvents, capabilityEvents, CAPABILITY_EVENT_TOPICS } from "../src/capabilities/events.ts";
import { matchesCondition } from "../src/conditions.ts";
import type { Condition, LifeState, WorldPack } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };

const supported = new Set(["farming", "craft", "pottery", "carving", "sculpture", "philosophy", "literacy", "reckoning", "oratory"]);
function nodes(condition: Condition | undefined): string[] {
  if (!condition) return [];
  if (condition.type === "capability") return [condition.node];
  if (condition.type === "all" || condition.type === "any") return condition.conditions.flatMap(nodes);
  if (condition.type === "not") return nodes(condition.condition);
  return [];
}
function evidenceState(learned: Record<string, { year: number; evidenceIds: string[] }> = {}): LifeState {
  return { age: 40, year: -310, character: { skills: Object.fromEntries([...supported].map(id => [id, 100])) },
    capabilities: { learned, evidence: [] } } as unknown as LifeState;
}

test("all eight specializations receive introductory, applied and advanced decisions", () => {
  const events = capabilityEvents(-350);
  assert.equal(events.length, 24);
  assert.equal(new Set(events.map(event => event.id)).size, 24);
  assert.deepEqual(events.map(event => event.id), CAPABILITY_EVENT_TOPICS.map(([id]) => `cap-tree-${id}`));
  const branches = new Set(CAPABILITY_EVENT_TOPICS.map(([, branch]) => branch));
  assert.equal(branches.size, 8);
  for (const branch of branches) {
    assert.deepEqual(CAPABILITY_EVENT_TOPICS.filter(([, value]) => value === branch).map(([, , stage]) => stage), ["introductory", "applied", "advanced"]);
  }
  assert.ok(new Set(events.map(event => event.title)).size === events.length);
  assert.ok(events.every(event => event.evidence === "fictional" && event.maxOccurrences === 1 && event.choices.length === 3));
});

test("conversation gains are bounded and cannot fabricate goods, work proofs, appointments or mastery", () => {
  const events = capabilityEvents(-350);
  const skillIds = new Set(Object.keys(retained.character.skills));
  const statIds = new Set(Object.keys(retained.stats));
  let healthTradeOff = false, trustTradeOff = false;
  for (const event of events) for (const choice of event.choices) for (const outcome of choice.outcomes) {
    for (const effect of outcome.effects) {
      assert.ok(effect.type === "skill" || effect.type === "stat", `${event.id}: a decision must not invent work evidence`);
      if (effect.type === "skill") { assert.ok(skillIds.has(effect.skill)); assert.ok(effect.delta > 0 && effect.delta <= 3); }
      if (effect.type === "stat") {
        assert.ok(statIds.has(effect.stat));
        assert.ok(Math.abs(effect.delta) <= 3);
        healthTradeOff ||= effect.stat === "health" && effect.delta < 0;
        trustTradeOff ||= effect.stat === "bonds" && effect.delta < 0;
      }
    }
  }
  assert.ok(healthTradeOff && trustTradeOff, "workshop and public decisions have concrete consequences");
});

test("advanced subjects remain unavailable without the learned parent even with maximum proficiency", () => {
  const events = capabilityEvents(-350);
  for (const event of events) {
    const gateNodes = nodes(event.when);
    if (!gateNodes.length) continue;
    assert.equal(matchesCondition(event.when, evidenceState()), false, event.id);
    const learned = Object.fromEntries(gateNodes.map(node => [node, { year: -311, evidenceIds: ["completed-work"] }]));
    assert.equal(matchesCondition(event.when, evidenceState(learned)), true, event.id);
  }
});

test("adapting the new revision leaves the retained input byte-for-byte unchanged and is idempotent", () => {
  const input = structuredClone(retained) as unknown as WorldPack;
  const before = JSON.stringify(input);
  const adapted = adaptSkillTreeEvents(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(adapted.version, input.version, "the caller owns revision selection");
  assert.equal(adapted.events.filter(event => event.id.startsWith("cap-tree-")).length, 24);
  assert.deepEqual(adaptSkillTreeEvents(adapted), adapted);
  assert.deepEqual(adapted.character, input.character, "event authoring cannot change work rules");
  assert.deepEqual(adapted.demo, input.demo, "event authoring cannot create crop resources");
});

test("old mastery shortcuts become bounded feedback while unrelated future-branch mastery remains intact", () => {
  const adapted = adaptSkillTreeEvents(retained as unknown as WorldPack);
  for (const event of adapted.events) for (const choice of event.choices) for (const outcome of choice.outcomes) {
    for (const effect of outcome.effects) {
      assert.ok(!(effect.type === "mastery" && effect.target === "skill" && supported.has(effect.id)), event.id);
      assert.ok(!(effect.type === "mastery" && effect.target === "stat" && ["knowledge", "bonds"].includes(effect.id)), event.id);
      if (effect.type === "skill" && supported.has(effect.skill)) assert.ok(effect.delta <= 3, event.id);
    }
  }
  const military = adapted.events.flatMap(event => event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects)))
    .find(effect => effect.type === "mastery" && effect.target === "skill" && effect.id === "warfare");
  assert.ok(military, "unavailable military extension is not silently redesigned");
});

test("legacy prestige in supported branches requires demonstrated advanced capabilities", () => {
  const adapted = adaptSkillTreeEvents(retained as unknown as WorldPack);
  const gate = (id: string) => nodes(adapted.events.find(event => event.id === id)?.when);
  assert.deepEqual(gate("legacy-sculpture-prestige"), ["AS9"]);
  assert.deepEqual(gate("legacy-philosophy-prestige"), ["PS9", "PP9"]);
  assert.deepEqual(gate("legacy-commerce-prestige"), ["T9"]);
});
