import demoPack from "../../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import legacyDemoPack from "../../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import type { LifeState, WorldPack } from "../../src/types.ts";
import { registerWorldPack } from "../lib/world-session.ts";

/** Registered at load so a restored demo life can find its engine without changing other worlds. */
registerWorldPack(legacyDemoPack as WorldPack);
export const demoPlayEngine = registerWorldPack(demoPack as WorldPack);

export function createDemoLife(seed = "alexandria-demo"): LifeState {
  return demoPlayEngine.start(seed);
}
