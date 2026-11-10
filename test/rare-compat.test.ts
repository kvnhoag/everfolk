import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import previous from "../worlds/alexandria-0.22.0.json" with { type: "json" };
import current from "../worlds/alexandria-0.23.0.json" with { type: "json" };

test("0.22 saves retain exact repeat selection and continuation without new rare encounters", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-f922e969306f5d8d");
  let life = engine.start("rare-legacy-life");
  while (life.phase !== "ended" && (life.age < 30 || life.phase === "choice")) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  const restored = loadAnyLife(engine.save(life));
  const retained = engineForLife(restored);
  assert.equal(retained.world.version, "0.22.0");
  assert.deepEqual(restored, life);
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  if (life.phase !== "ended") assert.deepEqual(retained.advance(restored), engine.advance(life));
});

test("0.22 factory content is retained and custom edits are never silently replaced", () => {
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  const draft = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(draft.worlds), true);
  draft.worlds[0].pack.description = "A customized Alexandria.";
  assert.equal(isLegacyFactoryDraft(draft.worlds), false);
});

test("disabling rare encounters leaves ordinary 0.22 life draws unchanged", () => {
  const pack = structuredClone(current) as WorldPack;
  delete pack.eventPacing!.rareEvents;
  const before = createEngine(previous), after = createEngine(pack);
  const comparable = (life: LifeState) => {
    const { worldVersion: _version, worldFingerprint: _fingerprint, ...state } = life;
    return state;
  };
  for (let seed = 0; seed < 24; seed++) {
    let a = before.start(`rare-disabled-${seed}`), b = after.start(`rare-disabled-${seed}`);
    assert.deepEqual(comparable(b), comparable(a));
    for (let command = 0; command < 300 && a.phase !== "ended" && (a.age < 45 || a.phase === "choice"); command++) {
      if (a.phase === "choice") {
        const choice = selectAutomaticChoice(before.getChoices(a), before.world, a)!.id;
        a = before.choose(a, choice); b = after.choose(b, choice);
      } else { a = before.advance(a); b = after.advance(b); }
      assert.deepEqual(comparable(b), comparable(a), `seed ${seed}, command ${command}`);
    }
  }
});
