import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEngine, demoWorld } from "./fixtures/demo/world.ts";
import { demoContext } from "../src/demo/state.ts";
import { changeReputation } from "../src/demo/works.ts";
import {
  applyConvoy, assignConvoy, convoyPreview, payWages, serviceView, servingThisYear, startContractShipment, wageFor,
} from "../src/demo/service.ts";
import { CONVOY_MUSTER_EVENT_ID, CONVOY_ROAD_EVENT_ID } from "../src/demo/content/service.ts";
import { CONVOY_DISTINCTION } from "../src/demo/types.ts";
import type { DemoContext, DemoState, Shipment } from "../src/demo/types.ts";
import type { Effect, LifeState } from "../src/types.ts";

type DemoLife = LifeState & { demo: DemoState };
const world = demoWorld();
const def = world.demo!;
const engine = demoEngine();
const canonical = (value: unknown) => JSON.stringify(value);

/** A mutable adult life (never passed back through `start`), seeded per test. */
function adult(seed: string, patch: (life: DemoLife) => void = () => {}): DemoLife {
  const life = structuredClone(engine.start(seed)) as DemoLife;
  life.age = 25;
  life.year = world.startYear + 25;
  life.character!.jobId = "soldier";
  life.character!.skills.warfare = 20;
  life.stats.health = 70;
  life.economy!.cash = 0;
  life.demo.reputation = 50;
  patch(life);
  return life;
}

/** Module-level context: cash and stats through a minimal stand-in for the engine's `apply`. */
function context(life: DemoLife): DemoContext {
  const apply = (effects: readonly Effect[]) => {
    for (const effect of effects) {
      if (effect.type === "cash") life.economy!.cash = Math.max(0, life.economy!.cash + effect.delta);
      else if (effect.type === "stat") life.stats[effect.stat] = Math.max(0, life.stats[effect.stat] + effect.delta);
      else throw new Error(`unexpected effect ${effect.type}`);
    }
  };
  const journal = (id: string, text: string) => { life.journal.push({ type: "event", id, text, age: life.age, year: life.year }); };
  return demoContext(world, life, apply, journal);
}

/** True once track E's `changeReputation` is merged; reputation assertions stay strict from then on. */
function reputationIsLive(): boolean {
  const probe = adult("reputation-probe");
  changeReputation(context(probe), -1, "probe");
  return probe.demo.reputation !== 50;
}

function shipment(patch: Partial<Shipment> = {}): Shipment {
  return { kind: "contract", cargo: 1000, pay: 2, stage: "road", provisions: false, companions: 0, riskCutBps: 0, ...patch };
}

function totalGrain(demo: DemoState): number {
  const t = demo.town;
  return demo.household.grain + t.grower.grain + t.merchant.grain + t.army.grain + (demo.shipment?.cargo ?? 0);
}

const journalIds = (life: LifeState) => life.journal.map(entry => entry.id);

// ── Wages and rations ─────────────────────────────────────────────────────────

test("a soldier's wage comes out of the army purse into player cash", () => {
  const life = adult("wage-full");
  const purse = life.demo.town.army.purse;
  payWages(context(life));
  assert.equal(life.economy!.cash, def.service.wage.quiet);
  assert.equal(life.demo.town.army.purse, purse - def.service.wage.quiet);
  assert.ok(journalIds(life).includes("army-wages"));
});

test("wages follow the army level and an in-limit wage premium", () => {
  assert.equal(wageFor(def, "war", null), def.service.wage.war);
  assert.equal(wageFor(def, "recruiting", { kind: "wage", premiumBps: 5000 }), Math.floor(def.service.wage.recruiting * 1.5));
  assert.equal(wageFor(def, "quiet", { kind: "wage", premiumBps: 999_999 }), Math.floor(def.service.wage.quiet * (10_000 + def.agents.maxWagePremiumBps) / 10_000));
  assert.equal(wageFor(def, "quiet", { kind: "release", shareBps: 5000 }), def.service.wage.quiet);
});

