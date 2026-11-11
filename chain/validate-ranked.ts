import type { SaveFile } from "../src/types.ts";
import { canonicalJson } from "../src/random.ts";
import { commandsHash } from "./hash.ts";
import { RARITY_POWER_BPS } from "./ids.ts";
import type { Draw, FigurePick, InfluenceCommand, LifeView } from "./types.ts";

export type RankedCheck = { ok: true } | { ok: false; reason: string };

const fail = (reason: string): RankedCheck => ({ ok: false, reason });
const power = (rarity: number) => (RARITY_POWER_BPS[rarity] ?? RARITY_POWER_BPS[0]) / 10000;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** The world version string the contract records for a save's world. */
export function rankedWorldVersion(save: Pick<SaveFile, "worldId" | "worldVersion">): string {
  return `${save.worldId}-${save.worldVersion}`;
}

/** Figure actions are the first commands of a ranked life, in `figure_picks` order. */
export function activationCommand(pick: FigurePick, contractId: string): InfluenceCommand {
  return { type: "influence", mode: "activate", entry: pick.action_id, power: power(pick.rarity), source: { contractId, tokenId: pick.token_id } };
}

/** A non-empty draw at `step` is the `apply` command at that index of the save. */
export function applyCommand(draw: Draw, contractId: string): InfluenceCommand {
  if (!draw.token_id || !draw.action_id || draw.rarity === null) throw new Error("An empty draw has no influence command.");
  return { type: "influence", mode: "apply", entry: draw.action_id, power: power(draw.rarity), source: { contractId, tokenId: draw.token_id } };
}

/** Checks a finished ranked save against its on-chain record before the verifier replays it. */
export async function validateRankedSave(life: LifeView, save: SaveFile, contractId: string): Promise<RankedCheck> {
  if (life.status !== "alive") return fail("This life has already been minted or abandoned.");
  if (save.seed !== life.seed) return fail("This save does not belong to this ranked life.");
  if (rankedWorldVersion(save) !== life.world_version) return fail("This save was played in a different world version.");

  if (!Array.isArray(save.commands)) return fail("This life was changed after a recorded checkpoint.");
  const commands = save.commands as readonly unknown[];
  const steps = [...life.draws, ...life.checkpoints].map(record => record.step);
  if (steps.some(step => !Number.isInteger(step) || step < 0)) return fail("This life was changed after a recorded checkpoint.");
  const drawSteps = life.draws.map(draw => draw.step);
  if (new Set(drawSteps).size !== drawSteps.length) return fail("Two draws were recorded at the same moment.");
  if (life.draws.some(draw => !draw.token_id && (draw.action_id !== null || draw.rarity !== null))) {
    return fail("A recorded influence is missing from this life.");
  }
  const expected = new Map<number, InfluenceCommand>();
  life.figure_picks.forEach((pick, index) => expected.set(index, activationCommand(pick, contractId)));
  if (life.figure_picks.some((_, index) => !same(commands[index], expected.get(index)))) {
    return fail("The famous figures of this life were not applied at birth.");
  }
  for (const draw of life.draws) {
    if (!draw.token_id) continue;
    const command = applyCommand(draw, contractId);
    if (!same(commands[draw.step], command)) return fail("A recorded influence is missing from this life.");
    expected.set(draw.step, command);
  }
  const stray = commands.some((command, index) => (command as { type?: unknown })?.type === "influence" && !expected.has(index));
  if (stray) return fail("This life contains an influence that was not drawn on chain.");

  for (const record of [...life.draws, ...life.checkpoints]) {
    if (record.step > commands.length || (await commandsHash(commands, record.step)) !== record.commands_hash) {
      return fail("This life was changed after a recorded checkpoint.");
    }
  }
  return { ok: true };
}
