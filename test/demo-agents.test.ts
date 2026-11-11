import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEngine, demoWorld } from "./fixtures/demo/world.ts";
import { canonicalJson } from "../src/random.ts";
import { applyEconomyEffect } from "../src/economy.ts";
import { demoContext } from "../src/demo/state.ts";
import {
  AGENT_DECISION_LIMITS, HOUSEHOLD_PURCHASE_JOURNAL_ID, agentCredits, applyAgentCommand, applyOffer, closeAgentYear, townDecision,
} from "../src/demo/agents.ts";
import { offerEventId } from "../src/demo/content/agents.ts";
import { OFFERS } from "../src/demo/types.ts";
import type { AgentCommand, AgentDecision, AgentRole, DemoContext, LifeStateWithDemo, Offer, TownDecision } from "../src/demo/contracts.ts";
import type { Command, LifeEngine, LifeState } from "../src/types.ts";

const AGENTS = { merchant: "merchant.agent", grower: "grower.agent", army: "army.agent" } as const;
const AUTO = "auto.agent";

function agentCommand(agent: string, role: AgentRole, decision: AgentDecision): AgentCommand {
  return { type: "agent", agent, role, decision, signature: `sig:${agent}:${role}` };
}

function withDemo(life: LifeState): LifeStateWithDemo {
  assert.ok(life.demo);
  return life as LifeStateWithDemo;
}

/** A fresh life at age 0 with all three townsperson roles assigned. */
function assigned(engine: LifeEngine, seed = "agents-seed"): LifeStateWithDemo {
  return withDemo(engine.demo(engine.start(seed), { type: "assign-agents", agents: { ...AGENTS } }));
}

/** Plays forward (first choice / advance) until `until` holds. */
function playUntil(engine: LifeEngine, start: LifeState, until: (life: LifeStateWithDemo) => boolean, maxSteps = 200): LifeStateWithDemo {
  let life = withDemo(start);
  for (let step = 0; step < maxSteps && !until(life); step++) {
    assert.notEqual(life.phase, "ended", "life ended before the expected state");
    life = withDemo(life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life));
  }
  assert.ok(until(life), "expected state not reached");
  return life;
}

function readyAt(engine: LifeEngine, life: LifeState, age: number): LifeStateWithDemo {
  return playUntil(engine, life, state => state.age >= age && state.phase === "ready");
}

/** A private draft and module context, for module-level checks (never passed back to the engine). */
function draftContext(life: LifeState): { draft: LifeStateWithDemo; ctx: DemoContext } {
  const world = demoEngine().world;
  const draft = structuredClone(life) as LifeStateWithDemo;
  const ctx = demoContext(world, draft, effects => {
    for (const effect of effects) assert.ok(applyEconomyEffect(world, draft, effect), `unexpected effect ${effect.type}`);
  }, (id, text) => { draft.journal.push({ type: "event", id, text, age: draft.age, year: draft.year }); });
  return { draft, ctx };
}

function assertRejectedUnchanged(engine: LifeEngine, life: LifeState, command: AgentCommand, pattern: RegExp): void {
  const before = canonicalJson(life);
  assert.throws(() => engine.demo(life, command), pattern);
  assert.equal(canonicalJson(life), before);
  // The module itself validates before touching its draft.
  const { draft, ctx } = draftContext(life);
  const draftBefore = canonicalJson(draft);
  assert.throws(() => applyAgentCommand(ctx, command, () => assert.fail("must not run")), pattern);
  assert.equal(canonicalJson(draft), draftBefore);
}

function pricesWithin(life: LifeStateWithDemo): TownDecision {
  const limits = AGENT_DECISION_LIMITS(demoEngine().world.demo!, life);
  return { kind: "prices", grainBuy: limits.merchant.grainBuy.min, grainSell: limits.merchant.grainSell.max };
}

// ── Assignment and delegation ───────────────────────────────────────────────

