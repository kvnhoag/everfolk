/** A disclosed test policy: a young woodworker who apprentices, takes the apprentice job and practises woodwork every year. */
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const WOODWORK = ["train-craft", "mend-household-sandals", "v-practice-craft"];

export function runWoodworkerPolicy(world: WorldPack, seed: string, untilAge: number, onYear?: (life: LifeState) => void): LifeState {
  const engine = createEngine(world);
  let life = engine.start(seed);
  while (life.age < untilAge && life.phase !== "ended") {
    if (life.phase === "choice") { life = engine.choose(life, engine.getChoices(life)[0].id); continue; }
    if (life.age >= 12) {
      const open = new Set(engine.getActivities(life).filter(activity => activity.available).map(activity => activity.id));
      const wanted = life.character?.jobId === "apprentice" ? WOODWORK : ["v-qualify-apprentice", "v-apprentice-textiles", ...WOODWORK];
      const pick = wanted.find(id => open.has(id));
      if (pick) life = engine.act(life, pick);
      if (life.phase !== "ready") continue;
    }
    life = engine.advance(life);
    onYear?.(life);
  }
  return life;
}