test("a short purse pays part of the wage, journals the shortfall and costs reputation", () => {
  const life = adult("wage-short", l => { l.demo.town.army.purse = 50; });
  payWages(context(life));
  assert.equal(life.economy!.cash, 50);
  assert.equal(life.demo.town.army.purse, 0);
  assert.ok(life.journal.some(entry => entry.id === "army-wage-shortfall" && entry.text.includes(String(def.service.wage.quiet - 50))));
  if (reputationIsLive()) assert.equal(life.demo.reputation, 49);
  else assert.ok(life.demo.reputation <= 50);
});

test("a soldier eats army rations, not household grain; short rations cost health", () => {
  const life = adult("rations");
  const armyGrain = life.demo.town.army.grain, household = life.demo.household.grain;
  assert.equal(servingThisYear(life), true);
  payWages(context(life));
  assert.equal(life.demo.town.army.grain, armyGrain - def.service.ration);
  assert.equal(life.demo.household.grain, household);
  assert.equal(life.stats.health, 70);

  const hungry = adult("rations-short", l => { l.demo.town.army.grain = 40; });
  payWages(context(hungry));
  assert.equal(hungry.demo.town.army.grain, 0);
  assert.ok(hungry.stats.health < 70);
  assert.ok(journalIds(hungry).includes("army-ration-shortfall"));
});

test("a farmer is not serving and draws nothing from the army", () => {
  const life = adult("farmer", l => { l.character!.jobId = "tenant-farmer"; });
  const before = canonical(life);
  assert.equal(servingThisYear(life), false);
  payWages(context(life));
  assignConvoy(context(life));
  assert.equal(canonical(life), before);
});

test("no double pay on retry: wages once a year, a resolved convoy pays once", () => {
  const life = adult("retry");
  const ctx = context(life);
  payWages(ctx);
  payWages(ctx);
  assert.equal(life.economy!.cash, def.service.wage.quiet);

  const dealer = adult("retry-contract", l => { l.character!.jobId = "grain-dealer"; l.demo.shipment = shipment(); });
  const dctx = context(dealer);
  applyConvoy(dctx, { kind: "convoy", action: "resolve", lossBps: 0 });
  const after = canonical(dealer);
  applyConvoy(dctx, { kind: "convoy", action: "resolve", lossBps: 0 });
  applyConvoy(dctx, { kind: "convoy", action: "withdraw" });
  assert.equal(canonical(dealer), after);
  assert.equal(dealer.economy!.cash, 2000);
});

// ── Escort assignment ────────────────────────────────────────────────────────

test("an escort is assigned at most every escortCooldownYears and its cargo is real army grain", () => {
  const life = adult("escort-cooldown");
  const ages: number[] = [];
  for (let age = 20; age <= 60; age++) {
    life.age = age;
    const armyBefore = life.demo.town.army.grain;
    assignConvoy(context(life));
    if (life.demo.shipment) {
      ages.push(age);
      assert.equal(life.demo.shipment.kind, "escort");
      assert.equal(life.demo.shipment.stage, "muster");
      assert.equal(life.demo.shipment.cargo, Math.min(def.service.escortCargo, armyBefore));
      assert.equal(life.demo.town.army.grain, armyBefore - life.demo.shipment.cargo);
      applyConvoy(context(life), { kind: "convoy", action: "resolve", lossBps: 0 });
      life.demo.town.army.grain = 5000;
    }
  }
  assert.ok(ages.length >= 3, `expected several escorts, got ${ages.join(",")}`);
  for (let i = 1; i < ages.length; i++) assert.ok(ages[i] - ages[i - 1] >= def.service.escortCooldownYears);
});

test("no escort while a shipment is pending", () => {
  const life = adult("escort-pending", l => { l.demo.shipment = shipment({ kind: "escort", stage: "muster" }); });
  const before = canonical(life);
  assignConvoy(context(life));
  assert.equal(canonical(life), before);
});

