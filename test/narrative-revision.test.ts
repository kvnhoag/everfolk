import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import previous from "../worlds/alexandria-0.30.0.json" with { type: "json" };
import current from "../worlds/alexandria-sample.json" with { type: "json" };

// These are the only authored copy fields this release is permitted to change.
// Conditions, IDs, references, weights and effects are compared in full.
function rules(pack: WorldPack) {
  const copy = structuredClone(pack);
  copy.version = "comparison";
  for (const event of copy.events) {
    event.title = ""; event.text = "";
    for (const choice of event.choices) {
      choice.text = "";
      for (const outcome of choice.outcomes) outcome.text = "";
    }
  }
  for (const activity of copy.character?.activities ?? []) {
    activity.text = "";
    for (const outcome of activity.outcomes) outcome.text = "";
  }
  for (const route of copy.legacy?.routes ?? []) route.description = "";
  for (const achievement of copy.legacy?.achievements ?? []) {
    achievement.title = ""; achievement.description = ""; achievement.nameTemplate = "";
  }
  return copy;
}

function observedRules(life: LifeState) {
  const copy = structuredClone(life);
  copy.worldVersion = "comparison"; copy.worldFingerprint = "comparison";
  for (const entry of copy.journal) entry.text = "";
  for (const record of copy.accomplishments ?? []) {
    record.title = ""; record.name = ""; record.description = "";
  }
  if (copy.deathCauseContext) copy.deathCauseContext = "comparison";
  return copy;
}

test("the literary edit changes copy while preserving every game rule and evidence label", () => {
  validateWorld(current);
  assert.equal(current.version, "0.31.0");
  assert.deepEqual(rules(current as WorldPack), rules(previous as WorldPack));
  const rewritten = current.events.filter(event => event.text !== previous.events.find(old => old.id === event.id)!.text);
  assert.ok(rewritten.length >= 120, `${rewritten.length} rewritten scenes`);
  assert.notEqual(current.events.find(event => event.id === "early-care-visitors")!.text,
    previous.events.find(event => event.id === "early-care-visitors")!.text);
});

test("prose revisions preserve choices, skill growth, event pacing and RNG through ordinary lives", () => {
  const before = createEngine(previous), after = createEngine(current);
  for (let seed = 0; seed < 12; seed++) {
    let a = before.start(`prose-parity-${seed}`), b = after.start(`prose-parity-${seed}`);
    for (let command = 0; command < 400 && a.phase !== "ended" && a.age < 40; command++) {
      assert.deepEqual(observedRules(b), observedRules(a), `seed ${seed}, command ${command}`);
      if (a.phase === "choice") {
        const choice = selectAutomaticChoice(before.getChoices(a), before.world, a)!;
        assert.ok(after.getChoices(b).some(item => item.id === choice.id));
        a = before.choose(a, choice.id); b = after.choose(b, choice.id);
      } else { a = before.advance(a); b = after.advance(b); }
    }
    assert.deepEqual(observedRules(b), observedRules(a));
    assert.deepEqual(after.load(after.save(b)), b);
  }
});

test("the original 0.30 world remains available for exact saved-life replay and customized drafts", () => {
  assert.equal(contentFingerprint(previous), "fnv1a64-02a80e9e282a6757");
  const engine = createEngine(previous);
  let life = engine.start("prose-retained-save");
  while (life.phase !== "ended" && life.age < 18) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id)
    : engine.advance(life);
  const restored = loadAnyLife(engine.save(life));
  assert.deepEqual(restored, life);
  assert.equal(engineForLife(restored).world.version, "0.30.0");
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, previous);
  const catalog = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(catalog.worlds), true);
  catalog.worlds[0].pack.events[0].text = "A player's own scene.";
  assert.equal(isLegacyFactoryDraft(catalog.worlds), false);
});
