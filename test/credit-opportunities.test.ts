import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { syncEconomyStat } from "../src/economy.ts";
import { contentFingerprint } from "../src/random.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
// Keep this release's complete delta comparison exact; 0.28 tests its skill changes separately.
import input from "../worlds/alexandria-0.27.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.26.0.json" with { type: "json" };

const world = input as WorldPack;
const engine = createEngine(world);
const events = world.events.filter(event => event.id.startsWith("credit-opportunity-"));
const price = (event: LifeEvent) => -(event.choices[1].outcomes[0].effects.find(effect => effect.type === "cash") as { delta: number }).delta;

function opportunity(event: LifeEvent, cash: number): LifeState {
  const life = structuredClone(engine.start("credit-offer-controls"));
  life.age = 18; life.year = -48; life.phase = "choice"; life.pendingEventId = event.id;
  life.nextChoiceAge = 99;
  for (const other of world.events) life.eventCounts[other.id] = other.maxOccurrences ?? 1;
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 30;
  life.stats.health = 80;
  life.economy!.cash = cash; life.economy!.debt = 0; delete life.economy!.loan;
  syncEconomyStat(world, life);
  return life;
}

test("seven optional fictional investments retain original finances, routes, mortality and all source records", () => {
  validateWorld(world);
  assert.equal(world.version, "0.27.0");
  assert.equal(world.events.length, 426);
  assert.equal(events.length, 7);
  assert.deepEqual(events.map(event => event.id.slice("credit-opportunity-".length)), world.legacy!.routes.map(route => route.id));
  for (const key of ["health", "mortality", "economy", "sources", "origins", "yearlyEffects", "yearlyRules", "character", "legacy", "flags"] as const) {
    assert.deepEqual(world[key], previous[key], key);
  }
  assert.deepEqual(world.events.filter(event => !event.id.startsWith("credit-opportunity-")), previous.events);
  for (const event of events) {
    assert.equal(event.maxOccurrences, 1);
    assert.equal(event.evidence, "fictional"); assert.deepEqual(event.sourceIds, []);
    assert.ok(price(event) >= 80 && price(event) <= 100);
    assert.ok(!event.choices[0].when);
    for (const effect of event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))) {
      assert.ok(!["job", "mastery", "accomplishment", "condition", "end"].includes(effect.type));
    }
  }
});

test("direct payment, financed payment and free refusal have distinct truthful ledger consequences", () => {
  for (const event of events) {
    const amount = price(event), rich = opportunity(event, amount), poor = opportunity(event, 10);
    assert.equal(matchesCondition(event.when, rich), true, event.id);
    assert.equal(matchesCondition(event.when, poor), true, event.id);
    assert.deepEqual(engine.getChoices(rich).map(choice => choice.id), [event.choices[0].id, event.choices[1].id]);
    assert.deepEqual(engine.getChoices(poor).map(choice => choice.id), [event.choices[0].id, event.choices[2].id]);
    const paid = engine.choose(rich, event.choices[1].id);
    assert.equal(paid.economy!.cash, 0);
    assert.equal(paid.economy!.debt, 0); assert.equal(paid.economy!.loan, undefined);
    const borrowed = engine.choose(poor, event.choices[2].id);
    assert.equal(borrowed.economy!.cash, 110 - amount);
    assert.equal(borrowed.economy!.debt, 130);
    assert.deepEqual(borrowed.economy!.loan, { balance: 130, borrowedAge: 18, dueAge: 21, extensions: 0 });
    for (const effect of event.choices[1].outcomes[0].effects) if (effect.type === "skill") {
      assert.ok(paid.character!.skills[effect.skill] > rich.character!.skills[effect.skill]);
      assert.equal(borrowed.character!.skills[effect.skill], paid.character!.skills[effect.skill]);
    }
    const declined = engine.choose(poor, event.choices[0].id);
    assert.deepEqual(declined.economy, poor.economy);
    assert.deepEqual(declined.character!.skills, poor.character!.skills);
    assert.equal(selectAutomaticChoice(engine.getChoices(poor), world, poor)!.id, event.choices[0].id);
    assert.equal(poor.economy!.loan, undefined, "Reading or quoting choices cannot create a contract.");
  }
});

test("borrowing does not bypass adulthood, an existing contract or insufficient loan proceeds", () => {
  for (const event of events) {
    const child = opportunity(event, 0); child.age = 17;
    assert.equal(matchesCondition(event.when, child), false);
    assert.ok(!engine.getChoices(child).some(choice => choice.id === event.choices[2].id));
    const active = opportunity(event, 0);
    active.economy!.loan = { balance: 130, borrowedAge: 18, dueAge: 21, extensions: 0 };
    active.economy!.debt = 130;
    assert.ok(!engine.getChoices(active).some(choice => choice.id === event.choices[2].id));
    assert.throws(() => engine.choose(active, event.choices[2].id), /unavailable/);
  }
  const smallLoanWorld = structuredClone(world);
  smallLoanWorld.economy!.moneylender!.principal = 20;
  const smallEngine = createEngine(smallLoanWorld), event = events[0];
  const smallLife = opportunity(event, 0); smallLife.worldFingerprint = smallEngine.fingerprint;
  assert.ok(!smallEngine.getChoices(smallLife).some(choice => choice.id === event.choices[2].id), "The real sequential finance guard rejects credit that cannot cover the fee.");
});

test("every new paid skill opportunity checks the proficiency foundations of all its gains", () => {
  for (const event of events) {
    const life = opportunity(event, 10);
    assert.equal(matchesCondition(event.when, life), true);
    for (const effect of event.choices[1].outcomes[0].effects) if (effect.type === "skill") {
      for (const [id, threshold] of Object.entries(world.character!.skills[effect.skill].prerequisites ?? {})) {
        const missing = structuredClone(life); missing.character!.skills[id] = threshold - 1;
        assert.equal(matchesCondition(event.when, missing), false, `${event.id} must check ${id} for ${effect.skill}`);
      }
    }
    const exhausted = structuredClone(life);
    const mainGain = event.choices[1].outcomes[0].effects.find(effect => effect.type === "skill")!;
    if (mainGain.type === "skill") exhausted.character!.skills[mainGain.skill] = 70;
    assert.equal(matchesCondition(event.when, exhausted), false, "Preparatory investments do not interrupt already advanced practitioners.");
  }
});

test("0.26 lives retain exact interests, choices, loans and command continuation", () => {
  const oldEngine = createEngine(previous);
  assert.equal(oldEngine.fingerprint, "fnv1a64-cbf0a75272e62d6b");
  let life = oldEngine.start("credit-compat-026");
  while (life.phase !== "ended" && (life.age < 25 || life.phase === "choice")) {
    life = life.phase === "choice" ? oldEngine.choose(life, selectAutomaticChoice(oldEngine.getChoices(life), oldEngine.world, life)!.id) : oldEngine.advance(life);
  }
  const loaded = loadAnyLife(oldEngine.save(life)), retained = engineForLife(loaded);
  assert.equal(retained.world.version, "0.26.0");
  assert.deepEqual(loaded, life);
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  assert.ok(!retained.world.events.some(event => event.id.startsWith("credit-opportunity-")));
  if (life.phase !== "ended") assert.deepEqual(retained.advance(loaded), oldEngine.advance(life));
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  const draft = getBuiltinCatalog(previous);
  assert.equal(isLegacyFactoryDraft(draft.worlds), true);
  draft.worlds[0].pack.description = "Retained custom childhood prose.";
  assert.equal(isLegacyFactoryDraft(draft.worlds), false);
});
