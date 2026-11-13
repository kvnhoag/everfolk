import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";

// Deliberately untyped fixtures exercise the unknown-data runtime boundary.
function fixture(): any {
  return JSON.parse(readFileSync(new URL("../worlds/sandbox.json", import.meta.url), "utf8"));
}

function rejects(name: string, mutate: (pack: any) => void, expected: RegExp): void {
  test(name, () => {
    const pack = fixture();
    mutate(pack);
    assert.throws(() => validateWorld(pack), expected);
  });
}

test("accepts the sandbox without changing it", () => {
  const pack = fixture();
  const original = structuredClone(pack);
  assert.doesNotThrow(() => validateWorld(pack));
  assert.deepEqual(pack, original);
});

test("permits narrative-only effects and an empty event pool", () => {
  const pack = fixture();
  pack.events = [];
  pack.flags = {};
  pack.yearlyEffects = [];
  pack.origins.forEach((origin: any) => { origin.effects = []; });
  pack.endings.forEach((ending: any) => { delete ending.when; });
  assert.doesNotThrow(() => validateWorld(pack));
});

test("rejects non-object roots with ordinary errors", () => {
  for (const value of [null, [], true, "world", 12, () => ({})]) {
    assert.throws(() => validateWorld(value), /Invalid world at world/);
  }
});

rejects("reports missing required fields", pack => { delete pack.defaultEnding; }, /world\.defaultEnding: required/);
rejects("rejects unsupported schema versions", pack => { pack.schemaVersion = 2; }, /world\.schemaVersion/);
rejects("rejects unrecognized fields", pack => { pack.origins[0].script = "run()"; }, /world\.origins\[0\]\.script: unknown field/);
rejects("requires nonempty stat definitions", pack => { pack.stats = {}; }, /world\.stats/);
rejects("requires stat initial values inside their bounds", pack => { pack.stats.health.initial = 101; }, /world\.stats\.health\.initial: must be within/);
rejects("rejects nonfinite stat values", pack => { pack.stats.health.max = Infinity; }, /world\.stats\.health\.max: expected a finite/);
rejects("rejects nonfinite effect values", pack => { pack.yearlyEffects[0].delta = NaN; }, /world\.yearlyEffects\[0\]\.delta: expected a finite/);

rejects("rejects an unknown stat reference", pack => {
  pack.origins[0].effects[0].stat = "missing";
}, /world\.origins\[0\]\.effects\[0\]\.stat: unknown stat 'missing'/);

rejects("rejects an unknown flag reference", pack => {
  pack.events[0].when = { type: "flag", flag: "missing", value: true };
}, /world\.events\[0\]\.when\.flag: unknown flag/);

rejects("rejects an unknown origin reference", pack => {
  pack.events[0].choices[0].when = { type: "origin", origin: "missing" };
}, /world\.events\[0\]\.choices\[0\]\.when\.origin: unknown origin/);

rejects("rejects an unknown explicit ending reference", pack => {
  pack.yearlyEffects = [{ type: "end", ending: "missing" }];
}, /world\.yearlyEffects\[0\]\.ending: unknown ending/);

rejects("rejects an unknown default ending", pack => { pack.defaultEnding = "missing"; }, /world\.defaultEnding: unknown ending/);
rejects("rejects duplicate origin IDs", pack => { pack.origins[1].id = pack.origins[0].id; }, /world\.origins\[1\]\.id: duplicate ID/);
rejects("rejects duplicate event IDs", pack => { pack.events[1].id = pack.events[0].id; }, /world\.events\[1\]\.id: duplicate ID/);
rejects("rejects duplicate ending IDs", pack => { pack.endings[1].id = pack.endings[0].id; }, /world\.endings\[1\]\.id: duplicate ID/);

rejects("rejects duplicate choice IDs within an event", pack => {
  pack.events[0].choices.push(structuredClone(pack.events[0].choices[0]));
}, /world\.events\[0\]\.choices\[1\]\.id: duplicate ID/);

rejects("rejects duplicate outcome IDs within a choice", pack => {
  pack.events[0].choices[0].outcomes.push(structuredClone(pack.events[0].choices[0].outcomes[0]));
}, /world\.events\[0\]\.choices\[0\]\.outcomes\[1\]\.id: duplicate ID/);

