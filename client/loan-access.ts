import type { CharacterActivity, Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { activityReason } from "../src/character.ts";
import { matchesCondition } from "../src/conditions.ts";
import { applyEconomyEffect } from "../src/economy.ts";

export interface ActivityLoanOffer {
  borrowActivityId: string;
  /** Cash required before the activity starts, across every possible outcome. */
  cost: number;
  shortfall: number;
}

export function isBorrowChoice(choice: Pick<Choice, "outcomes">): boolean {
  return choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan" && effect.action === "borrow"));
}

/** Upfront liquidity, rather than the net price after a possible later reward. */
export function requiredCash(choice: Pick<Choice, "outcomes">, world: WorldPack): number {
  if (!world.economy) return 0;
  let required = 0;
  for (const outcome of choice.outcomes) {
    let running = 0;
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      running += effect.type === "cash" ? effect.delta
        : effect.type === "stat" && effect.stat === world.economy.stat ? effect.delta * world.economy.unitsPerPoint : 0;
      required = Math.max(required, -running);
    }
  }
  return required;
}

/** A read-only offer: the normal guards must all pass after the real contract fee. */
export function activityLoanOffer(world: WorldPack, life: LifeState, activity: CharacterActivity): ActivityLoanOffer | undefined {
  if (!world.economy?.moneylender || !life.economy || !life.character || life.phase !== "ready" || life.age < 18) return;
  // Never offer refinancing, debt payments or an already affordable action.
  if (activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan" || effect.type === "debt" && effect.delta < 0))) return;
  const cost = requiredCash(activity, world), shortfall = cost - life.economy.cash;
  if (shortfall <= 0 || shortfall > world.economy.moneylender.principal || !activityReason(world, life, activity, matchesCondition)) return;
  // Funding cannot supply an unrelated loan-status, debt, skill or household requirement.
  const liquidOnly = { ...life, economy: { ...life.economy, cash: cost } };
  if (activityReason(world, liquidOnly, activity, matchesCondition)) return;
  // An authored contract with other side effects cannot be safely promised here.
  const borrower = world.character?.activities.find(candidate => {
    const effects = candidate.outcomes.length === 1 ? candidate.outcomes[0].effects : [];
    return candidate.usesYearlyActivity === false && effects.length === 1 && effects[0].type === "loan" && effects[0].action === "borrow"
      && !activityReason(world, life, candidate, matchesCondition);
  });
  if (!borrower) return;
  const funded: LifeState = {
    ...life,
    stats: { ...life.stats },
    economy: { ...life.economy, assets: { ...life.economy.assets }, ...(life.economy.loan ? { loan: { ...life.economy.loan } } : {}) },
    character: { ...life.character, lastActivityAges: { ...life.character.lastActivityAges, [borrower.id]: life.age } },
  };
  try { applyEconomyEffect(world, funded, { type: "loan", action: "borrow" }); }
  catch { return; }
  if (activityReason(world, funded, activity, matchesCondition)) return;
  return { borrowActivityId: borrower.id, cost, shortfall };
}

/** Accept both ordinary commands together; any intervening lock leaves the caller's life untouched. */
export function borrowAndAct(engine: LifeEngine, life: LifeState, activityId: string): LifeState {
  const activity = engine.world.character?.activities.find(candidate => candidate.id === activityId);
  const offer = activity && activityLoanOffer(engine.world, life, activity);
  if (!offer) throw new Error("This activity cannot be funded by a moneylender loan right now. No loan was accepted.");
  const funded = engine.act(life, offer.borrowActivityId);
  const action = engine.getActivities(funded).find(candidate => candidate.id === activityId);
  if (!action?.available) throw new Error("The opportunity changed before the loan could fund it. No loan was accepted. Resolve any waiting decision and try again.");
  return engine.act(funded, activityId);
}
