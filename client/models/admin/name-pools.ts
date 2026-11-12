import type { CharacterDefinition, WorldPack } from "../../../src/types.ts";
import { validateWorld } from "../../../src/validate.ts";

export type NamePoolEdits = { male: string; female: string } | { player: string };
const lines = (text: string) => text.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
const nameKey = (name: string) => name.normalize("NFKC").toLocaleLowerCase("en");

function distinctPool(text: string, label: string): string[] {
  const names = lines(text), seen = new Set<string>();
  for (const name of names) {
    const key = nameKey(name);
    if (seen.has(key)) throw new Error(`${label} contains a duplicate name: ${name}. Names must be distinct regardless of capitalization.`);
    seen.add(key);
  }
  return names;
}

/** Apply to a draft only. Complete-world validation preserves every other rule. */
export function applyNamePoolEdits(world: WorldPack, edits: NamePoolEdits): CharacterDefinition {
  if (!world.character) throw new Error("This world does not define character names.");
  let character: CharacterDefinition;
  if (world.character.identity) {
    if (!("male" in edits)) throw new Error("Edit the male and female name pools separately for this world.");
    const male = distinctPool(edits.male, "Male name pool"), female = distinctPool(edits.female, "Female name pool");
    const maleKeys = new Set(male.map(nameKey));
    const overlap = female.find(name => maleKeys.has(nameKey(name)));
    if (overlap) throw new Error(`The male and female name pools overlap at ${overlap}. Use a distinct name in each pool.`);
    character = { ...world.character, identity: { ...world.character.identity, namePools: { male, female } } };
  } else {
    if (!("player" in edits)) throw new Error("This retained world uses one player name pool.");
    // Retained packs keep their original single-pool validation and identity rules.
    character = { ...world.character, playerNames: lines(edits.player) };
  }
  validateWorld({ ...world, character });
  return character;
}
