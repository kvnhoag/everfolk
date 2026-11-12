import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import previous from "../worlds/alexandria-0.25.0.json" with { type: "json" };

test("0.25 lives retain their exact pre-influence childhood, lessons, accomplishments and replay", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-9af9f93f5ae09cd2");
  let life = engine.start("childhood-legacy-continuation");
  while (life.phase !== "ended" && (life.age < 25 || life.phase === "choice")) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  const loaded = loadAnyLife(engine.save(life));
  const retained = engineForLife(loaded);
  assert.equal(retained.world.version, "0.25.0");
  assert.deepEqual(loaded, life);
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  assert.equal(Object.keys(life.flags).some(flag => flag.startsWith("early-interest-")), false);
  if (life.phase !== "ended") assert.deepEqual(retained.advance(loaded), engine.advance(life));
});

test("0.25 factory revisions remain archived and edited admin drafts are preserved", () => {
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  const draft = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(draft.worlds), true);
  draft.worlds[0].pack.description = "A custom playtest with its own prose.";
  assert.equal(isLegacyFactoryDraft(draft.worlds), false);
});
