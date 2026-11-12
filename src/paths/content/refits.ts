/**
 * Refits the older free-play events to the life-paths rules: causes for adult decisions, household
 * scope for spending shared goods, field tags for the work they teach, and coherent time frames.
 */
import type { Condition, LifeEvent, WorldPack } from "../../types.ts";
import type { DependentResolution } from "../../life-stages/types.ts";
import type { FieldId } from "../types.ts";
import { FIELD_IDS } from "../types.ts";
import { spendsShared } from "../audit.ts";

interface Refit { cause?: Condition; stages?: string[] }

const has = (item: string, value: number, op: "gte" | "lte" = "gte"): Condition => ({ type: "demo", condition: { kind: "item", item, op, value } } as Condition);
const stat = (id: string, op: "gte" | "lte", value: number): Condition => ({ type: "stat", stat: id, op, value });
const cash = (value: number): Condition => ({ type: "cash", op: "gte", value });
const working: Condition = { type: "not", condition: { type: "job", job: null } };
const district = (...ids: string[]): Condition => ({ type: "any", conditions: ids.map(id => ({ type: "district", district: id })) });
const busyStreets = district("city-quarter", "court-quarter", "garrison");

/** Each adult decision gets the circumstance that makes it happen, not only an age. */
export const REFITS: Record<string, Refit> = {
  "a-letter-from-a-friend": { cause: { type: "skill", skill: "literacy", op: "gte", value: 10 } },
  "adult-the-loaned-tool": { cause: working },
  "adult-an-extra-payment": { cause: { type: "cash", op: "lte", value: 60 } },
  "adult-the-unfamiliar-method": { cause: working },
  "adult-an-invitation": { cause: stat("bonds", "gte", 30) },
  "later-a-question-of-energy": { cause: stat("knowledge", "gte", 30) },
  "later-a-memory-to-share": { cause: stat("knowledge", "gte", 20) },
  "later-a-small-outing": { cause: stat("health", "lte", 60) },
  "later-the-useful-belonging": { cause: stat("wealth", "gte", 20) },
  "adult-a-market-space": { cause: { type: "any", conditions: [has("linen", 1), has("flax", 5), has("grain", 100)] } },
  "adult-a-noisy-neighbor": { cause: busyStreets },
  "adult-a-warehouse-fire": { cause: district("city-quarter", "court-quarter") },
  "adult-robbers-in-a-lane": { cause: cash(20) },
  "later-a-roof-repair": { cause: stat("health", "lte", 70) },
  "later-a-shared-chore": { cause: stat("bonds", "gte", 20) },
  "variety-choice-shared-storage": { cause: has("grain", 100) },
  "variety-choice-extra-change": { cause: cash(10) },
  "variety-choice-wrong-delivery": { cause: cash(20) },
  "variety-choice-relative-stall": { cause: stat("bonds", "gte", 30) },
  "variety-choice-food-purchase": { cause: has("grain", 300, "lte") },
  "variety-choice-late-wages": { cause: working },
  "variety-choice-teach-younger": { cause: working },
  "variety-choice-sort-possession": { cause: stat("wealth", "gte", 20) },
  "rare-abduction": { cause: cash(30) },
  "rare-lost-valuables": { cause: busyStreets },
  "rare-scaffold-collapse": { cause: district("city-quarter", "court-quarter") },
  // Strain in a marriage needs a marriage: adults only. Convoys are a serving soldier's work.
  "relationship-strain": { stages: ["adulthood", "later-life"] },
  "demo-convoy-muster": { stages: ["adulthood", "later-life"] },
  "demo-convoy-road": { stages: ["adulthood", "later-life"] },
};

function withCause(event: LifeEvent, cause: Condition): Condition {
  return event.when ? { type: "all", conditions: [event.when, cause] } : cause;
}

function householdAnswer(event: LifeEvent): DependentResolution | undefined {
  const frugal = event.choices.find(choice => !choice.when && choice.outcomes.every(outcome => !outcome.effects.some(spendsShared)))
    ?? event.choices.find(choice => !choice.when);
  if (!frugal) return undefined;
  return { text: `${event.text} The grown-ups of your household decide what to do.`,
    responses: [{ id: `${event.id}-household-answer`, text: `Your household decides: ${frugal.text.charAt(0).toLowerCase()}${frugal.text.slice(1)}.`, effects: frugal.outcomes[0].effects }] };
}

function fieldsTaught(world: WorldPack, event: LifeEvent): FieldId[] {
  const effects = [...(event.effects ?? []), ...event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))];
  return FIELD_IDS.filter(field => effects.some(effect =>
    effect.type === "skill" && effect.delta > 0 && effect.skill === world.paths!.fields[field].skills[0] ||
    effect.type === "job" && effect.job !== null && world.paths!.fields[field].jobs.includes(effect.job)));
}

function lowestStageAge(world: WorldPack, event: LifeEvent): number {
  if (!event.stages) return 0;
  return Math.min(...event.stages.map(id => world.lifeStages!.stages.find(stage => stage.id === id)!.minAge));
}

/** Returns a new pack whose older events follow the life-paths rules. */
export function refitEvents(world: WorldPack): WorldPack {
  const interrupts = new Set([world.health?.careDecision, ...Object.values(world.economy?.moneylender?.events ?? {})]);
  const householdAge = world.lifeStages!.stages.find(stage => stage.id === world.lifeStages!.scopes.household)!.minAge;
  const events = world.events.map(original => {
    const refit = REFITS[original.id];
    let event: LifeEvent = { ...original, ...(refit?.stages ? { stages: refit.stages } : {}), ...(refit?.cause ? { when: withCause(original, refit.cause) } : {}) };
    if (!event.fields) {
      const taught = fieldsTaught(world, event);
      if (taught.length) event = { ...event, fields: taught };
    }
    const spends = event.mode !== "automatic" && !interrupts.has(event.id) && event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(spendsShared)));
    if (spends && event.scope !== "household") {
      event = { ...event, scope: "household" };
      const ageGate = (event.when?.type === "all" ? event.when.conditions : [event.when]).some(item => item?.type === "age" && item.op === "gte" && item.value >= householdAge);
      if (!event.dependent && lowestStageAge(world, event) < householdAge && !ageGate && event.stages) {
        const answer = householdAnswer(event);
        if (answer) event = { ...event, dependent: answer };
      }
    }
    return event;
  });
  return { ...world, events };
}
