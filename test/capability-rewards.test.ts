import assert from "node:assert/strict";
import test from "node:test";
import design from "../design/skill-tree/catalog.json" with { type: "json" };
import { capabilityRewards, quoteCapabilityProduction, quoteFarmCapabilityPlan, capabilitySpoilageBps, quoteCapabilityService, quoteCapabilityTrade, type ProductionRecipe } from "../src/capabilities/rewards.ts";

function through(id: string): string[] {
  const ids = new Set<string>();
  const visit = (key: string) => { if (ids.has(key)) return; const node = design.nodes.find(n => n.id === key)!; for (const parent of node.prerequisites.all) visit(parent); ids.add(key); };
  visit(id); return [...ids];
}
const recipe = (id: string): ProductionRecipe => {
  const item = design.recipes.find(r => r.id === id)!;
  const output = Object.entries(item.output).find(([, value]) => typeof value === "number")!;
  return { inputs: Object.fromEntries(Object.entries(item.inputs).filter((pair): pair is [string, number] => typeof pair[1] === "number")), output: output[0], outputQuantity: output[1] as number, fee: item.fee, workYears: item.workYears, baseAsk: item.baseAsk };
};

test("starter production needs material preparation and cannot skip supervision or learned batch limits", () => {
  assert.equal(quoteCapabilityProduction(capabilityRewards([]), recipe("garment")).allowed, false);
  const starter = quoteCapabilityProduction(capabilityRewards(through("A3")), recipe("garment"));
  assert.equal(starter.allowed, true); assert.equal(starter.supervised, true); assert.equal(starter.fee, 10); assert.equal(starter.qualityCap, 1);
  assert.equal(quoteCapabilityProduction(capabilityRewards(through("A3")), recipe("garment"), { quantity: 2 }).allowed, false);
  assert.equal(quoteCapabilityProduction(capabilityRewards(through("A3")), recipe("garment"), { inspected: true }).allowed, false);
  const independent = quoteCapabilityProduction(capabilityRewards(through("A4")), recipe("garment"), { quantity: 2, inspected: true });
  assert.equal(independent.allowed, true); assert.equal(independent.fee, 11); assert.equal(independent.qualityCap, 1); assert.equal(independent.qualityBonus, 1);
  assert.equal(quoteCapabilityProduction(capabilityRewards(through("A4")), recipe("thread"), { quantity: 1 }).allowed, false);
  assert.equal(quoteCapabilityProduction(capabilityRewards(through("A4")), recipe("thread"), { quantity: 8 }).inputs.flax, 4);
});

test("tailoring saves actual base cloth only in sufficiently large batches and still pays thread and dye", () => {
  const profile = capabilityRewards(through("AT9")), garment = recipe("ceremonial-garment"), snapshot = structuredClone(garment);
  const quote = quoteCapabilityProduction(profile, garment, { quantity: 4, recipeId: "ceremonial-garment" });
  assert.equal(quote.allowed, true); assert.equal(quote.inputs.linen, 11); assert.equal(quote.inputs.thread, 12); assert.equal(quote.inputs.pigment, 8);
  assert.equal(quoteCapabilityProduction(profile, recipe("garment"), { quantity: 3 }).inputs.linen, 6);
  const dyed = quoteCapabilityProduction(profile, recipe("dyed-garment"), { recipeId: "dyed-garment", quantity: 4 });
  assert.equal(dyed.inputs.linen, 7); assert.equal(dyed.inputs.thread, 8); assert.equal(dyed.inputs.pigment, 4); assert.equal(dyed.baseAsk, 130);
  assert.deepEqual(garment, snapshot);
});

test("efficient kiln fuel replaces the base while controlled firing and decoration remain payable", () => {
  const profile = capabilityRewards(through("AC8"));
  const quote = quoteCapabilityProduction(profile, recipe("decorated-vessel"), { recipeId: "decorated-vessel", quantity: 9, controlledFiring: true, inspected: true });
  assert.equal(quote.allowed, true); assert.deepEqual(quote.inputs, { clay: 18, fuel: 8, pigment: 3 });
  assert.equal(quote.fee, 7); assert.equal(quote.qualityCap, 3); assert.equal(quote.qualityBonus, 2);
  assert.equal(quoteCapabilityProduction(profile, recipe("vessel"), { quantity: 13 }).allowed, false);
});

