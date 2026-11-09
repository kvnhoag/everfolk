import type { CharacterActivity, EconomyState, Effect, LifeState, WorldPack } from "./types.ts";

/** Deliberate numeric ceiling keeps all ledger arithmetic safely below 2^53. */
export const ECONOMY_LIMIT = 1_000_000_000_000;

function amount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > ECONOMY_LIMIT) throw new Error(`${label} must stay between 0 and ${ECONOMY_LIMIT}.`);
  return value;
}

export function getAssetValue(world: WorldPack, state: Pick<LifeState, "economy">): number {
  if (!world.economy || !state.economy) return 0;
  return world.economy.assets.reduce((sum, asset) => sum + asset.value * (state.economy!.assets[asset.id] ?? 0), 0);
}

export function getNetWorth(world: WorldPack, state: Pick<LifeState, "economy">): number {
  if (!world.economy || !state.economy) return 0;
  return state.economy.cash + getAssetValue(world, state) - state.economy.debt;
}

export function initialEconomy(world: WorldPack, state: LifeState): EconomyState | undefined {
  if (!world.economy) return;
  // Origin stat arithmetic can carry a binary float residue (0.1 + 0.2).
  // Validated bounds and deltas resolve to whole currency, so round that residue.
  return { cash: amount(Math.round(state.stats[world.economy.stat] * world.economy.unitsPerPoint), "Starting cash"), debt: 0,
    assets: Object.fromEntries(world.economy.assets.map(asset => [asset.id, 0])) };
}

export function syncEconomyStat(world: WorldPack, state: LifeState): void {
  if (!world.economy || !state.economy) return;
  const definition = world.stats[world.economy.stat];
  state.stats[world.economy.stat] = Math.max(definition.min, Math.min(definition.max, getNetWorth(world, state) / world.economy.unitsPerPoint));
}

/** Settle debt only at the engine's annual boundary, after ordinary costs.
 * Repayment transfers existing cash; it never borrows or sells possessions. */
export function repayDebtAutomatically(world: WorldPack, state: LifeState): number {
  if (!world.economy?.autoDebtRepayment || !state.economy || state.phase === "ended") return 0;
  const cash = amount(state.economy.cash, "Cash"), debt = amount(state.economy.debt, "Debt");
  const repaid = Math.min(cash, debt);
  if (repaid === 0) return 0;
  const remainingCash = amount(cash - repaid, "Cash"), remainingDebt = amount(debt - repaid, "Debt");
  state.economy.cash = remainingCash;
  state.economy.debt = remainingDebt;
  syncEconomyStat(world, state);
  return repaid;
}

/** Apply one ledger effect. Insufficient mandatory cash expenses become unpaid debt. */
export function applyEconomyEffect(world: WorldPack, state: LifeState, effect: Effect): boolean {
  if (!world.economy || !state.economy) return false;
  const economy = state.economy;
  const cashDelta = effect.type === "cash" ? effect.delta
    : effect.type === "stat" && effect.stat === world.economy.stat ? effect.delta * world.economy.unitsPerPoint : undefined;
  if (cashDelta !== undefined) {
    if (!Number.isSafeInteger(cashDelta)) throw new Error("Cash changes must be whole currency amounts.");
    const remaining = economy.cash + cashDelta;
    if (remaining < 0) { economy.debt = amount(economy.debt - remaining, "Debt"); economy.cash = 0; }
    else economy.cash = amount(remaining, "Cash");
  } else if (effect.type === "debt") {
    economy.debt = amount(economy.debt + effect.delta, "Debt");
  } else if (effect.type === "asset") {
    const asset = world.economy.assets.find(candidate => candidate.id === effect.asset)!;
    const quantity = amount((economy.assets[effect.asset] ?? 0) + effect.delta, asset.title);
    if (quantity > asset.maxOwned) throw new Error(`${asset.title} is limited to ${asset.maxOwned}.`);
    economy.assets[effect.asset] = quantity;
  } else return false;
  syncEconomyStat(world, state);
  return true;
}

/** Exact, detached projection; no accepted command, random draw or life mutation. */
export function previewEconomyEffects(world: WorldPack, life: LifeState, effects: readonly Effect[]): EconomyState | undefined {
  if (!world.economy || !life.economy) return;
  const state = { ...life, stats: { ...life.stats }, economy: { ...life.economy, assets: { ...life.economy.assets } } };
  for (const effect of effects) {
    if (effect.type === "end") break;
    applyEconomyEffect(world, state, effect);
  }
  return state.economy;
}

/** Every possible voluntary outcome must be affordable in effect order. */
export function financeActivityReason(world: WorldPack, life: LifeState, activity: CharacterActivity): string | undefined {
  if (!world.economy || !life.economy) return;
  for (const outcome of activity.outcomes) {
    const state = { ...life, stats: { ...life.stats }, economy: { ...life.economy, assets: { ...life.economy.assets } } };
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      const delta = effect.type === "cash" ? effect.delta
        : effect.type === "stat" && effect.stat === world.economy.stat ? effect.delta * world.economy.unitsPerPoint : 0;
      if (delta < 0 && state.economy.cash < -delta) return `Needs ${-delta} ${world.economy.currency.short} in cash (you have ${state.economy.cash}).`;
      if (effect.type === "debt" && state.economy.debt + effect.delta < 0) return `You do not owe that much debt (currently ${state.economy.debt} ${world.economy.currency.short}).`;
      if (effect.type === "asset") {
        const asset = world.economy.assets.find(candidate => candidate.id === effect.asset)!;
        const next = (state.economy.assets[effect.asset] ?? 0) + effect.delta;
        if (next < 0) return `You do not own enough ${asset.title.toLowerCase()}.`;
        if (next > asset.maxOwned) return `You can own at most ${asset.maxOwned} ${asset.title.toLowerCase()}.`;
      }
      try { applyEconomyEffect(world, state, effect); } catch (error) { return (error as Error).message; }
    }
  }
}

export function yearlyAssetIncome(world: WorldPack, state: LifeState): number {
  if (!world.economy || !state.economy) return 0;
  return world.economy.assets.reduce((sum, asset) => sum + (asset.yearlyIncome ?? 0) * (state.economy!.assets[asset.id] ?? 0), 0);
}