test("assign-agents records the assignment once, only before the first year", () => {
  const engine = demoEngine();
  const life = assigned(engine);
  assert.deepEqual(life.demo.agents.assigned, AGENTS);
  assert.throws(() => engine.demo(life, { type: "assign-agents", agents: { merchant: "other.agent" } }), /already assigned/);
  const later = readyAt(engine, engine.start("agents-later"), 1);
  assert.throws(() => engine.demo(later, { type: "assign-agents", agents: { ...AGENTS } }), /before the first year/);
});

test("delegate hands the life to an agent and back, with a journal line", () => {
  const engine = demoEngine();
  const life = assigned(engine);
  const delegated = withDemo(engine.demo(life, { type: "delegate", agent: AUTO }));
  assert.equal(delegated.demo.agents.player, AUTO);
  assert.match(delegated.journal.at(-1)!.text, /auto\.agent/);
  assert.throws(() => engine.demo(delegated, { type: "delegate", agent: AUTO }), /already/);
  const back = withDemo(engine.demo(delegated, { type: "delegate", agent: null }));
  assert.equal(back.demo.agents.player, null);
  assert.throws(() => engine.demo(back, { type: "delegate", agent: null }), /already/);
});

// ── Town decisions and limits ───────────────────────────────────────────────

test("a decision from an unassigned agent throws and leaves the life unchanged", () => {
  const engine = demoEngine();
  const life = assigned(engine);
  const decision = pricesWithin(life);
  assertRejectedUnchanged(engine, life, agentCommand("stranger.agent", "merchant", decision), /not assigned/);
  assertRejectedUnchanged(engine, life, agentCommand(AGENTS.grower, "merchant", decision), /not assigned/);
  const unassigned = withDemo(engine.start("agents-unassigned"));
  assertRejectedUnchanged(engine, unassigned, agentCommand(AGENTS.merchant, "merchant", decision), /not assigned/);
  assertRejectedUnchanged(engine, life, agentCommand(AUTO, "player", { kind: "command", command: { type: "advance" } }), /not playing/);
});

test("out-of-limit decisions are rejected, never clamped", () => {
  const engine = demoEngine();
  const life = assigned(engine);
  const def = engine.world.demo!;
  const limits = AGENT_DECISION_LIMITS(def, life);
  const merchant = (decision: AgentDecision) => agentCommand(AGENTS.merchant, "merchant", decision);
  assertRejectedUnchanged(engine, life, merchant({ kind: "prices", grainBuy: limits.merchant.grainBuy.min, grainSell: limits.merchant.grainSell.max + 1 }), /outside/);
  assertRejectedUnchanged(engine, life, merchant({ kind: "prices", grainBuy: limits.merchant.grainBuy.max + 1, grainSell: limits.merchant.grainSell.max }), /outside/);
  assertRejectedUnchanged(engine, life, merchant({ kind: "prices", grainBuy: 3, grainSell: 2 }), /outside|below/);
  assertRejectedUnchanged(engine, life, merchant({ kind: "release", shareBps: 5000 }), /grower/);
  assertRejectedUnchanged(engine, life, agentCommand(AGENTS.grower, "grower", { kind: "release", shareBps: def.agents.growerReleaseBps.max + 1 }), /outside/);
  assertRejectedUnchanged(engine, life, agentCommand(AGENTS.grower, "grower", { kind: "release", shareBps: def.agents.growerReleaseBps.min - 1 }), /outside/);
  assertRejectedUnchanged(engine, life, agentCommand(AGENTS.army, "army", { kind: "wage", premiumBps: def.agents.maxWagePremiumBps + 1 }), /outside/);
  assertRejectedUnchanged(engine, life, agentCommand(AGENTS.army, "army", { kind: "prices", grainBuy: 1, grainSell: 1 }), /merchant/);
  // Edges are accepted.
  const edge = withDemo(engine.demo(life, agentCommand(AGENTS.grower, "grower", { kind: "release", shareBps: def.agents.growerReleaseBps.max })));
  assert.deepEqual(edge.demo.agents.pending.grower, { kind: "release", shareBps: def.agents.growerReleaseBps.max });
});

