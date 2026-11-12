import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { initialVocations } from "../src/vocations/engine.ts";
import { buildDeepSkillWorld } from "../src/capabilities/world.ts";
import { CAPABILITY_RULES } from "../src/capabilities/rules.ts";
import { CAPABILITY_OPERATIONS } from "../src/capabilities/operations.ts";
import { CAPABILITY_SERVICE_CONTRACTS } from "../src/capabilities/rewards.ts";
import { applyCapabilityAction, capabilityActionReason } from "../src/capabilities/actions.ts";
import { capabilityServiceCashDelta } from "../src/capabilities/services.ts";
import base from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import type { LifeState, WorldPack } from "../src/types.ts";

// Authored learned-state fixtures isolate service accounting; these are not mastery-reachability claims.
function fixture(node: string) {
  const world = buildDeepSkillWorld(base as unknown as WorldPack);
  const life = structuredClone(createEngine(world).start("service-accounting-" + node));
  life.age = 30; life.year = -320; life.stats.health = 100; life.character!.jobId = null;
  life.economy!.cash = 100; life.vocations = initialVocations(world.vocations!);
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 30;
  const ancestors = new Set<string>();
  const visit = (id: string) => { if (ancestors.has(id)) return; const rule = CAPABILITY_RULES.find(rule => rule.id === id)!; for (const parent of rule.prerequisites.all) visit(parent); ancestors.add(id); };
  visit(node); life.capabilities = { learned: Object.fromEntries([...ancestors].map(id => [id, { year: -321, evidenceIds: [] }])), evidence: [] };
  return { world, life };
}
const act = (f: ReturnType<typeof fixture>, service: string) => applyCapabilityAction(f.world, f.life, "cap-service-" + service);
const reason = (f: ReturnType<typeof fixture>, service: string) => capabilityActionReason(f.world, f.life, "cap-service-" + service);
function supply(life: LifeState, item: string, quantity: number) {
  if (item === "linen") life.demo!.goods.linen = quantity;
  else { life.vocations!.inventory[item] = quantity; life.vocations!.lots.push({ item, quality: 1, quantity }); }
}
const nextWorkYear = (life: LifeState) => { life.age++; life.year++; };
const money = (life: LifeState) => life.economy!.cash + Object.values(life.vocations!.accounts).reduce((sum, value) => sum + value, 0) + (life.vocations!.capabilityWork?.serviceProject?.escrow ?? 0);

test("every authored service has the same node gate and consumes annual work", () => {
  for (const [id, contract] of Object.entries(CAPABILITY_SERVICE_CONTRACTS)) {
    const operation = CAPABILITY_OPERATIONS["service-" + id];
    assert.equal(operation.kind, "service"); assert.equal(operation.node, contract.node); assert.notEqual(operation.minor, true);
    const f = fixture(contract.node);
    assert.deepEqual(f.world.vocations!.actions["cap-service-" + id], { kind: "capability", operation: "service-" + id });
    assert.equal(f.world.character!.activities.find(activity => activity.id === "v-cap-service-" + id)!.usesYearlyActivity, true);
  }
});

test("a two-year inquiry escrows finite pay and debits inputs and access fee only once", () => {
  const f = fixture("PS9"), life = f.life, ledger = life.vocations!;
  life.economy!.cash = 10; ledger.accounts.school = 180;
  supply(life, "papyrus", 4); supply(life, "ink", 3);
  const startingMoney = money(life), workshop = ledger.accounts.workshop;
  assert.equal(capabilityServiceCashDelta(life, "service-treatise"), -10); act(f, "treatise");
  assert.equal(life.economy!.cash, 0); assert.equal(ledger.accounts.school, 0); assert.equal(ledger.accounts.workshop, workshop + 10);
  assert.equal(ledger.capabilityWork!.serviceProject!.escrow, 180); assert.equal(ledger.capabilityWork!.serviceProject!.completedYears, 1);
  assert.equal(ledger.inventory.papyrus, 0); assert.equal(ledger.inventory.ink, 0); assert.equal(money(life), startingMoney);
  assert.equal(life.character!.skills.philosophy, 33); assert.equal(life.character!.skills.literacy, 32); assert.equal(life.character!.skills.reckoning, 32); assert.equal(life.character!.skills.craft, 30);
  assert.match(reason(f, "treatise")!, /major work|year/i);
  const sameYear = structuredClone(life); assert.throws(() => act(f, "treatise"), /major work|year/i); assert.deepEqual(life, sameYear);
  nextWorkYear(life); assert.equal(reason(f, "treatise"), undefined); assert.match(reason(f, "guided-study")!, /current service/i); assert.equal(capabilityServiceCashDelta(life, "service-treatise"), 180);
  act(f, "treatise");
  assert.equal(life.economy!.cash, 180); assert.equal(ledger.accounts.school, 0); assert.equal(ledger.accounts.workshop, workshop + 10); assert.equal(money(life), startingMoney);
  assert.equal(ledger.capabilityWork!.serviceProject, undefined);
  assert.equal(life.character!.skills.philosophy, 36); assert.equal(life.character!.skills.literacy, 34); assert.equal(life.character!.skills.reckoning, 34);
  assert.deepEqual(life.capabilities!.evidence.map(record => [record.kind, record.facts.paymentRecorded, record.facts.payment]), [["work", false, 0], ["contract", true, 180]]);
  assert.ok(life.capabilities!.evidence.every(record => record.facts.paidInputs === false));
  nextWorkYear(life); assert.match(reason(f, "treatise")!, /payer|reserve|materials/i);
});

