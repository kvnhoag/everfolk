import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { directMoneyDelta, formatMoney } from "./wealth.ts";

/**
 * Cash beside an action's cost, so no action drains the purse unseen and none is offered as if it could be paid when
 * it cannot. Pure.
 */

/** The most an action can cost in cash, from its own effects; 0 when it costs nothing. */
export function cashCost(choice: Pick<Choice, "outcomes">, world: WorldPack): number {
  const deltas = choice.outcomes.map(outcome => directMoneyDelta(outcome.effects, world));
  return deltas.length ? Math.max(0, -Math.min(0, ...deltas)) : 0;
}

export interface CashNote { text: string; affordable: boolean }

/** "You have 80 dr; 60 dr left after." or "Can't afford: costs 20 dr, you have 10 dr."; null for free actions. */
export function cashNote(choice: Pick<Choice, "outcomes">, life: Pick<LifeState, "economy">, world: WorldPack): CashNote | null {
  if (!world.economy || !life.economy) return null;
  const cost = cashCost(choice, world);
  if (cost <= 0) return null;
  const cash = life.economy.cash;
  if (cost > cash) return { affordable: false, text: `Can't afford: costs ${formatMoney(cost, world)}, you have ${formatMoney(cash, world)}.` };
  return { affordable: true, text: `You have ${formatMoney(cash, world)}; ${formatMoney(cash - cost, world)} left after.` };
}