test("townDecision returns the pending decision until closeAgentYear, then the fixed rule", () => {
  const engine = demoEngine();
  const life = assigned(engine);
  const decision = pricesWithin(life);
  const decided = withDemo(engine.demo(life, agentCommand(AGENTS.merchant, "merchant", decision)));
  const wage = withDemo(engine.demo(decided, agentCommand(AGENTS.army, "army", { kind: "wage", premiumBps: 1000 })));
  const { ctx } = draftContext(wage);
  assert.deepEqual(townDecision(ctx, "merchant"), decision);
  assert.deepEqual(townDecision(ctx, "merchant"), decision, "reading does not clear");
  assert.deepEqual(townDecision(ctx, "army"), { kind: "wage", premiumBps: 1000 });
  assert.equal(townDecision(ctx, "grower"), null);
  const next = withDemo(engine.advance(wage));
  assert.deepEqual(next.demo.agents.pending, {});
  assert.equal(townDecision(draftContext(next).ctx, "merchant"), null);
  // Nothing touched the player (no trade, not a soldier), so no credit.
  assert.deepEqual(next.demo.agents.credits, {});
});

test("the same decision twice in one year is rejected and credited once", () => {
  const engine = demoEngine();
  const life = assigned(engine);
  const command = agentCommand(AGENTS.merchant, "merchant", pricesWithin(life));
  const once = withDemo(engine.demo(life, command));
  assertRejectedUnchanged(engine, once, command, /already decided/);
  const limits = AGENT_DECISION_LIMITS(engine.world.demo!, once);
  const offer = agentCommand(AGENTS.merchant, "merchant", { kind: "offer", offer: "grain-contract", item: "grain", quantity: 10, price: limits.offers.prices.grain.buy.min });
  const offered = withDemo(engine.demo(once, offer));
  assert.equal(offered.demo.agents.credits[AGENTS.merchant], 1);
  assertRejectedUnchanged(engine, offered, offer, /open offer/);
  // Another role cannot stack a second open offer either.
  assertRejectedUnchanged(engine, offered, agentCommand(AGENTS.grower, "grower", { kind: "offer", offer: "seed-credit", item: "grain", quantity: 10, price: limits.offers.prices.grain.sell.min }), /open offer/);
});

test("closeAgentYear credits only decisions that touched the player, then clears pending", () => {
  const engine = demoEngine();
  const base = readyAt(engine, assigned(engine), 3);
  const pending = { merchant: { kind: "prices", grainBuy: 1, grainSell: 1 }, grower: { kind: "release", shareBps: 5000 }, army: { kind: "wage", premiumBps: 0 } } as const;
  const settle = (patch: (draft: LifeStateWithDemo) => void) => {
    const { draft, ctx } = draftContext(base);
    draft.demo.agents.pending = structuredClone(pending);
    patch(draft);
    closeAgentYear(ctx);
    assert.deepEqual(draft.demo.agents.pending, {});
    return draft.demo.agents.credits;
  };
  const trade = (draft: LifeStateWithDemo, command: Command, age = draft.age - 1) => { draft.commands.push(command); draft.demo.lastTradeAge = age; };
  assert.deepEqual(settle(() => {}), {});
  assert.deepEqual(settle(draft => trade(draft, { type: "trade", item: "grain", side: "buy", quantity: 5, counterparty: "merchant" })), { [AGENTS.merchant]: 1, [AGENTS.grower]: 1 });
  assert.deepEqual(settle(draft => trade(draft, { type: "trade", item: "silver", side: "sell", quantity: 1, counterparty: "merchant" })), { [AGENTS.merchant]: 1 });
  assert.deepEqual(settle(draft => trade(draft, { type: "trade", item: "grain", side: "sell", quantity: 5, counterparty: "army" })), { [AGENTS.army]: 1 });
  // Auto-play trades count too.
  assert.deepEqual(settle(draft => trade(draft, agentCommand(AUTO, "player", { kind: "command", command: { type: "trade", item: "grain", side: "buy", quantity: 5, counterparty: "merchant" } }))), { [AGENTS.merchant]: 1, [AGENTS.grower]: 1 });
  // A trade from an earlier year does not count.
  assert.deepEqual(settle(draft => trade(draft, { type: "trade", item: "grain", side: "buy", quantity: 5, counterparty: "merchant" }, draft.age - 2)), {});
  assert.deepEqual(settle(draft => { draft.character!.jobId = "soldier"; }), { [AGENTS.army]: 1 });
  assert.deepEqual(settle(draft => { draft.journal.push({ type: "event", id: HOUSEHOLD_PURCHASE_JOURNAL_ID, text: "x", age: draft.age, year: draft.year }); }), { [AGENTS.merchant]: 1, [AGENTS.grower]: 1 });
  // Without a decision of its own, a role earns nothing even when the player traded with it.
  const { draft, ctx } = draftContext(base);
  trade(draft, { type: "trade", item: "grain", side: "buy", quantity: 5, counterparty: "merchant" });
  closeAgentYear(ctx);
  assert.deepEqual(draft.demo.agents.credits, {});
});