test("escorts are more likely in recruitment years and on a dangerous road", () => {
  const count = (army: DemoState["year"]["army"], road: DemoState["year"]["road"]) => {
    let assigned = 0;
    for (let i = 0; i < 300; i++) {
      const life = adult(`escort-odds-${i}`, l => { l.demo.year = { ...l.demo.year, army, road }; });
      assignConvoy(context(life));
      if (life.demo.shipment) assigned++;
    }
    return assigned;
  };
  const quiet = count("quiet", "safe"), pressed = count("war", "dangerous");
  assert.ok(pressed > quiet + 30, `quiet ${quiet}, pressed ${pressed}`);
});

// ── Contract sales ───────────────────────────────────────────────────────────

test("a contract sale on a safe road settles directly", () => {
  const life = adult("contract-safe", l => { l.character!.jobId = "grain-dealer"; l.demo.household.grain = 900; });
  const t = life.demo.town, purse = t.army.purse, armyGrain = t.army.grain, total = totalGrain(life.demo);
  const sold = startContractShipment(context(life), 500, 2);
  assert.equal(sold, 500);
  assert.equal(life.demo.shipment, null);
  assert.equal(life.demo.household.grain, 400);
  assert.equal(t.army.grain, armyGrain + 500);
  assert.equal(t.army.purse, purse - 1000);
  assert.equal(life.economy!.cash, 1000);
  assert.equal(totalGrain(life.demo), total);
});

test("a safe-road sale is limited by what the army purse can pay", () => {
  const life = adult("contract-purse", l => { l.demo.household.grain = 900; l.demo.town.army.purse = 301; });
  const sold = startContractShipment(context(life), 500, 2);
  assert.equal(sold, 150);
  assert.equal(life.economy!.cash, 300);
  assert.equal(life.demo.town.army.purse, 1);
  assert.equal(life.demo.household.grain, 750);
  assert.ok(journalIds(life).includes("army-sale-partial"));
});

test("an invalid contract changes nothing", () => {
  const life = adult("contract-invalid", l => { l.demo.household.grain = 100; });
  const before = canonical(life);
  assert.throws(() => startContractShipment(context(life), 500, 2), /grain/);
  assert.throws(() => startContractShipment(context(life), 0, 2), /quantity/);
  assert.throws(() => startContractShipment(context(life), 50, 1.5), /price/);
  life.demo.shipment = shipment();
  const pending = canonical(life);
  assert.throws(() => startContractShipment(context(life), 50, 2), /convoy/);
  assert.equal(canonical(life), pending);
  life.demo.shipment = null;
  assert.equal(canonical(life), before);
});

test("on an unsafe road the contract grain leaves home in a shipment and is paid on delivery", () => {
  const life = adult("contract-road", l => { l.character!.jobId = "grain-dealer"; l.demo.household.grain = 900; l.demo.year = { ...l.demo.year, road: "uneasy" }; });
  const t = life.demo.town, purse = t.army.purse, armyGrain = t.army.grain, total = totalGrain(life.demo);
  startContractShipment(context(life), 500, 2);
  assert.deepEqual(life.demo.shipment, shipment({ cargo: 500, stage: "muster" }));
  assert.equal(life.demo.household.grain, 400);
  assert.equal(t.army.grain, armyGrain);
  assert.equal(life.economy!.cash, 0);
  assert.equal(totalGrain(life.demo), total);

  applyConvoy(context(life), { kind: "convoy", action: "depart" });
  assert.equal(life.demo.shipment!.stage, "road");
  applyConvoy(context(life), { kind: "convoy", action: "resolve", lossBps: 2000 });
  assert.equal(life.demo.shipment, null);
  assert.equal(t.army.grain, armyGrain + 400);
  assert.equal(life.economy!.cash, 800);
  assert.equal(t.army.purse, purse - 800);
  assert.equal(life.demo.lastEscortAge, life.age);
  // The lost grain leaves the economy; nothing else moves.
  assert.equal(totalGrain(life.demo), total - 100);
  assert.ok(life.journal.some(entry => entry.id === "convoy-loss" && entry.text.includes("100")));
});

