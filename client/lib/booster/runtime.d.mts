import type { BoosterCardView, BoosterSceneOptions } from "../../types/booster.ts";
export interface BoosterController {
  replay(cards: readonly BoosterCardView[]): Promise<void>;
  dispose(): void;
}
export function mountBooster(hostWindow: Window, config: BoosterSceneOptions): BoosterController;
