/** Re-export of the shared contract plus the narrowed life type every view takes. */
export * from "./types.ts";
import type { LifeState } from "../types.ts";
import type { DemoState } from "./types.ts";
export type LifeStateWithDemo = LifeState & { demo: DemoState };
