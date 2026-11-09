import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import previous from "../worlds/alexandria-0.21.0.json" with { type: "json" };

test("0.21 loan saves keep their original event draws, contract and replay", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-5801ac0775439863");
  assert.equal("variety" in engine.world.eventPacing!, false);
  let adult;
  for (let seed = 0; seed < 40 && !adult; seed++) {
    let life = engine.start(`variety-legacy-${seed}`);
    while (life.phase !== "ended" && (life.age < 18 || life.phase === "choice")) {
      life = life.phase === "choice" ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
    }
    if (life.age === 18 && life.phase === "ready") adult = engine.act(life, "borrow-moneylender");
  }
  assert.ok(adult);
  assert.equal(adult.economy!.loan!.balance, 130);
  const restored = loadAnyLife(engine.save(adult));
  assert.deepEqual(restored, adult);
  const retained = engineForLife(restored);
  assert.equal(retained.world.version, "0.21.0");
  assert.deepEqual(retained.advance(restored), engine.advance(adult));
  assert.deepEqual(retained.replay(restored.seed, restored.commands), adult);
});

test("0.21 factory pack remains available without overwriting custom edits", () => {
  const retained = getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!;
  assert.deepEqual(retained.pack, previous);
  const catalog = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(catalog.worlds), true);
  catalog.worlds[0].pack.description = "An edited playtest world.";
  assert.equal(isLegacyFactoryDraft(catalog.worlds), false);
});