test("agentCredits lists credited agents by count, then name", () => {
  assert.deepEqual(agentCredits({ "b.agent": 2, "a.agent": 2, "c.agent": 5, "z.agent": 0 }),
    [{ agent: "c.agent", decisions: 5 }, { agent: "a.agent", decisions: 2 }, { agent: "b.agent", decisions: 2 }]);
});

// ── Offers ──────────────────────────────────────────────────────────────────

test("every offer kind has an event conditioned on the open offer with accept and decline", () => {
  const world = demoWorld();
  for (const kind of OFFERS) {
    const event = world.events.find(item => item.id === offerEventId(kind));
    assert.ok(event, kind);
    assert.deepEqual(event.trigger, { type: "year", at: world.startYear });
    assert.deepEqual(event.when, { type: "demo", condition: { kind: "offer", offer: kind } });
    const actions = event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects));
    assert.deepEqual(actions, [{ type: "demo", effect: { kind: "offer", action: "accept" } }, { type: "demo", effect: { kind: "offer", action: "decline" } }]);
  }
});

test("an offer becomes demo.offer and its event; accepting settles quantity × price exactly once", () => {
  const engine = demoEngine();
  const life = readyAt(engine, assigned(engine), 2);
  const limits = AGENT_DECISION_LIMITS(engine.world.demo!, life);
  const price = limits.offers.prices.grain.buy.max;
  const offered = withDemo(engine.demo(life, agentCommand(AGENTS.merchant, "merchant", { kind: "offer", offer: "grain-contract", item: "grain", quantity: 40, price })));
  assert.deepEqual(offered.demo.offer, { kind: "grain-contract", role: "merchant", agent: AGENTS.merchant, item: "grain", quantity: 40, price } satisfies Offer);
  assert.equal(offered.demo.agents.credits[AGENTS.merchant], 1);
  const eventId = offerEventId("grain-contract");
  const asked = playUntil(engine, offered, state => state.pendingEventId === eventId);
  assert.ok(engine.getChoices(asked).some(choice => choice.id === "accept-grain-contract"));
  const accepted = withDemo(engine.choose(asked, "accept-grain-contract"));
  assert.equal(accepted.demo.offer, null);
  assert.equal(accepted.demo.household.grain, asked.demo.household.grain - 40);
  assert.equal(accepted.demo.town.merchant.grain, asked.demo.town.merchant.grain + 40);
  assert.equal(accepted.demo.town.merchant.cash, asked.demo.town.merchant.cash - 40 * price);
  assert.ok(accepted.journal.some(entry => entry.text.includes(`40 measures of grain`) && entry.text.includes(`${price}`)));
  assert.equal(accepted.demo.agents.credits[AGENTS.merchant], 1, "accepting does not credit again");
  // The same kind of offer can come again later.
  const nextYear = readyAt(engine, accepted, accepted.age + 1);
  const again = engine.demo(nextYear, agentCommand(AGENTS.merchant, "merchant", { kind: "offer", offer: "grain-contract", item: "grain", quantity: 5, price: AGENT_DECISION_LIMITS(engine.world.demo!, nextYear).offers.prices.grain.buy.min }));
  assert.equal(playUntil(engine, again, state => state.pendingEventId === eventId).pendingEventId, eventId);
  assert.deepEqual(engine.replay(accepted.seed, accepted.commands), accepted);
  assert.deepEqual(engine.load(engine.save(accepted)), accepted);
});

