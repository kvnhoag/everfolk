import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import previous from "../worlds/alexandria-0.23.0.json" with { type: "json" };
// Keep this release-specific whole-pack comparison exact; 0.25 has its own legacy tests.
import current from "../worlds/alexandria-0.24.0.json" with { type: "json" };

test("0.23 lives retain their original opening sequence, rare events and exact continuation", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-12445860dedbe9e8");
  let life = engine.start("mastery-legacy-play");
  while (life.phase !== "ended" && (life.age < 30 || life.phase === "choice")) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  const loaded = loadAnyLife(engine.save(life));
  const retained = engineForLife(loaded);
  assert.equal(retained.world.version, "0.23.0");
  assert.deepEqual(loaded, life);
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  if (life.phase !== "ended") assert.deepEqual(retained.advance(loaded), engine.advance(life));
});

test("0.23 factory content is retained without replacing custom edits", () => {
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  const draft = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(draft.worlds), true);
  draft.worlds[0].pack.description = "Custom Alexandria playtest.";
  assert.equal(isLegacyFactoryDraft(draft.worlds), false);
});

test("mastery and opening variants preserve ordinary growth, health, economy and existing story outcomes", () => {
  assert.equal(current.version, "0.24.0");
  for (const field of ["stats", "health", "mortality", "economy", "character", "origins", "sources", "yearlyEffects", "yearlyRules"] as const) {
    assert.deepEqual(current[field], previous[field], `Unexpected change to ${field}`);
  }
  const beforeIds = new Set(previous.events.map(event => event.id));
  const retained = current.events.filter(event => beforeIds.has(event.id)).map(event => {
    const { exclusiveGroup: _group, ...original } = event as typeof event & { exclusiveGroup?: string };
    return original;
  });
  assert.deepEqual(retained, previous.events, "Existing event outcomes and dated history remain exact.");
});
