import type { LifeEvent, WorldPack } from "../src/types.ts";

/**
 * A pending or journaled event by id. Ranked lives also meet events that arrive through on-chain influences
 * (for example a famous figure's school); those live in the world's influence catalog, not in `world.events`.
 */
export function findLifeEvent(world: WorldPack, id: string | null | undefined): LifeEvent | undefined {
  if (!id) return undefined;
  return world.events.find(event => event.id === id) ?? world.influences?.find(entry => entry.event?.id === id)?.event;
}
