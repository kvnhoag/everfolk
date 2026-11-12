import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_RULES, validateCapabilityRules } from "../src/deep-capabilities/rules.ts";
import { evaluateCapabilities, initialCapabilityState, recordCapabilityEvidence, validateCapabilityEvidence, validateCapabilityState } from "../src/deep-capabilities/evaluate.ts";
import type { CapabilityEvidence, CapabilityFact, CapabilityRule, CapabilityState } from "../src/deep-capabilities/types.ts";

const skills = { farming: 100, craft: 100, pottery: 100, carving: 100, sculpture: 100, philosophy: 100, literacy: 100, reckoning: 100, oratory: 100 };
const evidence = (id: string, year: number, kind: CapabilityEvidence["kind"], action: string, facts: Record<string, CapabilityFact> = {}, references?: string[]): CapabilityEvidence =>
  ({ id, year, kind, action, successful: true, facts, ...(references ? { references } : {}) });
const stateWith = (records: CapabilityEvidence[]): CapabilityState => ({ learned: {}, evidence: records.sort((a, b) => a.year - b.year) });
const evaluate = (records: CapabilityEvidence[], options: { rules?: readonly CapabilityRule[]; reputation?: number; scores?: Record<string, number> } = {}) =>
  evaluateCapabilities({ skills: options.scores ?? skills, reputation: options.reputation, year: 100, state: stateWith(records), rules: options.rules });
const isolated = (id: string): CapabilityRule[] => {
  const rule = structuredClone(CAPABILITY_RULES.find(rule => rule.id === id)!);
  return [{ ...rule, depth: 1, prerequisites: { all: [] } }];
};

test("all 65 rules preserve the agreed DAG, eight depth-ten specializations and both Farming parents", () => {
  assert.equal(CAPABILITY_RULES.length, 65);
  assert.equal(CAPABILITY_RULES.filter(rule => rule.depth === 10).length, 8);
  assert.deepEqual(CAPABILITY_RULES.find(rule => rule.id === "F4")!.prerequisites.all, ["F3S", "F3W"]);
  validateCapabilityRules(CAPABILITY_RULES, Object.keys(skills));
  const invalid = structuredClone([...CAPABILITY_RULES]);
  invalid[0].prerequisites.all.push("FC10");
  assert.throws(() => validateCapabilityRules(invalid), /prerequisite/);
  assert.throws(() => validateCapabilityRules(CAPABILITY_RULES, ["craft"]), /proficiency/);
});

test("high scores and ordinary flags cannot learn capabilities without demonstrated work", () => {
  const input = initialCapabilityState();
  const before = structuredClone(input);
  const result = evaluateCapabilities({ skills, stats: { knowledge: 100, bonds: 100, wealth: 100 }, year: 50, state: input });
  assert.deepEqual(result.newlyLearned, []);
  assert.deepEqual(input, before);
  const failed = evidence("failed", 1, "work", "tool-practice", { supervised: true }); failed.successful = false;
  assert.equal(evaluate([failed]).state.learned.A1, undefined);
});

test("successful receipts append immutably, deduplicate exact retries and reject conflicts or invented references", () => {
  const original = initialCapabilityState(), receipt = evidence("tools", 1, "work", "tool-practice", { supervised: true });
  const next = recordCapabilityEvidence(original, receipt);
  assert.equal(original.evidence.length, 0);
  assert.equal(recordCapabilityEvidence(next, receipt).evidence.length, 1);
  assert.throws(() => recordCapabilityEvidence(next, { ...receipt, successful: false }), /Conflicting/);
  assert.throws(() => recordCapabilityEvidence(next, evidence("later", 2, "assessment", "assess-AS10", {}, ["invented"])), /earlier/);
  assert.throws(() => validateCapabilityEvidence(evidence("bad", 2, "work", "tools", { cost: Number.NaN })), /Invalid/);
  const learned = evaluateCapabilities({ skills, year: 1, state: next });
  assert.ok(learned.state.learned.A1);
  assert.deepEqual(next.learned, {});
  assert.deepEqual(evaluateCapabilities({ skills, year: 1, state: next }), learned);
});