test("fees, material stock, payer budget and learned access reject before any debit", () => {
  for (const failure of ["fee", "payer", "material", "node"] as const) {
    const f = fixture("PS9"); supply(f.life, "papyrus", 4); supply(f.life, "ink", 3);
    if (failure === "fee") f.life.economy!.cash = 9;
    if (failure === "payer") f.life.vocations!.accounts.school = 179;
    if (failure === "material") f.life.vocations!.inventory.ink = 2;
    if (failure === "node") delete f.life.capabilities!.learned.PS9;
    assert.ok(reason(f, "treatise"), failure);
    const before = structuredClone(f.life); assert.throws(() => act(f, "treatise")); assert.deepEqual(f.life, before);
  }
});

test("a real purchased-input service retains genuine acquisition provenance and does not mint payment", () => {
  const f = fixture("PS5"), life = f.life, before = money(life);
  applyCapabilityAction(f.world, life, "buy-papyrus"); applyCapabilityAction(f.world, life, "buy-ink");
  const purchaseCash = life.economy!.cash, school = life.vocations!.accounts.school;
  act(f, "observation");
  assert.equal(life.economy!.cash, purchaseCash + 20); assert.equal(life.vocations!.accounts.school, school - 20); assert.equal(money(life), before);
  assert.equal(life.vocations!.inventory.papyrus, 1); assert.equal(life.vocations!.inventory.ink, 1);
  assert.equal(life.vocations!.capabilityWork!.tradeAcquisitionQuantity!.papyrus, 1); assert.equal(life.vocations!.capabilityWork!.tradeAcquisitionQuantity!.ink, 1);
  const records = life.capabilities!.evidence; assert.equal(records.filter(record => record.kind === "trade").length, 2);
  assert.equal(records.at(-1)!.facts.paidInputs, true); assert.equal(records.at(-1)!.facts.paymentRecorded, true);
  assert.equal(records.at(-1)!.action, "service-observation");
});

test("workshop restoration conserves its access fee and reserved customer pay across two years", () => {
  const f = fixture("AS10"), life = f.life; life.economy!.cash = 5; life.vocations!.accounts.workshop = 80;
  supply(life, "stone", 1); supply(life, "pigment", 1); const before = money(life);
  act(f, "restoration"); assert.equal(life.economy!.cash, 0); assert.equal(life.vocations!.accounts.workshop, 5); assert.equal(life.vocations!.capabilityWork!.serviceProject!.escrow, 80); assert.equal(money(life), before);
  nextWorkYear(life); assert.equal(reason(f, "restoration"), undefined);
  assert.equal(reason(f, "garment-repair")?.includes("AT10"), true);
  act(f, "restoration"); assert.equal(life.economy!.cash, 80); assert.equal(life.vocations!.accounts.workshop, 5); assert.equal(money(life), before);
  assert.equal(life.vocations!.inventory.stone, 0); assert.equal(life.vocations!.inventory.pigment, 0);
  assert.equal(life.character!.skills.craft, 36); assert.equal(life.character!.skills.sculpture, 34); assert.equal(life.character!.skills.carving, 34);
});

test("a one-year master repair uses real cloth and thread and pays one funded net amount", () => {
  const f = fixture("AT10"), life = f.life; life.economy!.cash = 2; life.vocations!.accounts.workshop = 24;
  supply(life, "linen", 1); supply(life, "thread", 1); const before = money(life);
  assert.equal(capabilityServiceCashDelta(life, "service-garment-repair"), 22); act(f, "garment-repair");
  assert.equal(life.economy!.cash, 24); assert.equal(life.vocations!.accounts.workshop, 2); assert.equal(money(life), before);
  assert.equal(life.demo!.goods.linen, 0); assert.equal(life.vocations!.inventory.thread, 0); assert.equal(life.vocations!.capabilityWork!.serviceProject, undefined);
  assert.equal(life.capabilities!.evidence.at(-1)!.facts.payment, 24);
  const after = structuredClone(life); assert.throws(() => act(f, "garment-repair"), /major work|year/i); assert.deepEqual(life, after);
});