test("declining clears the offer and moves nothing", () => {
  const engine = demoEngine();
  const life = readyAt(engine, assigned(engine), 2);
  const price = AGENT_DECISION_LIMITS(engine.world.demo!, life).offers.prices.grain.sell.min;
  const offered = engine.demo(life, agentCommand(AGENTS.grower, "grower", { kind: "offer", offer: "seed-credit", item: "grain", quantity: 30, price }));
  const asked = playUntil(engine, offered, state => state.pendingEventId === offerEventId("seed-credit"));
  const declined = withDemo(engine.choose(asked, "decline-seed-credit"));
  assert.equal(declined.demo.offer, null);
  assert.equal(declined.demo.household.grain, asked.demo.household.grain);
  assert.deepEqual(declined.demo.town, asked.demo.town);
  assert.equal(declined.economy!.debt, asked.economy!.debt);
});

test("applyOffer settles each kind exactly and declines what the player cannot honour", () => {
  const engine = demoEngine();
  const life = readyAt(engine, assigned(engine), 2);
  const open = (offer: Offer, patch: (draft: LifeStateWithDemo) => void = () => {}) => {
    const { draft, ctx } = draftContext(life);
    draft.demo.offer = offer;
    draft.eventCounts[offerEventId(offer.kind)] = 1;
    patch(draft);
    const before = structuredClone(draft);
    applyOffer(ctx, { kind: "offer", action: "accept" });
    assert.equal(draft.demo.offer, null);
    assert.equal(draft.eventCounts[offerEventId(offer.kind)] ?? 0, 0, "the offer event can come again");
    applyOffer(ctx, { kind: "offer", action: "accept" }); // a second answer is a no-op
    return { before, after: draft };
  };
  const contract = open({ kind: "grain-contract", role: "army", agent: AGENTS.army, item: "grain", quantity: 100, price: 2 });
  assert.equal(contract.after.demo.household.grain, contract.before.demo.household.grain - 100);
  assert.equal(contract.after.economy!.cash, contract.before.economy!.cash + 200);
  assert.equal(contract.after.demo.town.army.grain, contract.before.demo.town.army.grain + 100);
  assert.equal(contract.after.demo.town.army.purse, contract.before.demo.town.army.purse - 200);

  const credit = open({ kind: "seed-credit", role: "grower", agent: AGENTS.grower, item: "grain", quantity: 50, price: 1 });
  assert.equal(credit.after.demo.household.grain, credit.before.demo.household.grain + 50);
  assert.equal(credit.after.demo.town.grower.grain, credit.before.demo.town.grower.grain - 50);
  assert.equal(credit.after.economy!.debt, credit.before.economy!.debt + 50);
  assert.equal(credit.after.economy!.cash, credit.before.economy!.cash);

  const deal = open({ kind: "goods-deal", role: "merchant", agent: AGENTS.merchant, item: "silver", quantity: 1, price: 60 }, draft => { draft.economy!.cash = 100; });
  assert.equal(deal.after.demo.goods.silver, deal.before.demo.goods.silver + 1);
  assert.equal(deal.after.demo.town.merchant.goods.silver, deal.before.demo.town.merchant.goods.silver - 1);
  assert.equal(deal.after.economy!.cash, 40);
  assert.equal(deal.after.demo.town.merchant.cash, deal.before.demo.town.merchant.cash + 60);

  const job = open({ kind: "convoy-job", role: "army", agent: AGENTS.army, item: "grain", quantity: 300, price: 1 }, draft => { draft.character!.jobId = "soldier"; });
  assert.deepEqual(job.after.demo.shipment, { kind: "escort", cargo: 300, pay: 300, stage: "muster", provisions: false, companions: 0, riskCutBps: 0 });
  assert.equal(job.after.demo.lastEscortAge, job.after.age);

  // Impossible for the player: declined with a journal line, nothing moves.
  const tooMuch = open({ kind: "grain-contract", role: "merchant", agent: AGENTS.merchant, item: "grain", quantity: 2000, price: 1 }, draft => { draft.demo.household.grain = 10; });
  assert.deepEqual(tooMuch.after.demo.town, tooMuch.before.demo.town);
  assert.equal(tooMuch.after.demo.household.grain, 10);
  assert.match(tooMuch.after.journal.at(-1)!.text, /not enough grain/i);
  const broke = open({ kind: "goods-deal", role: "merchant", agent: AGENTS.merchant, item: "gold", quantity: 1, price: 700 }, draft => { draft.economy!.cash = 5; });
  assert.equal(broke.after.economy!.cash, 5);
  assert.equal(broke.after.demo.goods.gold, broke.before.demo.goods.gold);
  const notSoldier = open({ kind: "convoy-job", role: "army", agent: AGENTS.army, item: "grain", quantity: 300, price: 1 }, draft => { draft.character!.jobId = null; });
  assert.equal(notSoldier.after.demo.shipment, null);

  const { draft, ctx } = draftContext(life);
  draft.demo.offer = { kind: "seed-credit", role: "grower", agent: AGENTS.grower, item: "grain", quantity: 50, price: 1 };
  const grain = draft.demo.household.grain;
  applyOffer(ctx, { kind: "offer", action: "decline" });
  assert.equal(draft.demo.offer, null);
  assert.equal(draft.demo.household.grain, grain);
});

