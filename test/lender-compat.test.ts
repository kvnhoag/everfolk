import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import previous from "../worlds/alexandria-0.20.0.json" with { type: "json" };
import current from "../worlds/alexandria-0.21.0.json" with { type: "json" };

test("0.20 adult lives load and continue without loan liabilities or collection rules", () => {
  assert.equal(contentFingerprint(previous), "fnv1a64-fa27733d19e4c207");
  assert.equal("moneylender" in previous.economy, false);
  const engine = createEngine(previous);
  let adult: LifeState | undefined;
  for (let seed = 0; seed < 32 && !adult; seed++) {
    let life = engine.start(`lender-legacy-${seed}`);
    while (life.phase !== "ended" && (life.age < 24 || life.phase === "choice")) life = life.phase === "choice"
      ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
    if (life.age === 24 && life.phase === "ready") adult = life;
  }
  assert.ok(adult, "The original rules can produce a living adult save.");
  assert.equal("loan" in adult.economy!, false);
  const restored = loadAnyLife(engine.save(adult));
  assert.deepEqual(restored, adult);
  const retained = engineForLife(restored);
  assert.equal(retained.world.version, "0.20.0");
  assert.deepEqual(retained.advance(restored), engine.advance(adult));
  assert.deepEqual(retained.load(retained.save(restored)), restored);
});

test("0.20 factory packs remain available, while edited worlds are never silently replaced", () => {
  const fingerprint = contentFingerprint(previous);
  const retained = getArchivedBuiltinWorld(`pack-${fingerprint}`)!;
  assert.ok(retained);
  assert.deepEqual(retained.pack, previous);
  const catalog = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(catalog.worlds), true);
  catalog.worlds[0].pack.description = "A player's custom world description.";
  assert.equal(isLegacyFactoryDraft(catalog.worlds), false);
});

test("without accepting a loan, existing ordinary-life rules retain exact command and RNG behavior", () => {
  const pack = structuredClone(current) as WorldPack;
  // The new offer legitimately adds narrative/RNG variety. Exclude only it to
  // isolate the optional contract engine; keep its configured collection events.
  pack.events = pack.events.filter(event => event.id !== "lender-offer");
  const before = createEngine(previous), after = createEngine(pack);
  const comparable = (life: LifeState) => {
    const { worldVersion: _version, worldFingerprint: _fingerprint, ...state } = life;
    return state;
  };
  for (let index = 0; index < 24; index++) {
    const seed = `no-accepted-loan-parity-${index}`;
    let a = before.start(seed), b = after.start(seed);
    assert.deepEqual(comparable(b), comparable(a), `${seed}: birth`);
    for (let command = 0; command < 250 && a.phase !== "ended" && (a.age < 40 || a.phase === "choice"); command++) {
      if (a.phase === "choice") {
        const id = selectAutomaticChoice(before.getChoices(a), before.world, a)!.id;
        assert.ok(after.getChoices(b).some(choice => choice.id === id));
        a = before.choose(a, id); b = after.choose(b, id);
      } else { a = before.advance(a); b = after.advance(b); }
      assert.deepEqual(comparable(b), comparable(a), `${seed}: command ${command}`);
      assert.equal(b.economy!.loan, undefined);
    }
    assert.ok(a.phase === "ended" || a.age === 40);
  }
});