test("sculpture unlocks respect project-specific output and multi-year reservation costs", () => {
  const profile = capabilityRewards(through("AS9"));
  const stone = quoteCapabilityProduction(profile, recipe("stone-figure"));
  assert.deepEqual(stone.inputs, { stone: 1, timber: 1 }); assert.equal(stone.fee, 8);
  const relief = quoteCapabilityProduction(profile, recipe("large-relief"));
  assert.equal(relief.allowed, true); assert.equal(relief.workYears, 2); assert.equal(relief.fee, 16); assert.equal(relief.quantity, 1);
  assert.equal(quoteCapabilityProduction(profile, recipe("bust"), { quantity: 2 }).allowed, false);
  assert.equal(quoteCapabilityProduction(profile, recipe("monument")).qualityCap, 4);
  assert.ok(!profile.eligibleCareers.includes("master-sculptor"));
  assert.ok(capabilityRewards(through("AS10")).eligibleCareers.includes("master-sculptor"));
});

test("annual farm bonuses are action-specific, sowing-exclusive, capped and separate from flood correction", () => {
  const entry = quoteFarmCapabilityPlan(capabilityRewards([]), { flood: "normal", crop: "grain", plots: 1, mode: "fieldwork", baseFloodBps: 10000 });
  assert.equal(entry.allowed, true); assert.equal(entry.bonusBps, 0);
  const profile = capabilityRewards(through("FC10"));
  const low = quoteFarmCapabilityPlan(profile, { flood: "low", crop: "flax", plots: 3, mode: "integrated", sowing: "conservative", baseFloodBps: 4500 });
  assert.equal(low.allowed, true); assert.equal(low.bonusBps, 2000); assert.equal(low.floodFactorBps, 6000); assert.equal(low.fee, 24); assert.equal(low.annualActions, 1); assert.equal(low.flaxSeed, 6);
  const dense = quoteFarmCapabilityPlan(profile, { flood: "normal", crop: "grain", plots: 2, mode: "crop-care", sowing: "dense", baseFloodBps: 10000 });
  assert.equal(dense.grainSeed, 40); assert.equal(dense.bonusBps, 1400); assert.equal(dense.fee, 0);
  const ordinary = quoteFarmCapabilityPlan(profile, { flood: "normal", crop: "grain", plots: 2, baseFloodBps: 10000 });
  assert.equal(ordinary.bonusBps, 0); assert.equal(ordinary.annualActions, 0);
  assert.equal(quoteFarmCapabilityPlan(capabilityRewards(through("F3S")), { flood: "low", crop: "grain", plots: 1, mode: "integrated", baseFloodBps: 4500 }).allowed, false);
});

test("resilience reductions replace earlier tiers and never exceed the global in-capacity reduction cap", () => {
  assert.equal(capabilitySpoilageBps(capabilityRewards(through("FR5")), 800), 680);
  assert.equal(capabilitySpoilageBps(capabilityRewards(through("FR8")), 800), 600);
  assert.equal(capabilitySpoilageBps(capabilityRewards(through("FR10")), 800), 520);
  assert.equal(capabilitySpoilageBps(capabilityRewards(through("FR10")), 800, 200), 200);
  const extension = capabilityRewards(through("FR7")).farm.storeExtension!;
  assert.deepEqual(extension, { capacity: 500, fee: 80, inputs: { timber: 4, clay: 5 }, workYears: 1, upkeep: 4, householdLimit: 1 });
});

