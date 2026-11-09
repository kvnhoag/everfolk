import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import type { LifeState } from "../src/types.ts";
import previous from "../worlds/alexandria-0.19.0.json" with { type: "json" };
import current from "../worlds/alexandria-sample.json" with { type: "json" };

test("childhood through age seventeen keeps the exact 0.19 health behavior and random sequence", () => {
  const before = createEngine(previous), after = createEngine(current);
  assert.equal(after.world.health!.mortalityCalibration!.minAge, 18);
  const comparable = (life: LifeState) => {
    const { worldVersion: _version, worldFingerprint: _fingerprint, ...state } = life;
    return state;
  };
  for (let index = 0; index < 24; index++) {
    const seed = `protected-childhood-parity-${index}`;
    let a = before.start(seed), b = after.start(seed);
    assert.deepEqual(comparable(b), comparable(a), `${seed}: birth`);
    for (let command = 0; command < 200 && a.phase !== "ended" && (a.age < 17 || a.phase === "choice"); command++) {
      if (a.phase === "choice") {
        const choice = selectAutomaticChoice(before.getChoices(a), before.world, a)!.id;
        assert.ok(after.getChoices(b).some(item => item.id === choice));
        a = before.choose(a, choice);
        b = after.choose(b, choice);
      } else {
        a = before.advance(a);
        b = after.advance(b);
      }
      assert.deepEqual(comparable(b), comparable(a), `${seed}: command ${command}`);
    }
    assert.ok(a.phase === "ended" || a.age === 17, `${seed}: completed childhood`);
  }
});

test("0.19 adult lives keep their original health rules and exact continuation", () => {
  assert.equal(contentFingerprint(previous), "fnv1a64-324768c5819cb8c3");
  assert.equal("mortalityCalibration" in previous.health, false);
  const engine = createEngine(previous);
  let life = engine.start("adult-mortality-legacy-0.19");
  while (life.age < 30 && life.phase !== "ended") {
    life = life.phase === "choice" ? engine.choose(life,
      selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  }
  assert.equal(life.age, 30);
  const restored = loadAnyLife(engine.save(life));
  assert.deepEqual(restored, life);
  const retainedEngine = engineForLife(restored);
  assert.equal(retainedEngine.world.version, "0.19.0");
  assert.equal(retainedEngine.fingerprint, engine.fingerprint);
  const next = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  assert.deepEqual(retainedEngine.replay(life.seed, next.commands), next);
});

test("0.19 factory revisions remain readable and only untouched drafts can upgrade", () => {
  const fingerprint = contentFingerprint(previous);
  const retained = getArchivedBuiltinWorld(`pack-${fingerprint}`)!;
  assert.ok(retained);
  assert.equal(retained.pack.version, "0.19.0");
  assert.deepEqual(retained.pack, previous);
  assert.equal(retained.routes.length, 7);
  const draft = getBuiltinCatalog(previous).worlds;
  assert.equal(isLegacyFactoryDraft(draft), true);
  draft[0].pack.description = "A custom world description.";
  assert.equal(isLegacyFactoryDraft(draft), false);
});
