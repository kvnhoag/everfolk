import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";

// Admin imports are untrusted JSON. Reject rules that could bypass causal death
// or leave a sick player with no usable decision.
function fixture(): any {
  return JSON.parse(readFileSync(new URL("../worlds/alexandria-sample.json", import.meta.url), "utf8"));
}

test("current causal world validates without rewriting its authored rules", () => {
  const pack = fixture(), before = structuredClone(pack);
  assert.ok(pack.health && pack.relationships);
  validateWorld(pack);
  assert.deepEqual(pack, before);
});

test("health worlds cannot silently assign death at a stat threshold or the age cap", () => {
  const conditional = fixture();
  conditional.endings.find((ending: any) => ending.kind === "death").when = { type: "stat", stat: "health", op: "lte", value: 20 };
  assert.throws(() => validateWorld(conditional), /health-driven deaths must come from a recorded condition/);
  const capped = fixture();
  capped.defaultEnding = capped.endings.find((ending: any) => ending.kind === "death").id;
  assert.throws(() => validateWorld(capped), /non-death administrative cap/);
  const effect = fixture();
  effect.yearlyEffects.push({ type: "end", ending: effect.endings.find((ending: any) => ending.kind === "death").id });
  assert.throws(() => validateWorld(effect), /deathCause/);
});

test("a medical interrupt must refer to a real decision with an unconditional option", () => {
  const missing = fixture();
  missing.health.careDecision = "missing";
  assert.throws(() => validateWorld(missing), /careDecision.*unknown event/);
  const locked = fixture();
  const event = locked.events.find((event: any) => event.id === locked.health.careDecision);
  event.choices.forEach((choice: any) => { choice.when = { type: "cash", op: "gte", value: 100 }; });
  assert.throws(() => validateWorld(locked), /unconditional option/);
});

test("health rules require complete age coverage and bounded probabilities", () => {
  const gap = fixture();
  gap.health.incidenceBands[1].minAge++;
  assert.throws(() => validateWorld(gap), /ordered and contiguous/);
  const short = fixture();
  short.health.declineBands.at(-1).maxAge--;
  assert.throws(() => validateWorld(short), /cover every age/);
  for (const invalid of [-0.1, 1.1, Infinity]) {
    const pack = fixture();
    pack.health.conditions[0].recoveryChance = invalid;
    assert.throws(() => validateWorld(pack), /recoveryChance/);
  }
});

test("condition and fatal-cause references must resolve to authored definitions", () => {
  const cause = fixture();
  cause.health.conditions[0].deathCause = "missing";
  assert.throws(() => validateWorld(cause), /deathCause.*unknown death cause/);
  const condition = fixture();
  condition.yearlyEffects.push({ type: "condition", condition: "missing" });
  assert.throws(() => validateWorld(condition), /unknown health condition/);
  const decline = fixture();
  decline.health.declineCondition = decline.health.conditions.find((condition: any) => condition.kind === "illness").id;
  assert.throws(() => validateWorld(decline), /explicit-only frailty/);
});

test("care and interpersonal rules reject out-of-range or unknown targets", () => {
  const care = fixture();
  care.yearlyEffects.push({ type: "care", amount: 1.1 });
  assert.throws(() => validateWorld(care), /amount/);
  const person = fixture();
  person.events[0].when = { type: "closeness", partner: "missing", op: "gte", value: 50 };
  assert.throws(() => validateWorld(person), /unknown partner/);
  const support = fixture();
  support.relationships.maxHealthSupport = 2;
  assert.throws(() => validateWorld(support), /maxHealthSupport/);
  const closeness = fixture();
  closeness.yearlyEffects.push({ type: "closeness", target: "children", delta: 101 });
  assert.throws(() => validateWorld(closeness), /delta/);
});
