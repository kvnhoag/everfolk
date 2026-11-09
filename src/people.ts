import type { CharacterSex, Choice, EncounteredPerson, LifeState, PartnerDefinition, WorldPack } from "./types.ts";
import { nextRandom } from "./random.ts";

/** A new draw belongs only to an accepted birth or introduction, never a view. */
function pick<T>(items: readonly T[], state: LifeState): T {
  if (!items.length) throw new Error("No unused identity remains in the name pool.");
  if (items.length === 1) return items[0];
  const draw = nextRandom(state.rngState);
  state.rngState = draw.state;
  return items[Math.floor(draw.value * items.length)];
}

/** Called on the engine's private birth snapshot only when identity is enabled. */
export function initializeIdentity(world: WorldPack, state: LifeState): void {
  const identity = world.character?.identity;
  if (!identity || !state.character) return;
  const sex = pick<CharacterSex>(["male", "female"], state);
  state.character.sex = sex;
  state.character.name = pick(identity.namePools[sex], state);
  state.character.avatarVariant = pick(Array.from({ length: identity.avatarVariants }, (_, index) => index), state);
}

/** Older named definitions remain available only under their original rules. */
export function resolvePartner(world: WorldPack, state: LifeState, id: string): PartnerDefinition | EncounteredPerson | undefined {
  if (!world.character?.proceduralPartners) return world.character?.partners.find(person => person.id === id);
  const person = state.character?.people?.[id];
  return person && person.metAge <= state.age && state.character?.knownPartnerIds?.includes(id) ? person : undefined;
}

/** Mutates only the detached working snapshot after an actual introduce effect. */
export function encounterPerson(world: WorldPack, state: LifeState, id: string): EncounteredPerson | undefined {
  if (!world.character?.proceduralPartners || !state.character) return;
  const existing = state.character.people?.[id];
  if (existing) return existing;
  const template = world.character.partners.find(person => person.id === id);
  const identity = world.character.identity;
  if (!template || !identity) throw new Error("The encounter has no valid person template.");
  const used = new Set([state.character.name, ...Object.values(state.character.people ?? {}).map(person => person.name)]);
  const pools = {
    male: identity.namePools.male.filter(name => !used.has(name)),
    female: identity.namePools.female.filter(name => !used.has(name)),
  };
  const sexes = (["male", "female"] as const).filter(sex => pools[sex].length > 0);
  const sex = pick(sexes, state);
  const person: EncounteredPerson = {
    ...template,
    name: pick(pools[sex], state),
    sex,
    avatarVariant: pick(Array.from({ length: identity.avatarVariants }, (_, index) => index), state),
    originId: pick(world.origins, state).id,
    metAge: state.age,
  };
  state.character.people ??= {};
  state.character.people[id] = person;
  return person;
}

/** Resolve known names without leaking encounter IDs or drawing future people. */
export function personText(text: string, world: WorldPack, state: LifeState): string {
  if (!world.character?.proceduralPartners) return text;
  return text.replace(/\{person:([a-z][a-z0-9-]*)\}/g, (_match, id: string) => resolvePartner(world, state, id)?.name ?? "someone");
}

/** Text-only projection. IDs, conditions, outcomes and effects retain authority. */
export function visiblePersonChoice<T extends Choice>(choice: T, world: WorldPack, state: LifeState): T {
  if (!world.character?.proceduralPartners) return choice;
  return {
    ...choice,
    text: personText(choice.text, world, state),
    ...(choice.opportunity ? { opportunity: { ...choice.opportunity, label: personText(choice.opportunity.label, world, state) } } : {}),
    outcomes: choice.outcomes.map(outcome => ({
      ...outcome,
      text: personText(outcome.text, world, state),
      ...(outcome.weightModifiers ? { weightModifiers: outcome.weightModifiers.map(modifier => ({ ...modifier, reason: personText(modifier.reason, world, state) })) } : {}),
    })),
  };
}
