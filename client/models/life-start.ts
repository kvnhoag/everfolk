import type { LifeState } from "../../src/types.ts";

/** Birth figures and an avatar can be assigned before the player begins a life. */
export function isUnplayedBirth(life: Pick<LifeState, "age" | "phase" | "commands">): boolean {
  return life.age === 0 && life.phase !== "ended" && life.commands.every(command =>
    command.type === "avatar" || command.type === "influence" && command.mode === "activate",
  );
}
