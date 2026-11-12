import { hasFullMarketAccess, isTradingFocus, marketQuote, productionPlan } from "../../src/market.ts";
import { matchesCondition } from "../../src/conditions.ts";
import type { CharacterActivity, Condition, EconomyDefinition, JobDefinition, LifeState, WorldPack } from "../../src/types.ts";

type Resource = EconomyDefinition["assets"][number];
export interface RelevantResource { asset: Resource; reasons: string[] }
export interface MarketCatalogueOptions { showAll?: boolean; query?: string; category?: string }

export { hasFullMarketAccess } from "../../src/market.ts";

/** A missing purchase or stock may be addressed at the market. Keep the other
 * requirements, including negated and alternative conditions, intact. */
function situationCondition(condition: Condition | undefined, life: LifeState): boolean | undefined {
  if (!condition) return true;
  if (condition.type === "asset" || condition.type === "cash") return undefined;
  if (condition.type === "not") {
    const result = situationCondition(condition.condition, life);
    return result === undefined ? undefined : !result;
  }
  if (condition.type === "all" || condition.type === "any") {
    const values = condition.conditions.map(child => situationCondition(child, life));
    if (condition.type === "all") return values.includes(false) ? false : values.includes(undefined) ? undefined : true;
    return values.includes(true) ? true : values.includes(undefined) ? undefined : false;
  }
  return matchesCondition(condition, life);
}

function requiredAssets(condition: Condition | undefined, life: LifeState): string[] {
  if (!condition || situationCondition(condition, life) === false) return [];
  if (condition.type === "all" || condition.type === "any") return condition.conditions.flatMap(child => requiredAssets(child, life));
  if (condition.type === "asset" && ((condition.op === "gte" || condition.op === "eq") && condition.value > 0 || condition.op === "gt" && condition.value >= 0)) return [condition.asset];
  return [];
}

function usefulActivity(activity: CharacterActivity, life: LifeState): boolean {
  // Learning fees already include practice supplies. Career entry must never
  // make the entire catalogue visible before the player chooses that career.
  return activity.category !== "training" && life.age >= (activity.minAge ?? 0) &&
    !activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job")) &&
    situationCondition(activity.when, life) !== false;
}

/** Relevance changes with this life; ownership and committed goods never vanish
 * just because the person takes another occupation. No simulation is changed. */
export function getRelevantResources(world: WorldPack, life: LifeState): RelevantResource[] {
  if (!world.economy) return [];
  const reasons = new Map<string, Set<string>>();
  const add = (id: string, reason: string) => {
    const values = reasons.get(id) ?? new Set<string>(); values.add(reason); reasons.set(id, values);
  };
  const jobId = life.character?.jobId;
  const job = world.character?.jobs.find(candidate => candidate.id === jobId);
  const householdContext = life.age < 18 || !jobId;
  const trading = !!world.economy.market && jobId === world.economy.market.traderJob;
  const usable = new Set((world.character?.activities ?? []).filter(activity => usefulActivity(activity, life)).map(activity => activity.id));
  for (const asset of world.economy.assets) {
    if ((life.economy?.assets[asset.id] ?? 0) > 0) add(asset.id, "In your possessions");
    if (jobId && asset.context?.jobs?.includes(jobId)) add(asset.id, "Your occupation");
    if (householdContext && asset.context?.origins?.includes(life.originId)) add(asset.id, "Your household");
    if (asset.context?.activities?.some(id => usable.has(id))) add(asset.id, "Available work");
    if (trading && world.economy.market?.goods.includes(asset.id) && marketQuote(world, life, asset.id).signals.length) add(asset.id, "Market news");
    if (trading && asset.context?.jobs?.includes(world.economy.market!.traderJob)) add(asset.id, "Trading goods");
  }
  for (const order of life.economy?.market?.orders ?? []) add(order.asset, "Pending order");
  for (const id of Object.keys(job?.production?.inputs ?? {})) add(id, "Production material");
  for (const id of Object.keys(job?.production?.outputs ?? {})) add(id, "Produced by your work");
  for (const activity of world.character?.activities ?? []) {
    if (!usable.has(activity.id)) continue;
    for (const id of requiredAssets(activity.when, life)) add(id, "Available work");
    for (const outcome of activity.outcomes) for (const effect of outcome.effects) {
      if (effect.type === "asset" && effect.delta < 0) add(effect.asset, "Available work");
    }
  }
  return world.economy.assets.flatMap(asset => reasons.has(asset.id) ? [{ asset, reasons: [...reasons.get(asset.id)!] }] : []);
}

/** Trading and purchasing occupations can see the whole market. Other livelihoods
 * use their relevant goods, including when old catalogue controls retain state. */
export function getMarketCatalogue(world: WorldPack, life: LifeState, options: MarketCatalogueOptions = {}) {
  const byId = new Map((world.economy?.assets ?? []).map(asset => [asset.id, asset]));
  const all = (world.economy?.market?.goods ?? []).flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const relevance = new Map(getRelevantResources(world, life).map(item => [item.asset.id, item.reasons]));
  const priority = (asset: Resource) => {
    const reasons = relevance.get(asset.id) ?? [];
    const order = ["Production material", "Produced by your work", "Your occupation", "Pending order", "Available work", "Trading goods", "Market news", "In your possessions", "Your household"];
    return Math.min(...reasons.map(reason => order.indexOf(reason)).filter(index => index >= 0));
  };
  const relevant = all.filter(asset => relevance.has(asset.id)).sort((left, right) => priority(left) - priority(right));
  const isTrader = !!world.economy?.market && life.character?.jobId === world.economy.market.traderJob;
  const canBrowseAll = hasFullMarketAccess(world, life);
  const query = canBrowseAll ? options.query?.trim().toLocaleLowerCase("en-GB") ?? "" : "";
  const category = canBrowseAll ? options.category : undefined;
  const goods = (canBrowseAll && options.showAll !== false ? all : relevant).filter(asset => (!category || asset.category === category) &&
    (!query || `${asset.title} ${asset.category ?? ""} ${asset.description}`.toLocaleLowerCase("en-GB").includes(query)));
  return { all, relevant, goods, relevance, isTrader, canBrowseAll, hiddenCount: all.length - relevant.length,
    categories: [...new Set(all.map(asset => asset.category).filter((category): category is string => !!category))].sort() };
}

/** Firm pending deliveries can be projected without advancing the simulation. */
export function productionWithDeliveries(world: WorldPack, life: LifeState, job: JobDefinition) {
  const assets = { ...life.economy?.assets };
  for (const order of life.economy?.market?.orders ?? []) {
    if (order.side === "buy" && order.settlesAtAge === life.age + 1) assets[order.asset] = (assets[order.asset] ?? 0) + order.quantity;
  }
  const projected = life.economy ? { ...life, economy: { ...life.economy, assets } } : life;
  const plan = productionPlan(world, projected, job);
  return isTradingFocus(world, life) ? { ...plan, batches: 0, inputs: {}, outputs: {} } : plan;
}
