import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { getNetWorth, previewEconomyEffects } from "../src/economy.ts";
import type { WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.15.0.json" with { type: "json" };

function fixture(wage = 35, automatic = true): WorldPack {
  return {
    schemaVersion: 1, id: "automatic-debt", version: "1", title: "Debt settlement fixture", description: "Authored annual accounting rules.", startYear: -20, maxAge: 5,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 0 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }],
    yearlyEffects: [{ type: "cash", delta: -20 }], events: [],
    endings: [{ id: "record", title: "Record complete", text: "The record stops.", kind: "chapter" }], defaultEnding: "record",
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored accounting fixture.",
      ...(automatic ? { autoDebtRepayment: true } : {}), assets: [] },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } },
      jobs: [{ id: "worker", title: "Worker", description: "Paid work.", minAge: 0, yearlyEffects: [{ type: "cash", delta: wage }] }],
      partners: [], childNames: ["Child"], deathCauseDescription: "Authored causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [
        { id: "work", text: "Start paid work", category: "career", outcomes: [{ id: "work-result", text: "You start work.", weight: 1, effects: [{ type: "job", job: "worker" }] }] },
        { id: "borrow", text: "Borrow 50 drachmas", category: "finance", outcomes: [{ id: "borrow-result", text: "You receive a loan.", weight: 1, effects: [{ type: "cash", delta: 50 }, { type: "debt", delta: 50 }] }] },
      ] },
  };
}

test("annual surplus makes partial then final repayments after ordinary living costs", () => {
  const engine = createEngine(fixture());
  const owed = engine.advance(engine.start("surplus-repayment"));
  assert.deepEqual(owed.economy, { cash: 0, debt: 20, assets: {} });
  const employed = engine.act(owed, "work"), before = structuredClone(employed);
  const partial = engine.advance(employed);
  assert.deepEqual(partial.economy, { cash: 0, debt: 5, assets: {} });
  assert.equal(getNetWorth(engine.world, partial), -5);
  assert.deepEqual(employed, before, "Settlement only changes the next private snapshot.");
  const repaid = engine.advance(partial);
  assert.deepEqual(repaid.economy, { cash: 10, debt: 0, assets: {} });
  const entries = repaid.journal.filter(entry => entry.id === "auto-debt-payment");
  assert.deepEqual(entries.map(entry => entry.age), [2, 3]);
  assert.match(entries[0].text, /15/);
  assert.match(entries[1].text, /5/);
  assert.equal(repaid.commands.length, 4, "Repayment is not a separate player command or yearly activity.");
  assert.equal(engine.getActivities(repaid).find(activity => activity.id === "borrow")!.available, true);
  assert.deepEqual(engine.replay(repaid.seed, repaid.commands), repaid);
  assert.deepEqual(engine.load(engine.save(repaid)), repaid);
});

test("living expenses have priority over debt and equal wages do not create artificial borrowing", () => {
  const engine = createEngine(fixture(20));
  const owed = engine.advance(engine.start("expense-priority"));
  const next = engine.advance(engine.act(owed, "work"));
  assert.deepEqual(next.economy, { cash: 0, debt: 20, assets: {} });
  assert.equal(next.journal.some(entry => entry.id === "auto-debt-payment"), false);
  assert.deepEqual(engine.load(engine.save(next)), next);
});

test("a decision and its preview cannot trigger annual repayment before time advances", () => {
  const world = fixture();
  world.events = [{ id: "loan-offer", title: "A loan", text: "Borrow for household needs.", trigger: { type: "age", at: 1 },
    choices: [{ id: "accept-loan", text: "Accept the loan", outcomes: [{ id: "loan-received", text: "You receive 50 drachmas and owe another 50.", weight: 1,
      effects: [{ type: "cash", delta: 50 }, { type: "debt", delta: 50 }] }] }] }];
  const engine = createEngine(world), waiting = engine.advance(engine.start("decision-settlement"));
  assert.equal(waiting.phase, "choice");
  const before = structuredClone(waiting);
  const preview = previewEconomyEffects(engine.world, waiting, engine.getChoices(waiting)[0].outcomes[0].effects)!;
  assert.deepEqual(preview, { cash: 50, debt: 70, assets: {} });
  assert.deepEqual(waiting, before);
  assert.throws(() => engine.advance(waiting), /pending choice/);
  const borrowed = engine.choose(waiting, "accept-loan");
  assert.deepEqual(borrowed.economy, preview);
  assert.equal(borrowed.journal.some(entry => entry.id === "auto-debt-payment"), false);
  const settled = engine.advance(borrowed);
  assert.deepEqual(settled.economy, { cash: 0, debt: 40, assets: {} });
  assert.deepEqual(engine.load(engine.save(settled)), settled);
});

test("omitted automatic repayment retains the earlier annual ledger behavior", () => {
  const engine = createEngine(fixture(35, false));
  const next = engine.advance(engine.act(engine.advance(engine.start("legacy-manual-debt")), "work"));
  assert.deepEqual(next.economy, { cash: 15, debt: 20, assets: {} });
  assert.equal(next.journal.some(entry => entry.id === "auto-debt-payment"), false);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});

test("new Alexandria lives enable automatic settlement while the retained 0.15 pack remains manual", () => {
  assert.equal(current.economy.autoDebtRepayment, true);
  assert.equal("autoDebtRepayment" in previous.economy, false);
  const oldEngine = createEngine(previous);
  let oldLife = oldEngine.start("retained-debt-rules");
  while (oldLife.phase !== "ended" && oldLife.age < 18) {
    oldLife = oldLife.phase === "choice" ? oldEngine.choose(oldLife, oldEngine.getChoices(oldLife)[0].id) : oldEngine.advance(oldLife);
  }
  assert.equal(oldLife.journal.some(entry => entry.id === "auto-debt-payment"), false);
  assert.deepEqual(oldEngine.load(oldEngine.save(oldLife)), oldLife);
});