test("offers are checked against role, item, quantity, price band and the role's own stock", () => {
  const engine = demoEngine();
  const life = readyAt(engine, assigned(engine), 2);
  const def = engine.world.demo!;
  const limits = AGENT_DECISION_LIMITS(def, life);
  const offer = (role: "merchant" | "grower" | "army", decision: Partial<Extract<TownDecision, { kind: "offer" }>>) =>
    agentCommand(AGENTS[role], role, { kind: "offer", offer: "grain-contract", item: "grain", quantity: 10, price: limits.offers.prices.grain.buy.min, ...decision } as TownDecision);
  assertRejectedUnchanged(engine, life, offer("merchant", { quantity: def.agents.offerQuantity.max + 1 }), /quantity/);
  assertRejectedUnchanged(engine, life, offer("merchant", { price: limits.offers.prices.grain.buy.max + 1 }), /outside/);
  assertRejectedUnchanged(engine, life, offer("merchant", { item: "silver" }), /grain/);
  assertRejectedUnchanged(engine, life, offer("grower", { offer: "goods-deal", item: "silver", price: limits.offers.prices.silver.sell.min }), /merchant/);
  assertRejectedUnchanged(engine, life, offer("merchant", { offer: "goods-deal", item: "gold", quantity: life.demo.town.merchant.goods.gold + 1, price: limits.offers.prices.gold.sell.min }), /stock|holds/);
  assertRejectedUnchanged(engine, life, offer("army", { offer: "convoy-job" }), /soldier/);
  // Limits are read-only and reflect an open offer.
  const before = canonicalJson(life);
  AGENT_DECISION_LIMITS(def, life);
  assert.equal(canonicalJson(life), before);
  const offered = withDemo(engine.demo(life, offer("merchant", {})));
  assert.equal(AGENT_DECISION_LIMITS(def, offered).offers.open, true);
  assert.equal(AGENT_DECISION_LIMITS(def, life).offers.open, false);
});

// ── Auto-play ───────────────────────────────────────────────────────────────