test("choice and outcome IDs may be reused in separate events", () => {
  const pack = fixture();
  pack.events[1].choices[0].id = pack.events[0].choices[0].id;
  pack.events[1].choices[0].outcomes[0].id = pack.events[0].choices[0].outcomes[0].id;
  assert.doesNotThrow(() => validateWorld(pack));
});

rejects("rejects empty choice lists", pack => { pack.events[0].choices = []; }, /world\.events\[0\]\.choices: expected 1/);
rejects("rejects empty outcome lists", pack => { pack.events[0].choices[0].outcomes = []; }, /world\.events\[0\]\.choices\[0\]\.outcomes: expected 1/);
rejects("rejects zero weights", pack => { pack.origins[0].weight = 0; }, /world\.origins\[0\]\.weight: expected a positive/);

rejects("rejects unsafe aggregate weights", pack => {
  pack.origins[0].weight = Number.MAX_SAFE_INTEGER;
  pack.origins[1].weight = 1;
}, /world\.origins: combined weights/);

rejects("rejects nonpositive or oversized maximum ages", pack => { pack.maxAge = 10_001; }, /world\.maxAge/);
rejects("rejects year zero", pack => { pack.startYear = 0; }, /world\.startYear: historical years have no year zero/);

rejects("rejects a calendar that overflows during the life", pack => {
  pack.startYear = Number.MAX_SAFE_INTEGER;
}, /world\.startYear: calendar range/);

rejects("rejects out-of-range scheduled ages", pack => { pack.events[0].trigger.at = pack.maxAge + 1; }, /world\.events\[0\]\.trigger\.at/);

rejects("rejects scheduled years before birth", pack => {
  pack.events[0].trigger = { type: "year", at: pack.startYear - 1 };
}, /world\.events\[0\]\.trigger\.at: scheduled year is outside/);

rejects("requires an explicit annual cooldown for repeated scheduled events", pack => { pack.events[0].maxOccurrences = 2; }, /world\.events\[0\]\.maxOccurrences: repeating scheduled events require an explicit annual cooldownYears/);
rejects("rejects negative cooldowns", pack => { pack.events[0].cooldownYears = -1; }, /world\.events\[0\]\.cooldownYears/);
rejects("rejects unknown condition operators", pack => { pack.events[0].when = { type: "age", op: "execute", value: 1 }; }, /world\.events\[0\]\.when\.op/);
rejects("rejects empty compound conditions", pack => { pack.events[0].when = { type: "all", conditions: [] }; }, /world\.events\[0\]\.when\.conditions: expected 1/);

rejects("rejects deeply nested or cyclic conditions before stack exhaustion", pack => {
  const cycle: any = { type: "not" };
  cycle.condition = cycle;
  pack.events[0].when = cycle;
}, /condition nesting exceeds 32/);

rejects("rejects reserved identifier values", pack => { pack.id = "constructor"; }, /world\.id: expected a non-reserved/);

rejects("rejects prototype-polluting JSON keys", pack => {
  Object.defineProperty(pack.stats, "__proto__", {
    value: { label: "Bad", min: 0, max: 1, initial: 0 }, enumerable: true,
  });
}, /world\.stats\.__proto__: reserved key/);

rejects("rejects objects with custom prototypes", pack => {
  Object.setPrototypeOf(pack.origins[0], { inherited: true });
}, /world\.origins\[0\]: expected a plain JSON object/);

test("rejects accessors without executing them", () => {
  const pack = fixture();
  let executed = false;
  Object.defineProperty(pack, "title", { enumerable: true, get() { executed = true; return "Unexpected"; } });
  assert.throws(() => validateWorld(pack), /world\.title: expected an enumerable data property/);
  assert.equal(executed, false);
});

rejects("rejects executable values", pack => { pack.events[0].choices[0].text = () => "run"; }, /world\.events\[0\]\.choices\[0\]\.text: expected a nonempty string/);
rejects("rejects sparse arrays", pack => { delete pack.origins[0]; }, /world\.origins: sparse arrays/);
rejects("rejects extra array properties", pack => { pack.origins.script = () => {}; }, /world\.origins: sparse arrays and extra array properties/);