function farmingRecords(): CapabilityEvidence[] {
  const h = (id: string, year: number, facts: Record<string, CapabilityFact>) => evidence(id, year, "harvest", "annual-settlement", facts);
  const good = { fullRations: true, seedReserved: true, newEmergencyDebt: 0, grainAfter: 500, annualRation: 240, seedRequired: 10 };
  return [
    evidence("field", 1, "work", "fieldwork"),
    h("seed", 2, { seedDebited: true, seedReserved: true }),
    evidence("soil", 3, "work", "soil-preparation"),
    h("soil-harvest", 3, { preparedSoil: true, plotsRecorded: true }),
    evidence("channels", 3, "work", "channel-maintenance", { feesPaid: true }),
    h("season", 4, { planRecorded: true, plotsRecorded: true, labourRecorded: true, seedReserved: true }),
    h("prepared", 5, { preparedSoil: true, fullSeedAllocation: true, seedDebited: true }),
    ...[6, 7].flatMap(year => [evidence(`care-${year}`, year, "work", "crop-care"), h(`water-${year}`, year, { channelMaintained: true, maintenancePaid: true })]),
    h("grain-plan", 8, { cropPlan: "grain", seedReserved: true }),
    h("flax-plan", 9, { cropPlan: "flax", seedReserved: true }),
    ...[10, 11].map(year => h(`planned-${year}`, year, { planRecorded: true, fullRations: true, reconciled: true })),
    ...[12, 13].map(year => h(`integrated-${year}`, year, { integratedPlan: true, fullRations: true, seedReserved: true, fullSeedAllocation: true })),
    h("preserved", 14, { grainBefore: 300, grainAfter: 300, fullRations: true }),
    h("reserve", 15, good),
    evidence("inspection", 16, "work", "store-inspection", { feesPaid: true }),
    evidence("stock", 16, "reconciliation", "stock-reconciliation", { reconciled: true }),
    h("replenished-1", 17, good), h("replenished-2", 18, good),
    h("coverage-1", 19, good), h("coverage-2", 20, good),
    ...[21, 22, 23].map(year => h(`stable-${year}`, year, good)),
  ];
}

test("the Farming tree is reachable through ordinary-year proof and does not require a lucky low flood", () => {
  const result = evaluate(farmingRecords());
  for (const rule of CAPABILITY_RULES.filter(rule => rule.branch === "Farming")) assert.ok(result.state.learned[rule.id], rule.id);
  const withoutChannel = farmingRecords().filter(record => record.action !== "channel-maintenance");
  assert.equal(evaluate(withoutChannel).state.learned.F4, undefined, "the AND gate must retain Water management");
});

test("reserve proof uses actual grain, rations and seed rather than a bare claim", () => {
  const rule = isolated("FR6");
  const receipt = evidence("reserve", 1, "harvest", "annual-settlement", { fullRations: true, seedReserved: true, grainAfter: 249, annualRation: 240, seedRequired: 10 });
  assert.equal(evaluate([receipt], { rules: rule }).state.learned.FR6, undefined);
  receipt.facts.grainAfter = 250;
  assert.ok(evaluate([receipt], { rules: rule }).state.learned.FR6);
  const gap = [1, 2, 4].map(year => evidence(`year-${year}`, year, "harvest", "annual-settlement", { fullRations: true, seedReserved: true, newEmergencyDebt: 0 }));
  assert.equal(evaluate(gap, { rules: isolated("FR10") }).state.learned.FR10, undefined);
  gap[2].year = 3;
  assert.ok(evaluate(gap, { rules: isolated("FR10") }).state.learned.FR10);
});

test("artisan material preparation needs two paid years in one line, not mixed free practice", () => {
  const rule = isolated("A3");
  const a = evidence("prep1", 1, "work", "prepare-textiles", { paidInputs: true });
  const b = evidence("prep2", 2, "work", "prepare-clay", { paidInputs: true });
  assert.equal(evaluate([a, b], { rules: rule }).state.learned.A3, undefined);
  b.action = "prepare-textiles";
  assert.ok(evaluate([a, b], { rules: rule }).state.learned.A3);
  b.year = 1;
  assert.equal(evaluate([a, b], { rules: rule }).state.learned.A3, undefined);
});

test("tailoring assessment needs paid inspected output, real quantity and two referenced work years", () => {
  const facts = { item: "ceremonial-garment", quantity: 2, quality: 4, paidInputs: true, reconciled: true, inspectionAccepted: true };
  const first = evidence("batch1", 1, "production", "ceremonial-garment", facts);
  const second = evidence("batch2", 2, "production", "ceremonial-garment", { ...facts });
  const final = evidence("review", 3, "assessment", "assess-AT10", { registered: true, accepted: true, paidInputs: true, feesPaid: true, reconciled: true }, ["batch1", "batch2"]);
  assert.ok(evaluate([first, second, final], { rules: isolated("AT10") }).state.learned.AT10);
  second.facts.quantity = 1;
  assert.equal(evaluate([first, second, final], { rules: isolated("AT10") }).state.learned.AT10, undefined);
  second.facts.quantity = 2; second.year = 1;
  assert.equal(evaluate([first, second, final], { rules: isolated("AT10") }).state.learned.AT10, undefined);
});

