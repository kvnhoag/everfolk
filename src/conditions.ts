import type { Comparison, Condition, LifeState } from "./types.ts";
import { hasSocialRole } from "./relationships.ts";
import { matchesDemoCondition } from "./demo/effects.ts";
import { compareAccount } from "./paths/late-life.ts";

function compare(left: number, op: Comparison, right: number): boolean {
  switch (op) {
    case "eq": return left === right;
    case "ne": return left !== right;
    case "gt": return left > right;
    case "gte": return left >= right;
    case "lt": return left < right;
    case "lte": return left <= right;
  }
}

export function matchesCondition(condition: Condition | undefined, state: LifeState): boolean {
  if (!condition) return true;
  switch (condition.type) {
    case "capability": return Boolean((state.deepCapabilities ?? state.capabilities)?.learned[condition.node]) === (condition.learned ?? true);
    case "vocation": return (state.vocations?.completed[condition.action] ?? 0) >= condition.count;
    case "affinity": return state.paths !== undefined && compare(state.paths.affinity[condition.field], condition.op, condition.value);
    case "field-need": return state.paths?.needs[condition.field].label === condition.label;
    case "field-people": return state.paths !== undefined && compare(state.paths.people[condition.field].reduce((sum, count) => sum + count, 0), condition.op, condition.value);
    case "district": return state.paths?.district === condition.district;
    case "away-from-home": return state.paths !== undefined && state.paths.district !== state.paths.home;
    case "introduced": return state.paths?.introductions.includes(condition.field) === true;
    case "material": return compare(state.vocations?.inventory[condition.item] ?? 0, condition.op, condition.value);
    case "account": return compareAccount(state, condition.account, condition.op, condition.value);
    case "accomplishment": return state.accomplishments?.some(record => record.achievementId === condition.achievement &&
      state.age - record.age >= (condition.minYears ?? 0)) === true;
    case "cash": return state.economy !== undefined && compare(state.economy.cash, condition.op, condition.value);
    case "debt": return state.economy !== undefined && compare(state.economy.debt, condition.op, condition.value);
    case "loan": {
      const loan = state.economy?.loan;
      const active = Boolean(loan && loan.balance > 0);
      return condition.status === "none" ? !active : condition.status === "active" ? active
        : active && (condition.status === "due" ? state.age >= loan!.dueAge : state.age > loan!.dueAge);
    }
    case "loan-overdue": return Boolean(state.economy?.loan && state.economy.loan.balance > 0 &&
      compare(Math.max(0, state.age - state.economy.loan.dueAge), condition.op, condition.value));
    case "asset": return state.economy !== undefined && compare(state.economy.assets[condition.asset] ?? 0, condition.op, condition.value);
    case "stat": return compare(state.stats[condition.stat], condition.op, condition.value);
    case "flag": return state.flags[condition.flag] === condition.value;
    case "age": return compare(state.age, condition.op, condition.value);
    case "year": return compare(state.year, condition.op, condition.value);
    case "origin": return state.originId === condition.origin;
    case "skill": return state.character !== undefined && compare(state.character.skills[condition.skill], condition.op, condition.value);
    case "job": return state.character !== undefined && state.character.jobId === condition.job;
    case "relationship": return state.character !== undefined && state.character.relationshipStatus === condition.status &&
      (condition.partner === undefined || state.character.partnerId === condition.partner);
    case "known-partner": return state.character?.knownPartnerIds?.includes(condition.partner) === true || state.character?.partnerId === condition.partner;
    case "social-role": return hasSocialRole(state, condition.partner, condition.role) === condition.active;
    case "children": return state.character !== undefined && compare(state.character.children.length, condition.op, condition.value);
    case "child-age": return state.character?.children.some(child => {
      const age = state.age - child.birthAge;
      return age >= condition.min && age <= condition.max;
    }) === true;
    case "has-condition": return Boolean(state.health?.conditions.some(item => condition.condition === undefined || item.id === condition.condition));
    case "closeness": {
      const tie = state.character?.relationships?.partners[condition.partner ?? state.character.partnerId ?? ""];
      return tie !== undefined && compare(tie.closeness, condition.op, condition.value);
    }
    case "all": return condition.conditions.every(child => matchesCondition(child, state));
    case "any": return condition.conditions.some(child => matchesCondition(child, state));
    case "not": return !matchesCondition(condition.condition, state);
    case "demo": return matchesDemoCondition(state, condition.condition);
  }
}

