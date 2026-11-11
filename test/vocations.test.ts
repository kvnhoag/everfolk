import { vocationInventory } from "../src/vocations/view.ts";
import { TRADE_ITEMS } from "../src/demo/types.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildVocationWorld } from "../src/vocations/world.ts";
import { validateWorld } from "../src/validate.ts";
import { labourUnits } from "../src/demo/household.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import shipped from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";

function fixture(options: { craft?: number; cash?: number; job?: string; events?: boolean } = {}) {
  const world = buildVocationWorld(base as unknown as WorldPack);
  delete world.knowledge;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  delete world.health!.mortalityCalibration;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(e => interrupts.has(e.id) || options.events && e.id.startsWith("v-"));
  world.yearlyRules = [];
  world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const [id, definition] of Object.entries(world.character!.skills)) definition.initial = id === "craft" ? options.craft ?? 24 : 0;
  world.origins = [{ id: "test-household", title: "Test household", text: "Deterministic accounting fixture.", weight: 1, effects: [] }];
  world.demo!.startingResources = { defaults: Object.fromEntries(TRADE_ITEMS.map(item => [item, {
    min: item === "grain" ? world.demo!.household.startingGrain : 0, max: item === "grain" ? world.demo!.household.startingGrain : 0,
  }])) as NonNullable<NonNullable<WorldPack["demo"]>["startingResources"]>["defaults"] };
  world.stats.wealth.initial = (options.cash ?? 1000) / world.economy!.unitsPerPoint;
  const engine = createEngine(world);
  let life = engine.start("vocation-ledger");
  while (life.age < 18) life = engine.advance(life);
  // Reset through an authored fixture origin rather than modifying public snapshots.
  return { engine, life, world };
}
function ready(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}
const act = (engine: LifeEngine, life: LifeState, id: string) => engine.act(life, `v-${id}`);
function shop(engine: LifeEngine, life: LifeState): LifeState {
  life = act(engine, life, "buy-linen"); return act(engine, life, "buy-thread");
}
function total(life: LifeState): number { return life.economy!.cash + Object.values(life.vocations!.accounts).reduce((a, b) => a + b, 0); }

test("new world is reproducible and retains the immutable demo revisions", async () => {
  assert.deepEqual(shipped, buildVocationWorld(base as unknown as WorldPack));
  assert.equal((await loadLifeWorld(shipped.version)).version, shipped.version);
  assert.equal((await loadLifeWorld(base.version)).version, base.version);
  assert.equal((await loadLifeWorld("alexandria-demo-1")).version, "alexandria-demo-1");
  assert.equal(createEngine(base).start("old").vocations, undefined);
});

test("buy, make and sell conserve cash and debit exact inputs", () => {
  const { engine, life: initial } = fixture();
  let life = shop(engine, initial);
  const before = total(life), cash = life.economy!.cash, craft = life.character!.skills.craft;
  life = act(engine, life, "make-garment");
  assert.equal(life.economy!.cash, cash - 8);
  assert.equal(vocationInventory(life).linen, 2);
  assert.equal(life.vocations!.inventory.thread, 2);
  assert.equal(life.vocations!.inventory.garment, 1);
  assert.equal(life.character!.skills.craft, craft + 3);
  assert.equal(total(life), before);
  life = act(engine, life, "sell-garment");
  assert.equal(life.economy!.cash, cash - 8 + 80);
  assert.equal(life.vocations!.inventory.garment, 0);
  assert.equal(life.vocations!.demand.garment, 29);
  assert.equal(total(life), before);
  assert.equal(vocationInventory(initial).linen, 0);
});

test("unaffordable work and repeated major work are rejected atomically", () => {
  const { engine, life: initial } = fixture({ cash: 0 });
  const before = JSON.stringify(initial);
  assert.throws(() => act(engine, initial, "buy-linen"), /cannot afford/);
  assert.equal(JSON.stringify(initial), before);
  const worked = act(engine, initial, "apprentice-pottery");
  assert.equal(worked.economy!.cash, initial.economy!.cash + 12);
  assert.throws(() => act(engine, worked, "apprentice-textiles"), /major activity/);
});

test("intermediate production preserves recipe yield and can supply later work", () => {
  const { engine, life: initial } = fixture();
  let life = act(engine, initial, "buy-flax");
  life = act(engine, life, "make-thread");
  assert.equal(life.vocations!.inventory.thread, 4);
  assert.equal(vocationInventory(life).flax, 2);
  life = ready(engine, engine.advance(life));
  life = act(engine, life, "make-linen");
  assert.equal(life.vocations!.inventory.thread, 0);
  assert.equal(vocationInventory(life).linen, 1);
});