test("a short purse pays part of a delivered contract and journals the rest", () => {
  const life = adult("contract-short-pay", l => { l.demo.shipment = shipment(); l.demo.town.army.purse = 500; });
  applyConvoy(context(life), { kind: "convoy", action: "resolve", lossBps: 0 });
  assert.equal(life.economy!.cash, 500);
  assert.equal(life.demo.town.army.purse, 0);
  assert.ok(journalIds(life).includes("convoy-pay-shortfall"));
});

// ── Convoy effects ───────────────────────────────────────────────────────────

test("provisions and companions update the shipment; depart moves it onto the road", () => {
  const life = adult("convoy-prepare", l => { l.demo.shipment = shipment({ stage: "muster" }); });
  const ctx = context(life);
  applyConvoy(ctx, { kind: "convoy", action: "provision" });
  applyConvoy(ctx, { kind: "convoy", action: "companion" });
  applyConvoy(ctx, { kind: "convoy", action: "depart" });
  assert.deepEqual(life.demo.shipment, shipment({ provisions: true, companions: 1, stage: "road" }));
});

test("a deed's riskCutBps lowers the loss, never below zero", () => {
  const cut = adult("risk-cut", l => { l.demo.shipment = shipment({ riskCutBps: 1500 }); });
  const armyGrain = cut.demo.town.army.grain;
  applyConvoy(context(cut), { kind: "convoy", action: "resolve", lossBps: 2000 });
  assert.equal(cut.demo.town.army.grain, armyGrain + 950);

  const effectCut = adult("risk-cut-effect", l => { l.demo.shipment = shipment(); });
  applyConvoy(context(effectCut), { kind: "convoy", action: "provision", riskCutBps: 9000 });
  applyConvoy(context(effectCut), { kind: "convoy", action: "resolve", lossBps: 2000 });
  assert.equal(effectCut.demo.town.army.grain, armyGrain + 1000);
});

test("a resolve without lossBps uses the road's base loss for the year", () => {
  const life = adult("base-loss", l => { l.demo.shipment = shipment(); l.demo.year = { ...l.demo.year, road: "dangerous" }; });
  const armyGrain = life.demo.town.army.grain;
  applyConvoy(context(life), { kind: "convoy", action: "resolve" });
  assert.equal(life.demo.town.army.grain, armyGrain + 1000 - def.service.roadLossBps.dangerous / 10);
});

test("withdrawing keeps contract grain home, returns escort grain to the army and lowers reputation", () => {
  const live = reputationIsLive();
  const dealer = adult("withdraw-contract", l => { l.demo.shipment = shipment({ stage: "muster" }); l.demo.household.grain = 100; });
  applyConvoy(context(dealer), { kind: "convoy", action: "withdraw" });
  assert.equal(dealer.demo.shipment, null);
  assert.equal(dealer.demo.household.grain, 1100);
  assert.equal(dealer.economy!.cash, 0);
  if (live) assert.ok(dealer.demo.reputation < 50); else assert.ok(dealer.demo.reputation <= 50);

  const soldier = adult("withdraw-escort", l => { l.demo.shipment = shipment({ kind: "escort", pay: 40, stage: "muster", cargo: 800 }); });
  const armyGrain = soldier.demo.town.army.grain, household = soldier.demo.household.grain;
  applyConvoy(context(soldier), { kind: "convoy", action: "withdraw" });
  assert.equal(soldier.demo.town.army.grain, armyGrain + 800);
  assert.equal(soldier.demo.household.grain, household);
});

test("an escort delivery pays a small bonus from the purse and raises reputation when clean", () => {
  const life = adult("escort-bonus", l => { l.demo.shipment = shipment({ kind: "escort", pay: 40, cargo: 800 }); });
  const purse = life.demo.town.army.purse;
  applyConvoy(context(life), { kind: "convoy", action: "resolve", lossBps: 0 });
  assert.equal(life.economy!.cash, 40);
  assert.equal(life.demo.town.army.purse, purse - 40);
  if (reputationIsLive()) assert.ok(life.demo.reputation > 50);
});

