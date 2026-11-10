import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import retained from "../worlds/alexandria-0.32.0.json" with { type: "json" };

test("0.32.0 lives keep their eight households, accepted avatar and exact replay", () => {
  assert.equal(contentFingerprint(retained), "fnv1a64-a220b3722d84d0b1");
  const original = createEngine(retained);
  let life = original.chooseAvatar(original.start("retained-before-expanded-households"), 2);
  for (let count = 0; count < 32 && life.age < 12 && life.phase !== "ended"; count++) {
    if (life.phase === "ready") life = original.advance(life);
    else {
      const choices = original.getChoices(life);
      const safe = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0];
      life = original.choose(life, safe.id);
    }
  }
  const saved = original.save(life);
  const restored = loadAnyLife(saved);
  const selected = engineForLife(restored);
  assert.equal(selected.world.version, "0.32.0");
  assert.equal(selected.world.origins.length, 8);
  assert.equal(selected.world.origins.some(origin => origin.id === "royal-household"), false);
  assert.equal(restored.character!.avatarVariant, 2);
  assert.deepEqual(restored, life);
  assert.equal(selected.save(restored), saved);
  assert.deepEqual(selected.replay(life.seed, life.commands), original.replay(life.seed, life.commands));
  if (life.phase === "ready") assert.deepEqual(selected.advance(restored), original.advance(life));
});

test("the exact 0.32.0 factory pack remains retrievable without a stored publication", () => {
  const factory = getBuiltinCatalog(retained);
  const oldWorld = factory.worlds[0];
  const revisionId = `pack-${contentFingerprint(oldWorld.pack)}`;
  const archived = getArchivedBuiltinWorld(revisionId);
  assert.ok(archived);
  assert.equal(archived.revisionId, revisionId);
  assert.equal(archived.pack.version, "0.32.0");
  assert.deepEqual(archived.pack, retained);
  assert.equal(isLegacyFactoryDraft(factory.worlds), true);
  const edited = structuredClone(factory.worlds);
  edited[0].pack.origins[0].text += " An edited family memory.";
  assert.equal(isLegacyFactoryDraft(edited), false);
});