test("large work reserves inputs and fees once and emits one finished product", () => {
  const { engine, life: initial } = fixture({ craft: 70 });
  let life = act(engine, initial, "buy-stone");
  life = act(engine, life, "buy-timber"); life = act(engine, life, "buy-pigment");
  const cash = life.economy!.cash;
  life = act(engine, life, "make-large-relief");
  assert.equal(life.economy!.cash, cash - 16);
  assert.equal(life.vocations!.inventory["large-relief"], undefined);
  assert.equal(life.vocations!.project?.completedYears, 1);
  life = ready(engine, engine.advance(life));
  // Pausing for unrelated study does not charge another project fee or advance it.
  life = act(engine, life, "study-argument");
  assert.equal(life.vocations!.project?.completedYears, 1);
  life = ready(engine, engine.advance(life));
  const resumedCash = life.economy!.cash;
  life = act(engine, life, "make-large-relief");
  assert.equal(life.economy!.cash, resumedCash);
  assert.equal(life.vocations!.inventory["large-relief"], 1);
  assert.equal(life.vocations!.project, undefined);
});

test("new work consumes player farm labour and prevents duplicate old job gains", () => {
  const { engine, life: initial, world } = fixture();
  let life = engine.act(initial, "work-farmhand");
  life = ready(engine, engine.advance(life));
  const farming = life.character!.skills.farming;
  const before = labourUnits(world.demo!, life);
  const ordinaryNext = ready(engine, engine.advance(life));
  life = act(engine, life, "apprentice-pottery");
  assert.equal(labourUnits(world.demo!, life), before - 100);
  life = ready(engine, engine.advance(life));
  assert.equal(life.character!.skills.farming, farming);
  assert.equal(labourUnits(world.demo!, life), labourUnits(world.demo!, ordinaryNext));
});

test("new ledger work is deterministic across save/load, replay and immutable snapshots", () => {
  const { engine, life: initial } = fixture();
  let life = shop(engine, initial); life = act(engine, life, "make-garment"); life = act(engine, life, "sell-garment");
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.ok(Object.isFrozen(life.vocations!.accounts));
});

test("supplier stock, buyer cash and demand remain finite", () => {
  const { world } = fixture();
  world.vocations!.materials.linen.stock = 0;
  let engine = createEngine(world), life = engine.start("empty-stock");
  while (life.age < 18) life = engine.advance(life);
  assert.throws(() => act(engine, life, "buy-linen"), /insufficient stock/);
  world.vocations!.materials.linen.stock = 20;
  world.vocations!.accounts.merchant = 0;
  engine = createEngine(world); life = engine.start("empty-buyer");
  while (life.age < 18) life = engine.advance(life);
  life = shop(engine, life); life = act(engine, life, "make-garment");
  // Sales can use the merchant's receipts, but cannot overdraw that account.
  assert.equal(life.vocations!.accounts.merchant, 116);
  life = act(engine, life, "sell-garment");
  assert.equal(life.vocations!.accounts.merchant, 36);
});

test("capstone careers require demonstrated work as well as proficiency", () => {
  const { world } = fixture();
  for (const s of Object.values(world.character!.skills)) s.initial = 90;
  const engine = createEngine(world); let life = engine.start("career-proofs");
  while (life.age < 18) life = engine.advance(life);
  assert.throws(() => act(engine, life, "qualify-scientist"), /requirements/);
  assert.throws(() => act(engine, life, "qualify-politician"), /requirements/);
  for (const id of ["measure-observations", "measure-observations", "test-explanation", "test-explanation", "independent-check", "independent-check", "original-inquiry", "original-inquiry"]) {
    life = act(engine, life, id); life = ready(engine, engine.advance(life));
  }
  life = act(engine, life, "qualify-scientist");
  assert.equal(life.character!.jobId, "scientist");
});

test("work produces causal events, choices change main stats, and old packs lack those events", () => {
  const { engine, life: initial } = fixture({ events: true });
  const worked = act(engine, initial, "apprentice-pottery");
  let life = worked.phase === "choice" ? worked : engine.advance(worked);
  assert.equal(life.pendingEventId, "v-workshop-safety");
  const health = life.stats.health;
  life = engine.choose(life, "v-rush-the-work");
  assert.ok(life.stats.health < health);
  assert.equal(base.events.some(e => e.id.startsWith("v-")), false);
});

test("malformed vocation packs reject unknown references, duplicate supports and unbounded inputs", () => {
  const { world } = fixture();
  const bad = structuredClone(world); bad.vocations!.recipes.garment.inputs.unknown = 1;
  assert.throws(() => validateWorld(bad), /unknown reference/);
  const duplicate = structuredClone(world); const a = duplicate.vocations!.actions["apprentice-pottery"];
  if (a.kind === "work") a.supports = [a.primary];
  assert.throws(() => validateWorld(duplicate), /primary\/support/);
  const huge = structuredClone(world); huge.vocations!.materials.linen.stock = 1e20;
  assert.throws(() => validateWorld(huge), /expected integer/);
});

