import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
// This checks the copy-only 0.17 release against its preceding rules.
import current from "../worlds/alexandria-0.17.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.16.0.json" with { type: "json" };

const changedActions = ["train-craft", "train-pottery", "train-carving", "train-sculpture", "take-small-repair-jobs", "pottery-order"];

test("specific craft wording preserves every rule, reference and unrelated piece of content", () => {
  const restored = structuredClone(current) as WorldPack;
  const old = previous as WorldPack;
  restored.version = old.version;
  for (const id of ["craft", "carving"]) {
    restored.character!.skills[id].label = old.character!.skills[id].label;
    restored.character!.skills[id].description = old.character!.skills[id].description;
  }
  for (const id of changedActions) {
    const action = restored.character!.activities.find(activity => activity.id === id)!;
    const before = old.character!.activities.find(activity => activity.id === id)!;
    action.text = before.text;
    action.outcomes.forEach((outcome, index) => { outcome.text = before.outcomes[index].text; });
  }
  restored.economy!.assets.find(asset => asset.id === "tool-chest")!.description = old.economy!.assets.find(asset => asset.id === "tool-chest")!.description;
  assert.deepEqual(restored, old);
  assert.doesNotThrow(() => createEngine(current));
  for (const id of ["craft", "pottery", "carving", "sculpture"]) {
    const skill = current.character.skills[id as keyof typeof current.character.skills];
    const action = current.character.activities.find(activity => activity.id === skill.trainingActivity)!;
    assert.ok(action.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "skill" && effect.skill === id && effect.delta > 0)));
  }
});

function simulation(state: LifeState) {
  const { worldVersion: _version, worldFingerprint: _fingerprint, journal: _journal, ...value } = state;
  return value;
}

test("accepted craft practice keeps the same costs, progression and RNG as retained 0.16", () => {
  const after = createEngine(current), before = createEngine(previous);
  const practised = new Set<string>();
  for (let seed = 0; seed < 8; seed++) {
    let a = after.start(`specific-craft-parity-${seed}`), b = before.start(`specific-craft-parity-${seed}`);
    while (a.phase !== "ended" && a.age < 20) {
      assert.deepEqual(simulation(a), simulation(b));
      if (a.phase === "choice") {
        const choice = after.getChoices(a).find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end")))!;
        a = after.choose(a, choice.id); b = before.choose(b, choice.id);
      } else {
        const activities = after.getActivities(a);
        const action = activities.find(activity => activity.id === "train-craft" && activity.available && a.character!.skills.craft < 15)
          ?? activities.find(activity => changedActions.slice(1, 4).includes(activity.id) && activity.available && !practised.has(activity.id));
        if (action) {
          practised.add(action.id);
          a = after.act(a, action.id); b = before.act(b, action.id);
        } else { a = after.advance(a); b = before.advance(b); }
      }
    }
    assert.deepEqual(simulation(a), simulation(b));
    assert.deepEqual(after.load(after.save(a)), a);
    assert.deepEqual(before.load(before.save(b)), b);
  }
  assert.ok(practised.has("train-craft"), "The parity path must perform actual foundational practice.");
  assert.ok(practised.has("train-pottery") || practised.has("train-carving"), "The parity path must perform a specialised activity too.");
});
