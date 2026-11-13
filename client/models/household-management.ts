import type { LifeState, WorldPack } from "../../src/types.ts";
import { isRoyalLife } from "../../src/royalty.ts";
import { isAristocratLife } from "../../src/aristocracy.ts";

/** Labels and the spendable account follow the life’s own management route. */
export function householdManagement(world: WorldPack, life: LifeState) {
  if (isRoyalLife(world, life) && life.royalty && world.royalty) return {
    kind: "royal" as const, title: "Royal council", treasuryLabel: "Royal treasury", treasury: life.royalty.treasury,
    houseLabel: "Royal house", roleLabel: "Council leadership", minAge: world.royalty.minAge,
    description: "Manage your royal house and treasury.", concerns: "Diplomacy · Security · Succession",
  };
  if (isAristocratLife(world, life) && life.aristocracy && world.aristocracy) return {
    kind: "aristocrat" as const, title: "Estate council", treasuryLabel: "Estate treasury", treasury: life.aristocracy.treasury,
    houseLabel: "Aristocratic estate", roleLabel: "Estate leadership", minAge: world.aristocracy.minAge,
    description: "Manage your estate, tenant agreements and family property.", concerns: "Improvements · Tenants · Inheritance",
  };
  return undefined;
}