test("paid inquiry and civic service reserve finite payment and require all actual materials", () => {
  const profile = capabilityRewards([...through("PS10"), ...through("PP10")]);
  assert.equal(quoteCapabilityService(profile, "treatise", { cash: 10, inventory: { papyrus: 4, ink: 3 }, payerBudget: 179 }).allowed, false);
  assert.equal(quoteCapabilityService(profile, "treatise", { cash: 10, inventory: { papyrus: 3, ink: 3 }, payerBudget: 180 }).allowed, false);
  const accepted = quoteCapabilityService(profile, "treatise", { cash: 10, inventory: { papyrus: 4, ink: 3 }, payerBudget: 180 });
  assert.equal(accepted.allowed, true); assert.equal(accepted.reservePayment, 180); assert.equal(accepted.workYears, 2); assert.equal(accepted.paidOnCompletion, true);
  const policy = quoteCapabilityService(profile, "policy", { cash: 0, inventory: { papyrus: 4, ink: 3 }, payerBudget: 180 });
  assert.equal(policy.reputation, 5); assert.equal(policy.workYears, 2);
  assert.ok(profile.eligibleCareers.includes("scientist")); assert.ok(profile.eligibleCareers.includes("politician"));
});

test("trade learning adds plans without bypassing stock, payer budgets, annual visits or working cash", () => {
  const base = { side: "buy" as const, quantity: 4, referencePrice: 10, cash: 100, stock: 5, buyerBudget: 100, maxQuantity: 5, visitsRemaining: 1, workAvailable: true };
  assert.equal(quoteCapabilityTrade(capabilityRewards([]), base).allowed, true);
  assert.equal(quoteCapabilityTrade(capabilityRewards([]), { ...base, counteroffer: 9 }).allowed, false);
  const profile = capabilityRewards(through("T10"));
  assert.equal(quoteCapabilityTrade(profile, { ...base, counteroffer: 9 }).allowed, true);
  assert.equal(quoteCapabilityTrade(profile, { ...base, counteroffer: 8 }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...base, counteroffer: 9, npcMinimumPrice: 10 }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...base, scheduled: true, cash: 51 }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...base, scheduled: true, cash: 52 }).cashCost, 52);
  assert.equal(quoteCapabilityTrade(profile, { ...base, visitsRemaining: 0 }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...base, scheduled: true, itemLines: 3 }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...base, scheduled: true, workAvailable: false }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...base, side: "sell", buyerBudget: 39 }).allowed, false);
});


test("quotes reject nonfinite or overflowing inputs before authorizing resource use", () => {
  const profile = capabilityRewards(design.nodes.map(node => node.id));
  assert.equal(quoteCapabilityProduction(profile, { ...recipe("garment"), inputs: { linen: NaN } }).allowed, false);
  assert.equal(quoteCapabilityProduction(profile, { ...recipe("garment"), fee: Number.MAX_SAFE_INTEGER }, { inspected: true }).allowed, false);
  assert.equal(quoteFarmCapabilityPlan(profile, { flood: "normal", crop: "grain", plots: 2, baseFloodBps: Infinity }).allowed, false);
  assert.equal(quoteFarmCapabilityPlan(profile, { flood: "normal", crop: "grain", plots: Number.MAX_SAFE_INTEGER, baseFloodBps: 10000 }).allowed, false);
  assert.equal(quoteCapabilityService(profile, "treatise", { cash: NaN, inventory: { papyrus: 4, ink: 3 }, payerBudget: 180 }).allowed, false);
  assert.equal(quoteCapabilityService(profile, "treatise", { cash: 10, inventory: { papyrus: Infinity, ink: 3 }, payerBudget: 180 }).allowed, false);
  const trade = { side: "buy" as const, quantity: 4, referencePrice: 10, cash: 100, stock: 5, buyerBudget: 100, maxQuantity: 5, visitsRemaining: 1, workAvailable: true };
  assert.equal(quoteCapabilityTrade(profile, { ...trade, visitsRemaining: NaN }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...trade, counteroffer: 9, npcMinimumPrice: NaN }).allowed, false);
  assert.equal(quoteCapabilityTrade(profile, { ...trade, quantity: Number.MAX_SAFE_INTEGER, stock: Number.MAX_SAFE_INTEGER, maxQuantity: Number.MAX_SAFE_INTEGER }).allowed, false);
});
