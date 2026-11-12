import { CAPABILITY_RULES, validateCapabilityRules } from "./rules.ts";
import type { CapabilityEvidence, CapabilityEvidenceTest, CapabilityEvaluation, CapabilityEvaluationInput, CapabilityFactTest, CapabilityProof, CapabilityRule, CapabilityState } from "./types.ts";

const KINDS = new Set(["work", "production", "harvest", "exercise", "contract", "assessment", "trade", "reconciliation"]);
const scalar = (value: unknown): boolean => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
const safeYear = (year: unknown): year is number => typeof year === "number" && Number.isSafeInteger(year);
const unique = <T>(values: T[]): T[] => [...new Set(values)];
export const initialCapabilityState = (): CapabilityState => ({ learned: {}, evidence: [] });

export function validateCapabilityEvidence(record: CapabilityEvidence): void {
  if (!record || typeof record.id !== "string" || !record.id.trim() || !safeYear(record.year) || !KINDS.has(record.kind)
    || typeof record.action !== "string" || !record.action || typeof record.successful !== "boolean" || !record.facts
    || typeof record.facts !== "object" || Array.isArray(record.facts) || Object.values(record.facts).some(value => !scalar(value))) {
    throw new Error("Invalid capability evidence receipt.");
  }
  if (record.group !== undefined && (typeof record.group !== "string" || !record.group)) throw new Error("Invalid capability project group.");
  if (record.references && (!Array.isArray(record.references) || record.references.some(id => typeof id !== "string" || !id || id === record.id) || new Set(record.references).size !== record.references.length)) throw new Error("Invalid capability evidence references.");
}

export function validateCapabilityState(state: CapabilityState, rules: readonly CapabilityRule[] = CAPABILITY_RULES): void {
  if (!state || !state.learned || typeof state.learned !== "object" || Array.isArray(state.learned) || !Array.isArray(state.evidence)) throw new Error("Invalid capability state.");
  const ids = new Set(rules.map(rule => rule.id)), receipts = new Map<string, CapabilityEvidence>();
  let lastYear = Number.NEGATIVE_INFINITY;
  for (const record of state.evidence) {
    validateCapabilityEvidence(record);
    if (receipts.has(record.id)) throw new Error(`Duplicate capability receipt: ${record.id}`);
    if (record.year < lastYear) throw new Error("Capability receipts must stay in chronological order.");
    for (const id of record.references ?? []) if (!receipts.has(id) || receipts.get(id)!.year > record.year) throw new Error(`Unknown or future capability receipt: ${id}`);
    receipts.set(record.id, record); lastYear = record.year;
  }
  for (const [id, learned] of Object.entries(state.learned)) {
    if (!ids.has(id) || !learned || !safeYear(learned.year) || !Array.isArray(learned.evidenceIds) || unique(learned.evidenceIds).length !== learned.evidenceIds.length
      || learned.evidenceIds.some(source => !receipts.has(source) || !receipts.get(source)!.successful || receipts.get(source)!.year > learned.year)) throw new Error(`Invalid learned capability record: ${id}`);
  }
}

function fingerprint(record: CapabilityEvidence): string {
  return JSON.stringify({ ...record, facts: Object.fromEntries(Object.entries(record.facts).sort(([a], [b]) => a.localeCompare(b))), references: record.references ?? [] });
}

/** Append an engine-derived receipt once. This function never supplies any proficiency or money. */
export function recordCapabilityEvidence(state: CapabilityState, record: CapabilityEvidence): CapabilityState {
  validateCapabilityEvidence(record);
  const existing = state.evidence.find(item => item.id === record.id);
  if (existing) {
    if (fingerprint(existing) !== fingerprint(record)) throw new Error(`Conflicting capability receipt: ${record.id}`);
    return structuredClone(state);
  }
  const known = new Set(state.evidence.map(item => item.id));
  if ((record.references ?? []).some(id => !known.has(id))) throw new Error("Capability receipts may reference only earlier recorded evidence.");
  if (state.evidence.length && record.year < state.evidence[state.evidence.length - 1].year) throw new Error("Capability receipts must stay in chronological order.");
  return { learned: structuredClone(state.learned), evidence: [...structuredClone(state.evidence), structuredClone(record)] };
}

type Context = { input: CapabilityEvaluationInput; state: CapabilityState; receipts: Map<string, CapabilityEvidence> };
type ProofResult = { satisfied: boolean; ids: string[] };

function factMatches(actual: unknown, test: CapabilityFactTest): boolean {
  if (test === null || typeof test !== "object") return actual === test;
  if (test.eq !== undefined && actual !== test.eq) return false;
  if (test.oneOf && !test.oneOf.includes(actual as never)) return false;
  if (test.gte !== undefined && (typeof actual !== "number" || actual < test.gte)) return false;
  if (test.lte !== undefined && (typeof actual !== "number" || actual > test.lte)) return false;
  return actual !== undefined;
}

function distinct(records: CapabilityEvidence[], field: string): number {
  return new Set(records.map(record => record.facts[field]).filter(value => value !== undefined && value !== "")).size;
}

