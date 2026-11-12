import type { WorldPack } from "../types.ts";

/** What the merchant pays for a finished good worth `retail`: older packs keep a 25% markup, trade worlds set their own. */
export function merchantBid(world: WorldPack, retail: number): number {
  const trade = world.vocations?.trade;
  return trade ? Math.floor(retail * trade.bidBps / 10_000) : Math.floor(retail * 10000 / 12500);
}

/** What the merchant pays for one finished `item` of grade `quality`. */
export function bid(world: WorldPack, item: string, quality: number): number {
  const recipe = Object.values(world.vocations!.recipes).find(r => r.output === item)!;
  const retail = Math.floor(recipe.baseAsk * [10000, 11500, 13000, 15000, 18000][["thread", "linen"].includes(item) ? 0 : quality - 1] / 10000);
  return merchantBid(world, retail);
}
