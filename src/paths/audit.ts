/** Checks that events fit the life-paths rules. Pure; used by the world build and the audit script. */
import type { Condition, Effect, LifeEvent, WorldPack } from "../types.ts";
import { FIELD_IDS } from "./types.ts";

export interface AuditItem { rule: 2 | 3 | 4 | 5; eventId: string; message: string }

/** Spending above pocket money is a household matter. */
export const POCKET_MONEY = 5;
const SPOUSE = /\b(wife|husband|spouse)\b/i;
const OWN_CHILDREN = /\byour (son|daughter|children)\b/i;

function outcomeEffects(event: LifeEvent): Effect[] {
  return event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects));
}

/** A choice effect that spends shared household money or goods. */
export function spendsShared(effect: Effect): boolean {
  if (effect.type === "cash") return effect.delta < -POCKET_MONEY;
  if (effect.type !== "demo") return false;
  const inner = effect.effect;
  return (inner.kind === "grain" || inner.kind === "item") && inner.delta < 0 || inner.kind === "share-grain";
}

function conditions(condition: Condition | undefined): Condition[] {
  if (!condition) return [];
  if (condition.type === "all" || condition.type === "any") return [condition, ...condition.conditions.flatMap(conditions)];
  if (condition.type === "not") return [condition, ...conditions(condition.condition)];
  return [condition];
}

function lowestAge(world: WorldPack, event: LifeEvent): number {
  const stages = world.lifeStages!.stages;
  if (event.stages) return Math.min(...event.stages.map(id => stages.find(stage => stage.id === id)!.minAge));
  let low = event.trigger.type === "age" ? event.trigger.at : 0;
  for (const item of conditions(event.when)) if (item.type === "age" && (item.op === "gte" || item.op === "gt")) low = Math.max(low, item.value + (item.op === "gt" ? 1 : 0));
  return low;
}

function householdAge(world: WorldPack): number {
  const { stages, scopes } = world.lifeStages!;
  return stages.find(stage => stage.id === scopes.household)!.minAge;
}

function ruleTwo(world: WorldPack, event: LifeEvent): string | undefined {
  if (event.mode === "automatic" || !outcomeEffects(event).some(spendsShared)) return undefined;
  if (event.scope !== "household") return "spends shared goods but is not a household decision";
  if (lowestAge(world, event) < householdAge(world) && !event.dependent) return "a household decision reachable before 16 needs a household answer";
  return undefined;
}

function ruleThree(world: WorldPack, event: LifeEvent): string | undefined {
  if (event.fields || !world.paths) return undefined;
  const effects = [...(event.effects ?? []), ...outcomeEffects(event)];
  const taught = FIELD_IDS.filter(field => effects.some(effect =>
    effect.type === "skill" && effect.delta > 0 && effect.skill === world.paths!.fields[field].skills[0] ||
    effect.type === "job" && effect.job !== null && world.paths!.fields[field].jobs.includes(effect.job)));
  return taught.length ? `teaches or offers ${taught.join(", ")} without field tags` : undefined;
}

function ruleFour(world: WorldPack, event: LifeEvent): string | undefined {
  if (event.mode === "automatic" || event.trigger.type !== "random" || !event.stages) return undefined;
  if (lowestAge(world, event) < householdAge(world)) return undefined;
  const causes = conditions(event.when).filter(item => !["all", "any", "not", "age"].includes(item.type));
  return causes.length ? undefined : "an adult decision with no cause beyond age";
}

function ruleFive(event: LifeEvent): string | undefined {
  const text = [event.title, event.text, ...event.choices.map(choice => choice.text)].join(" ");
  const found = conditions(event.when).map(item => item.type);
  if (SPOUSE.test(text) && !found.includes("relationship")) return "mentions a spouse without a relationship condition";
  if (OWN_CHILDREN.test(text) && !found.includes("children")) return "mentions the player's children without a children condition";
  return undefined;
}

export function auditEvents(world: WorldPack): AuditItem[] {
  if (!world.lifeStages) return [];
  const interrupts = new Set([world.health?.careDecision, ...Object.values(world.economy?.moneylender?.events ?? {})]);
  const items: AuditItem[] = [];
  for (const event of world.events) {
    if (interrupts.has(event.id)) continue;
    const checks: Array<[AuditItem["rule"], string | undefined]> = [[2, ruleTwo(world, event)], [3, ruleThree(world, event)], [4, ruleFour(world, event)], [5, ruleFive(event)]];
    for (const [rule, message] of checks) if (message) items.push({ rule, eventId: event.id, message });
  }
  return items;
}