function recordMatches(record: CapabilityEvidence, test: CapabilityEvidenceTest, context: Context, stack: string[] = []): boolean {
  if (!record.successful || record.year > context.input.year || stack.includes(record.id)) return false;
  if (test.kind && record.kind !== test.kind || test.actions && !test.actions.includes(record.action)) return false;
  if (Object.entries(test.facts ?? {}).some(([id, value]) => !factMatches(record.facts[id], value))) return false;
  for (const balance of test.balances ?? []) {
    const available = record.facts[balance.available];
    if (typeof available !== "number") return false;
    let required = 0;
    for (const term of balance.required) {
      const amount = record.facts[term.fact];
      if (typeof amount !== "number" || amount < 0) return false;
      required += amount * (term.bps ?? 10000);
    }
    if (available * 10000 < required) return false;
  }
  if (test.references) {
    const wanted = test.references;
    const referenced = (record.references ?? []).map(id => context.receipts.get(id));
    if (referenced.some(item => !item || !item.successful || item.year > record.year)) return false;
    const receipts = referenced as CapabilityEvidence[];
    if (receipts.length < wanted.minimum) return false;
    const nextStack = [...stack, record.id];
    if (wanted.allMatch && receipts.some(item => !recordMatches(item, wanted.allMatch!, context, nextStack))) return false;
    if (wanted.distinctYears && new Set(receipts.map(item => item.year)).size < wanted.distinctYears) return false;
    if (wanted.distinctBy && distinct(receipts, wanted.distinctBy) < (wanted.minimumDistinct ?? wanted.minimum)) return false;
    if (wanted.matching && receipts.filter(item => recordMatches(item, wanted.matching!, context, nextStack)).length < (wanted.minimumMatching ?? 1)) return false;
    if (wanted.sum && receipts.reduce((total, item) => total + (typeof item.facts[wanted.sum!.fact] === "number" ? Number(item.facts[wanted.sum!.fact]) : 0), 0) < wanted.sum.minimum) return false;
  }
  return true;
}

function evaluateProof(proof: CapabilityProof, context: Context): ProofResult {
  if (proof.type === "all" || proof.type === "any") {
    const results = proof.proofs.map(child => evaluateProof(child, context));
    if (proof.type === "all") return { satisfied: results.every(result => result.satisfied), ids: unique(results.flatMap(result => result.ids)) };
    const accepted = results.find(result => result.satisfied);
    return accepted ?? { satisfied: false, ids: unique(results.flatMap(result => result.ids)) };
  }
  if (proof.type === "context") return { satisfied: (context.input.reputation ?? 0) >= proof.minimum, ids: [] };
  const anchor = proof.afterNode ? context.state.learned[proof.afterNode] : undefined;
  const records = context.state.evidence.filter(record => (!proof.afterNode || anchor && record.year > anchor.year) && recordMatches(record, proof.match, context));
  let satisfied = records.length >= proof.count;
  if (proof.distinctYears) satisfied &&= new Set(records.map(record => record.year)).size >= proof.distinctYears;
  if (proof.distinctBy) satisfied &&= distinct(records, proof.distinctBy) >= (proof.minimumDistinct ?? proof.count);
  if (proof.sum) satisfied &&= records.reduce((total, record) => total + (typeof record.facts[proof.sum!.fact] === "number" ? Number(record.facts[proof.sum!.fact]) : 0), 0) >= proof.sum.minimum;
  if (proof.consecutiveYears) {
    const years = [...new Set(records.map(record => record.year))].sort((a, b) => a - b);
    let current = 0, best = 0;
    years.forEach((year, index) => { current = index && year === years[index - 1] + 1 ? current + 1 : 1; best = Math.max(best, current); });
    satisfied &&= best >= proof.consecutiveYears;
  }
  return { satisfied: Boolean(satisfied), ids: records.map(record => record.id) };
}

function progressFor(rule: CapabilityRule, context: Context) {
  const skills = context.input.skills;
  const missingParents = rule.prerequisites.all.filter(id => !context.state.learned[id]);
  const missingSkills = Object.fromEntries(Object.entries(rule.minimumProficiency).filter(([id, minimum]) => (skills[id] ?? 0) < minimum).map(([id, required]) => [id, { current: skills[id] ?? 0, required }]));
  const missingAlternatives = Boolean(rule.anyProficiency?.length && !rule.anyProficiency.some(group => Object.entries(group).every(([id, minimum]) => (skills[id] ?? 0) >= minimum)));
  const proof = evaluateProof(rule.proof, context);
  return { learned: Boolean(context.state.learned[rule.id]), eligible: !missingParents.length && !Object.keys(missingSkills).length && !missingAlternatives && proof.satisfied,
    missingParents, missingSkills, missingAlternatives, proofSatisfied: proof.satisfied, evidenceIds: unique(proof.ids) };
}

/** Deterministic, side-effect-free automatic learning. Existing learned capabilities remain learned. */
export function evaluateCapabilities(input: CapabilityEvaluationInput): CapabilityEvaluation {
  const rules = input.rules ?? CAPABILITY_RULES;
  validateCapabilityRules(rules);
  validateCapabilityState(input.state, rules);
  if (!safeYear(input.year) || Object.values(input.skills).some(value => !Number.isFinite(value))) throw new Error("Invalid capability evaluation values.");
  const state = structuredClone(input.state), newlyLearned: string[] = [];
  const context: Context = { input, state, receipts: new Map(state.evidence.map(record => [record.id, record])) };
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (state.learned[rule.id]) continue;
      const progress = progressFor(rule, context);
      if (progress.eligible) {
        state.learned[rule.id] = { year: input.year, evidenceIds: progress.evidenceIds };
        newlyLearned.push(rule.id); changed = true;
      }
    }
  }
  return { state, newlyLearned, progress: Object.fromEntries(rules.map(rule => [rule.id, progressFor(rule, context)])) };
}