// ── Content and the engine ───────────────────────────────────────────────────

test("the soldier job no longer pays a fixed wealth gain but keeps its warfare training", () => {
  const soldier = world.character!.jobs.find(job => job.id === "soldier")!;
  assert.ok(!soldier.yearlyEffects.some(effect => effect.type === "stat" && effect.stat === "wealth"));
  assert.ok(soldier.yearlyEffects.some(effect => effect.type === "skill" && effect.skill === "warfare" && effect.delta > 0));
  const route = world.legacy!.routes.find(item => item.id === "service")!;
  assert.deepEqual(route.achievementIds, [CONVOY_DISTINCTION]);
  assert.ok(world.events.some(event => event.id === CONVOY_ROAD_EVENT_ID));
});

/** A life paused at the road decision, built from a real start so the engine accepts it. */
function atRoad(seed: string, setup: { job?: string; warfare: number; health?: number; road: DemoState["year"]["road"]; provisions?: boolean }): DemoLife {
  return adult(seed, life => {
    life.character!.jobId = setup.job ?? "soldier";
    life.character!.skills.warfare = setup.warfare;
    life.stats.health = setup.health ?? 70;
    life.demo.year = { ...life.demo.year, road: setup.road };
    life.demo.shipment = shipment({ kind: "escort", cargo: 1000, pay: 40, provisions: setup.provisions ?? false });
    life.phase = "choice";
    life.pendingEventId = CONVOY_ROAD_EVENT_ID;
    life.eventCounts[CONVOY_ROAD_EVENT_ID] = 1;
  });
}

const choiceIds = (life: LifeState) => engine.getChoices(life).map(choice => choice.id);

test("a trained, provisioned escort loses materially less over 200 seeded resolutions", () => {
  const meanLoss = (trained: boolean) => {
    let lost = 0;
    for (let i = 0; i < 200; i++) {
      const life = atRoad(`odds-${i}`, trained ? { warfare: 50, health: 80, road: "dangerous", provisions: true } : { warfare: 0, health: 50, road: "dangerous" });
      const before = life.demo.town.army.grain;
      const after = engine.choose(life, "convoy-push-through") as DemoLife;
      assert.equal(after.demo.shipment, null);
      lost += 1000 - (after.demo.town.army.grain - before);
    }
    return lost / 200;
  };
  const trained = meanLoss(true), untrained = meanLoss(false);
  assert.ok(trained < untrained * 0.6, `trained ${trained} vs untrained ${untrained}`);
});

test("choices appear with training: guarding needs warfare, leading for distinction needs a dangerous road", () => {
  assert.ok(!choiceIds(atRoad("choices-untrained", { warfare: 5, road: "dangerous" })).includes("convoy-guard-cargo"));
  assert.ok(choiceIds(atRoad("choices-trained", { warfare: 30, road: "dangerous" })).includes("convoy-guard-cargo"));
  const min = def.service.distinctionMinWarfare;
  assert.ok(choiceIds(atRoad("lead-ok", { warfare: min, road: "dangerous" })).includes("convoy-lead-escort"));
  assert.ok(!choiceIds(atRoad("lead-weak", { warfare: min - 1, road: "dangerous" })).includes("convoy-lead-escort"));
  assert.ok(!choiceIds(atRoad("lead-safe", { warfare: min, road: "uneasy" })).includes("convoy-lead-escort"));
  assert.ok(!choiceIds(atRoad("lead-dealer", { job: "grain-dealer", warfare: min, road: "dangerous" })).includes("convoy-lead-escort"));
});

