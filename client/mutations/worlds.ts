import type { PublishedWorld } from "../../server/content.ts";
import { SELECTED_WORLD_KEY } from "../lib/world-selection.ts";

export function persistSelectedWorld(storage: Pick<Storage, "setItem">, world: PublishedWorld): void {
  storage.setItem(SELECTED_WORLD_KEY, JSON.stringify(world));
}