test("an interrupted monument can prove two work years while producing only once", () => {
  const base = { item: "monument", quality: 4, paidInputs: true, reconciled: true };
  const records = [evidence("stone-year1", 1, "production", "monument", { ...base, quantity: 0 }), evidence("stone-year2", 4, "production", "monument", { ...base, quantity: 1 }),
    evidence("accepted", 4, "assessment", "assess-AS10", { registered: true, accepted: true, paidInputs: true, feesPaid: true, reconciled: true, inspectionAccepted: true }, ["stone-year1", "stone-year2"])];
  assert.ok(evaluate(records, { rules: isolated("AS10") }).state.learned.AS10);
});

test("research synthesis needs three prior distinct records and two independent checks", () => {
  const a = evidence("observation", 1, "exercise", "observation-project", { datasetId: "one" });
  const b = evidence("check1", 2, "exercise", "independent-check", { independentCheck: true, datasetId: "two" });
  const c = evidence("check2", 3, "exercise", "independent-check", { independentCheck: true, datasetId: "three" });
  const synthesis = evidence("synthesis", 4, "exercise", "research-synthesis", {}, [a.id, b.id, c.id]);
  assert.ok(evaluate([a, b, c, synthesis], { rules: isolated("PS9") }).state.learned.PS9);
  c.facts.independentCheck = false;
  assert.equal(evaluate([a, b, c, synthesis], { rules: isolated("PS9") }).state.learned.PS9, undefined);
  synthesis.references = [a.id, b.id, "missing"];
  assert.throws(() => evaluate([a, b, c, synthesis], { rules: isolated("PS9") }), /Unknown/);
});

test("civic assessment checks district reputation and an actually reconciled funded plan", () => {
  const records = [evidence("service1", 1, "exercise", "public-service", { workCompleted: true, reconciled: true }), evidence("service2", 2, "exercise", "public-service", { workCompleted: true, reconciled: true }),
    evidence("civic-review", 3, "assessment", "assess-PP10", { registered: true, accepted: true, paidInputs: true, feesPaid: true, reconciled: true, fundedPlan: true, agreementSecured: true, delivered: true }, ["service1", "service2"])];
  assert.equal(evaluate(records, { rules: isolated("PP10"), reputation: 59 }).state.learned.PP10, undefined);
  assert.ok(evaluate(records, { rules: isolated("PP10"), reputation: 60 }).state.learned.PP10);
  records[2].facts.fundedPlan = false;
  assert.equal(evaluate(records, { rules: isolated("PP10"), reputation: 100 }).state.learned.PP10, undefined);
});

test("commercial production planning accepts either farming or craft, without requiring both", () => {
  const records = [1, 2].map(year => evidence(`supply-${year}`, year, "exercise", "supply-plan", { paidInputs: true, delivered: true, reconciled: true }));
  const scores = { reckoning: 32, literacy: 20, craft: 8, farming: 0 };
  assert.ok(evaluate(records, { rules: isolated("T5"), scores }).state.learned.T5);
  assert.equal(evaluate(records, { rules: isolated("T5"), scores: { ...scores, craft: 0 } }).state.learned.T5, undefined);
  assert.ok(evaluate(records, { rules: isolated("T5"), scores: { ...scores, craft: 0, farming: 8 } }).state.learned.T5);
});

test("a frozen world evaluates its own rules and future receipts cannot unlock present capabilities", () => {
  const receipt = evidence("tools", 2, "work", "tool-practice", { supervised: true });
  const rule = isolated("A1"); rule[0].minimumProficiency.craft = 80;
  assert.equal(evaluate([receipt], { rules: rule, scores: { craft: 79 } }).state.learned.A1, undefined);
  const current = evaluateCapabilities({ skills, year: 1, state: stateWith([receipt]), rules: rule });
  assert.equal(current.state.learned.A1, undefined);
  const malformed = stateWith([receipt]); malformed.evidence.push({ ...receipt, id: "duplicate-year", year: 1 });
  assert.throws(() => validateCapabilityState(malformed, rule), /chronological/);
});


test("source rules are deeply frozen and proof anchors cannot deadlock a node", () => {
  assert.equal(Object.isFrozen(CAPABILITY_RULES[0].proof), true);
  assert.equal(Object.isFrozen(CAPABILITY_RULES[0].prerequisites.all), true);
  const invalid = structuredClone([...CAPABILITY_RULES]);
  invalid[0].proof = { type: "records", count: 1, match: { actions: ["fieldwork"] }, afterNode: "F1" };
  assert.throws(() => validateCapabilityRules(invalid), /deadlocked/);
});