test("new work previews match actual skill gains and cash transfers", async () => {
  const { getSkillImpact } = await import("../client/models/skill-impact.ts");
  const { getMoneyImpact } = await import("../client/models/wealth.ts");
  const { engine, life, world } = fixture();
  const choice = engine.getActivities(life).find(a => a.id === "v-apprentice-pottery")!;
  const gains = getSkillImpact(choice, life, world);
  assert.equal(gains.find(g => g.id === "craft")?.min, 3);
  assert.equal(gains.find(g => g.id === "pottery")?.min, 2);
  assert.equal(getMoneyImpact(choice, life, world).find(g => g.id === "cash")?.min, 12);
  const next = act(engine, life, "apprentice-pottery");
  assert.equal(next.character!.skills.craft - life.character!.skills.craft, 3);
  assert.equal(next.economy!.cash - life.economy!.cash, 12);
});

test("ordinary new-world play cannot receive an outdated craft career offer", () => {
  const world = buildVocationWorld(base as unknown as WorldPack);
  const roles = new Set(["apprentice", "potter", "sculptor", "philosophy-tutor", "tailor", "scientist", "politician"]);
  assert.equal(world.events.some(e => e.choices.some(c => c.outcomes.some(o => o.effects.some(effect => effect.type === "job" && effect.job && roles.has(effect.job))))), false);
  const engine = createEngine(world); let life = engine.start("vocation-preview-7");
  while (life.phase !== "ended" && life.age < 25) {
    if (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
    else life = engine.advance(life);
  }
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("civic appointments require completed agreements, accounts and policy work", () => {
  const { world } = fixture();
  for (const skill of Object.values(world.character!.skills)) skill.initial = 90;
  const engine = createEngine(world); let life = engine.start("civic-proofs");
  while (life.age < 18) life = engine.advance(life);
  for (const id of ["public-address", "public-address", "negotiate-agreement", "negotiate-agreement", "audit-accounts", "audit-accounts", "policy-review", "policy-review"]) {
    life = act(engine, life, id); life = ready(engine, engine.advance(life));
  }
  life = act(engine, life, "qualify-politician");
  assert.equal(life.character!.jobId, "politician");
  life = ready(engine, engine.advance(life));
  const before = total(life), cash = life.economy!.cash;
  life = act(engine, life, "public-service");
  assert.equal(life.economy!.cash, cash + 30);
  assert.equal(total(life), before);
});

test("an empty employer purse cannot fund an apprenticeship", () => {
  const { world } = fixture(); world.vocations!.accounts.workshop = 0;
  const engine = createEngine(world); let life = engine.start("unfunded-employer");
  while (life.age < 18) life = engine.advance(life);
  const before = engine.save(life);
  assert.throws(() => act(engine, life, "apprentice-pottery"), /insufficient funds/);
  assert.equal(engine.save(life), before);
});

test("linen bought in the existing market supplies artisan work from the same household store", () => {
  const { engine, life: initial } = fixture();
  let life = engine.demo(initial, { type: "trade", item: "linen", side: "buy", quantity: 2, counterparty: "merchant" });
  assert.equal(life.demo!.goods.linen, 2);
  assert.equal(vocationInventory(life).linen, 2);
  life = act(engine, life, "buy-thread"); life = act(engine, life, "make-garment");
  assert.equal(life.demo!.goods.linen, 0);
  assert.equal(life.vocations!.inventory.linen, undefined);
  assert.equal(life.vocations!.inventory.garment, 1);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("new pack validation never invokes executable skill or support getters", () => {
  const { world } = fixture(); let invoked = false;
  const malformed = structuredClone(world);
  const a = malformed.vocations!.actions["apprentice-pottery"];
  if (a.kind === "work") Object.defineProperty(a.supports, "0", { enumerable: true, get: () => { invoked = true; return "pottery"; } });
  assert.throws(() => validateWorld(malformed), /JSON support array/);
  assert.equal(invoked, false);
  const badCharacter = structuredClone(world);
  Object.defineProperty(badCharacter.character, "skills", { enumerable: true, get: () => { invoked = true; return {}; } });
  assert.throws(() => validateWorld(badCharacter), /data property/);
  assert.equal(invoked, false);
});

test("world rules cannot disguise vocation work as a minor action or automatic gift", () => {
  const { world } = fixture();
  const minor = structuredClone(world);
  minor.character!.activities.find(a => a.id === "v-apprentice-pottery")!.usesYearlyActivity = false;
  assert.throws(() => validateWorld(minor), /must consume the annual activity/);
  const gift = structuredClone(world);
  gift.origins[0].effects.push({ type: "vocation", action: "apprentice-pottery" });
  assert.throws(() => validateWorld(gift), /requires an explicit annual activity/);
});