test("auto-play runs advance, choose, act, trade and plan, records only agent commands and replays identically", () => {
  const engine = demoEngine();
  let life = withDemo(engine.demo(assigned(engine, "agents-auto"), { type: "delegate", agent: AUTO }));
  const delegatedAt = life.commands.length;
  const play = (command: Command) => { life = withDemo(engine.demo(life, agentCommand(AUTO, "player", { kind: "command", command }))); };
  let steps = 0;
  const step = () => { play(life.phase === "choice" ? { type: "choose", choice: engine.getChoices(life)[0].id } : { type: "advance" }); steps++; };
  while (life.age < 12) step();
  while (life.phase !== "ready") step();
  play({ type: "plan", flaxPlots: 0 }); steps++;
  play({ type: "trade", item: "grain", side: "buy", quantity: 1, counterparty: "merchant" }); steps++;
  const activity = engine.getActivities(life).find(item => item.available);
  assert.equal(activity?.id, "train-literacy");
  play({ type: "act", activity: activity.id }); steps++;
  while (life.age < 8) step();

  const recorded = life.commands.slice(delegatedAt);
  assert.equal(recorded.length, steps);
  assert.ok(recorded.every(command => command.type === "agent" && command.role === "player"));
  assert.ok(recorded.some(command => command.type === "agent" && command.decision.kind === "command" && command.decision.command.type === "advance"));
  assert.ok(!recorded.some(command => command.type === "advance"), "no bare advance is recorded");
  assert.equal(life.demo.agents.credits[AUTO], steps);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);

  // Taking control back stops the agent.
  const back = engine.demo(life, { type: "delegate", agent: null });
  assertRejectedUnchanged(engine, back, agentCommand(AUTO, "player", { kind: "command", command: { type: "advance" } }), /not playing/);
});

test("auto-play rejects malformed or forbidden inner commands without changing the life", () => {
  const engine = demoEngine();
  const life = withDemo(engine.demo(assigned(engine), { type: "delegate", agent: AUTO }));
  const inner = (command: unknown) => agentCommand(AUTO, "player", { kind: "command", command: command as Command });
  assertRejectedUnchanged(engine, life, inner({ type: "advance", extra: 1 }), /cannot issue/);
  assertRejectedUnchanged(engine, life, inner({ type: "choose", choice: 3 }), /cannot issue/);
  assertRejectedUnchanged(engine, life, inner({ type: "delegate", agent: null }), /cannot issue/);
  assertRejectedUnchanged(engine, life, inner({ type: "influence", entry: "x" }), /cannot issue/);
  assertRejectedUnchanged(engine, life, agentCommand("someone.else", "player", { kind: "command", command: { type: "advance" } }), /not playing/);
});

test("a long life with every agent command type replays and loads identically", () => {
  const engine = demoEngine();
  let life = assigned(engine, "agents-long");
  const def = engine.world.demo!;
  for (let year = 0; year < 25 && life.phase !== "ended"; year++) {
    life = readyAt(engine, life, life.age);
    const limits = AGENT_DECISION_LIMITS(def, life);
    life = withDemo(engine.demo(life, agentCommand(AGENTS.merchant, "merchant", { kind: "prices", grainBuy: limits.merchant.grainBuy.max, grainSell: limits.merchant.grainSell.max })));
    life = withDemo(engine.demo(life, agentCommand(AGENTS.grower, "grower", { kind: "release", shareBps: def.agents.growerReleaseBps.min })));
    life = withDemo(engine.demo(life, agentCommand(AGENTS.army, "army", { kind: "wage", premiumBps: year * 100 })));
    if (year % 3 === 1 && !life.demo.offer) {
      life = withDemo(engine.demo(life, agentCommand(AGENTS.grower, "grower", { kind: "offer", offer: "seed-credit", item: "grain", quantity: 20, price: limits.offers.prices.grain.sell.min })));
    }
    life = withDemo(life.phase === "choice" ? engine.choose(life, engine.getChoices(life).at(-1)!.id) : engine.advance(life));
  }
  assert.ok(life.demo.agents.credits[AGENTS.grower] >= 1);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
