import type { WorldPack, StatRange } from '../types.ts';
import { TRADE_ITEMS } from '../demo/types.ts';
import type { TradeItem } from '../demo/types.ts';

/** Authored household reserves for new free-play births, never ranked saves. */
export function configureStartingResources(world: WorldPack): void {
  if (!world.demo || !world.economy) return;
  const profiles: Record<string, Partial<Record<TradeItem, [number, number]>>> = {
    'merchant-household': { grain: [250,450], flax: [0,20], silver: [0,2], linen: [0,4] },
    'artisan-household': { grain: [350,550], flax: [0,10], linen: [0,2] },
    'harbor-household': { grain: [200,400], flax: [0,5] },
    'fishing-household': { grain: [350,550], flax: [0,5] },
    'bakery-household': { grain: [450,700], silver: [0,1] },
    'clerk-household': { grain: [200,350], silver: [0,1] },
    'weaver-household': { grain: [350,550], flax: [20,50], linen: [1,3] },
    'delta-newcomers': { grain: [180,320], flax: [0,10] },
    'royal-household': { grain: [900,1400], silver: [2,5], gold: [0,1], silk: [0,2], linen: [2,5], ox: [0,1], donkey: [0,1] },
    'estate-household': { grain: [800,1200], flax: [10,30], silver: [1,3], linen: [0,2], ox: [1,1], donkey: [0,1] },
    'temple-household': { grain: [350,550], silver: [0,2], linen: [0,2] },
    'soldier-household': { grain: [250,450], silver: [0,1] },
    'tenant-farming-household': { grain: [450,750], flax: [5,20], donkey: [0,1] },
    'domestic-service-household': { grain: [150,280] },
    'boatbuilder-household': { grain: [350,600], flax: [0,10], linen: [0,2] },
    'musician-household': { grain: [200,350], linen: [0,1] },
  };
  const cash: Record<string, [number, number]> = {
    'tenant-farming-household': [4,9], 'artisan-household': [5,12],
    'weaver-household': [5,11], 'boatbuilder-household': [6,14],
    'bakery-household': [5,12], 'fishing-household': [4,10],
  };
  const zero = Object.fromEntries(TRADE_ITEMS.map(id => [id, {min:0,max:0}])) as Record<TradeItem,StatRange>;
  world.demo.startingResources = { defaults: zero, origins: {} };
  world.economy.uncappedResources = true;
  for (const asset of world.economy.assets) {
    delete asset.maxOwned;
    asset.initialRange = {min:0,max:0};
  }
  for (const origin of world.origins) {
    const profile = profiles[origin.id];
    if (!profile) throw new Error(`Missing resource birth profile: ${origin.id}`);
    world.demo.startingResources.origins![origin.id] = Object.fromEntries(Object.entries(profile).map(([id,range]) => [id,{min:range[0],max:range[1]}]));
    if (cash[origin.id]) origin.statRanges = {...origin.statRanges, [world.economy.stat]: {min:cash[origin.id][0],max:cash[origin.id][1]}};
  }
}