test("convoy distinction is awarded only with delivery when leading on a dangerous road", () => {
  let awarded = 0, failed = 0;
  for (let i = 0; i < 60; i++) {
    const life = atRoad(`distinction-${i}`, { warfare: def.service.distinctionMinWarfare + 5, road: "dangerous" });
    const before = life.demo.town.army.grain;
    const after = engine.choose(life, "convoy-lead-escort") as DemoLife;
    const delivered = after.demo.town.army.grain - before;
    const has = after.accomplishments!.some(record => record.achievementId === CONVOY_DISTINCTION);
    if (has) { awarded++; assert.ok(delivered >= 800, `distinction with only ${delivered} delivered`); } else failed++;
  }
  assert.ok(awarded > 0 && failed > 0, `awarded ${awarded}, failed ${failed}`);
  for (const choice of ["convoy-push-through", "convoy-long-road", "convoy-give-up-cargo"]) {
    for (let i = 0; i < 20; i++) {
      const after = engine.choose(atRoad(`no-distinction-${choice}-${i}`, { warfare: 60, road: "dangerous" }), choice);
      assert.ok(!after.accomplishments!.some(record => record.achievementId === CONVOY_DISTINCTION));
    }
  }
});

test("the engine offers the muster, then the road, and re-arms both for the next convoy", () => {
  let life: LifeState = engine.start("engine-chain");
  const seen: string[] = [];
  for (let step = 0; step < 400 && seen.filter(id => id === CONVOY_ROAD_EVENT_ID).length < 2 && life.phase !== "ended"; step++) {
    if (life.phase === "choice") {
      const id = life.pendingEventId!;
      if (id === CONVOY_MUSTER_EVENT_ID || id === CONVOY_ROAD_EVENT_ID) seen.push(id);
      const choices = engine.getChoices(life);
      const choice = id === CONVOY_MUSTER_EVENT_ID ? (choices.some(item => item.id === "convoy-set-out-provisioned") ? "convoy-set-out-provisioned" : "convoy-set-out")
        : id === CONVOY_ROAD_EVENT_ID ? "convoy-push-through"
        : id === "levy-call" && choices.some(item => item.id === "levy-enlist") ? "levy-enlist"
        : choices[0].id;
      life = engine.choose(life, choice);
      if (id === CONVOY_MUSTER_EVENT_ID) {
        assert.equal(life.phase, "choice");
        assert.equal(life.pendingEventId, CONVOY_ROAD_EVENT_ID);
      }
      if (id === CONVOY_ROAD_EVENT_ID) assert.equal(life.demo!.shipment, null);
    } else if (life.phase === "ready" && life.age >= 14 && (life.character?.skills.warfare ?? 0) < 10 && life.character?.jobId !== "soldier") {
      const training = engine.getActivities(life).find(item => item.id === "train-warfare" && item.available);
      life = training ? engine.act(life, training.id) : engine.advance(life);
    } else life = engine.advance(life);
  }
  assert.deepEqual(seen.slice(0, 4), [CONVOY_MUSTER_EVENT_ID, CONVOY_ROAD_EVENT_ID, CONVOY_MUSTER_EVENT_ID, CONVOY_ROAD_EVENT_ID]);
});

// ── Views ────────────────────────────────────────────────────────────────────

test("views never change the life and the preview separates known costs from chance", () => {
  const trained = atRoad("preview-trained", { warfare: 50, health: 80, road: "dangerous", provisions: true });
  const untrained = atRoad("preview-untrained", { warfare: 0, health: 50, road: "dangerous" });
  const before = canonical(trained);
  const view = serviceView(def, trained);
  const preview = convoyPreview(def, trained)!;
  convoyPreview(def, untrained);
  assert.equal(canonical(trained), before);
  assert.equal(view.serving, true);
  assert.equal(view.wage, def.service.wage.quiet);
  assert.ok(preview.knownCosts.length > 0);
  assert.ok(preview.riskFactors.some(factor => /warfare/i.test(factor.label) && factor.effectBps < 0));
  assert.ok(preview.riskFactors.some(factor => /provisions/i.test(factor.label) && factor.effectBps < 0));
  assert.ok(preview.riskFactors.some(factor => /dangerous/i.test(factor.label) && factor.effectBps > 0));
  assert.ok(preview.expectedLossBps < convoyPreview(def, untrained)!.expectedLossBps);
  assert.equal(convoyPreview(def, adult("no-shipment")), null);
});
