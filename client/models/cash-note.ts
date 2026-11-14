import type { ActivityAvailability, Choice, LifeState, WorldPack } from "../../src/types.ts";
import { formatMoney } from "./wealth.ts";

/**
 * Cash beside an action's cost, so no action drains the purse unseen and none is offered as if it could be paid when
 * it cannot. Pure.
 */

export type CashNoteChoice = Pick<Choice, "outcomes"> &
  Partial<Pick<ActivityAvailability, "id" | "category" | "minAge" | "cooldownYears" | "usesYearlyActivity" | "available" | "reason">>;
export type CashNoteLife = Pick<LifeState, "economy"> &
  Partial<Pick<LifeState, "phase" | "age" | "character" | "health">>;

/** The most upfront cash an action can require across its outcomes, stopping at any ending. */
export function cashCost(choice: Pick<Choice, "outcomes">, world: WorldPack): number {
  if (!world.economy) return 0;
  let cost = 0;
  for (const outcome of choice.outcomes) {
    let balance = 0;
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      balance += effect.type === "cash" ? effect.delta
        : effect.type === "stat" && effect.stat === world.economy.stat ? effect.delta * world.economy.unitsPerPoint : 0;
      cost = Math.max(cost, -balance);
    }
  }
  return cost;
}

export interface CashNote { text: string; affordable: boolean }

function isActivityChoice(choice: CashNoteChoice): boolean {
  return "category" in choice || "available" in choice;
}

function isActivityBlockedOnlyByCash(reason: string | undefined): boolean {
  return Boolean(reason && /^Needs\b.*\bin cash\b/i.test(reason));
}

/**
 * "You have 80 dr; 60 dr left after." or "Can't afford: costs 20 dr, you have 10 dr.";
 * null for free actions or when the action's cash note is no longer relevant.
 */
export function cashNote(choice: CashNoteChoice, life: CashNoteLife, world: WorldPack): CashNote | null {
  if (!world.economy || !life.economy) return null;
  if (life.phase === "ended") return null;

  const cost = cashCost(choice, world);
  if (cost <= 0) return null;

  const cash = life.economy.cash;
  if (isActivityChoice(choice)) {
    if (life.phase !== undefined && life.phase !== "ready") return null;
    if (choice.usesYearlyActivity !== false && life.age !== undefined && life.character?.lastActivityAge === life.age) return null;
    if (choice.minAge !== undefined && life.age !== undefined && life.age < choice.minAge) return null;
    if (choice.id !== undefined && life.age !== undefined) {
      const lastAge = life.character?.lastActivityAges?.[choice.id];
      if (lastAge !== undefined && life.age < lastAge + (choice.cooldownYears ?? 1)) return null;
    }
    if (world.health && life.age !== undefined && life.health?.lastCareAge === life.age
      && choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "care"))) {
      return null;
    }
    if (choice.available === false) {
      if (cost <= cash) return null;
      if (choice.reason && !isActivityBlockedOnlyByCash(choice.reason)) return null;
    }
  }

  if (cost > cash) return { affordable: false, text: `Can't afford: costs ${formatMoney(cost, world)}, you have ${formatMoney(cash, world)}.` };
  return { affordable: true, text: `You have ${formatMoney(cash, world)}; ${formatMoney(cash - cost, world)} left after.` };
}
