import type { Effect, LifeState, Outcome, RelationshipState, RelationshipTie, WorldPack } from "./types.ts";

type ClosenessEffect = Extract<Effect, { type: "closeness" }>;

/** Older worlds retain their original state shape and behavior. */
export function initialRelationships(world: WorldPack): RelationshipState | undefined {
  return world.relationships && world.character ? { partners: {}, children: {} } : undefined;
}

function relationships(world: WorldPack, state: LifeState, create = false): RelationshipState | undefined {
  if (!world.relationships || !world.character || !state.character) return;
  if (create) state.character.relationships ??= initialRelationships(world);
  return state.character.relationships;
}

function knownPartner(world: WorldPack, state: LifeState, partner: string): boolean {
  return Boolean(world.character?.partners.some(person => person.id === partner) &&
    (state.character?.knownPartnerIds?.includes(partner) || state.character?.partnerId === partner));
}

/** A future candidate never acquires a visible relationship before meeting. */
export function introduceRelationship(world: WorldPack, state: LifeState, partner: string): void {
  if (state.phase === "ended" || !knownPartner(world, state, partner)) return;
  const ties = relationships(world, state, true);
  if (!ties || ties.partners[partner]) return;
  ties.partners[partner] = { closeness: world.relationships!.initialCloseness, lastContactAge: state.age };
}

export function addChildRelationship(world: WorldPack, state: LifeState, childId: string): void {
  if (state.phase === "ended" || !state.character?.children.some(child => child.id === childId && child.birthAge <= state.age)) return;
  const ties = relationships(world, state, true);
  if (!ties || ties.children[childId]) return;
  ties.children[childId] = { closeness: world.relationships!.childCloseness, lastContactAge: state.age };
}

function contact(tie: RelationshipTie, delta: number, age: number): void {
  tie.closeness = Math.max(0, Math.min(100, tie.closeness + delta));
  // An argument is contact too. Annual neglect does not update this timestamp.
  tie.lastContactAge = age;
}

/** Mutates only the engine's private working snapshot. */
export function applyCloseness(world: WorldPack, state: LifeState, effect: ClosenessEffect): void {
  if (!world.relationships || !state.character || state.phase === "ended") return;
  if (effect.target === "partner") {
    const partner = effect.partner ?? state.character.partnerId;
    if (!partner || !knownPartner(world, state, partner)) return;
    introduceRelationship(world, state, partner);
    const tie = state.character.relationships?.partners[partner];
    if (tie) contact(tie, effect.delta, state.age);
  } else {
    for (const child of state.character.children) {
      addChildRelationship(world, state, child.id);
      const tie = state.character.relationships?.children[child.id];
      if (tie) contact(tie, effect.delta, state.age);
    }
  }
}

export function relationshipCloseness(world: WorldPack, state: LifeState, partner?: string): number {
  const id = partner ?? state.character?.partnerId;
  if (!id || !knownPartner(world, state, id)) return 0;
  return relationships(world, state)?.partners[id]?.closeness ?? 0;
}

/** Gradual neglect changes ties; separation is always an explicit authored action. */
export function advanceRelationships(world: WorldPack, state: LifeState, journal: (id: string, text: string) => void): void {
  const config = world.relationships;
  const ties = relationships(world, state);
  if (!config || !ties || !state.character || state.phase === "ended") return;
  const decay = (tie: RelationshipTie, id: string, name: string, visibleWarning: boolean): void => {
    if (state.age - tie.lastContactAge <= config.decayAfterYears || config.yearlyDecay <= 0) return;
    const before = tie.closeness;
    tie.closeness = Math.max(0, before - config.yearlyDecay);
    const crossed = [config.supportThreshold, config.marriageMinimum]
      .some(threshold => before >= threshold && tie.closeness < threshold);
    if (visibleWarning && crossed) journal(`relationship-distance-${id}`, `You and ${name} have spent little time together. Your relationship is less close.`);
  };
  for (const [id, tie] of Object.entries(ties.partners)) {
    const person = world.character!.partners.find(person => person.id === id);
    if (!person || !knownPartner(world, state, id)) continue;
    decay(tie, id, person.name, state.character.partnerId === id);
  }
  for (const [id, tie] of Object.entries(ties.children)) {
    const child = state.character.children.find(child => child.id === id && child.birthAge <= state.age);
    if (child) decay(tie, id, child.name, true);
  }
}

/** A close household caregiver can help recovery, never guarantee survival.
 * Multiple children do not stack an unlimited advantage. */
export function relationshipSupport(world: WorldPack, state: LifeState): number {
  const config = world.relationships;
  const ties = relationships(world, state);
  if (!config || !ties || !state.character || state.phase === "ended") return 0;
  const spouse = state.character.relationshipStatus === "married" && state.character.partnerId &&
    ties.partners[state.character.partnerId]?.closeness >= config.supportThreshold;
  const child = state.character.children.some(child => state.age - child.birthAge >= 12 &&
    (ties.children[child.id]?.closeness ?? -1) >= config.supportThreshold);
  return spouse || child ? Math.max(0, Math.min(1, config.maxHealthSupport)) : 0;
}

/** Only courtship acceptance outcomes change weight. Refusals, appointments,
 * fatal choices and all older-world outcomes keep their authored weights. */
export function relationshipOutcomeWeight(world: WorldPack, state: LifeState, outcome: Outcome): number {
  if (!world.relationships || !state.character || outcome.weight <= 0 || outcome.effects.some(effect => effect.type === "end")) return outcome.weight;
  const courtships = outcome.effects.filter((effect): effect is Extract<Effect, { type: "relationship" }> =>
    effect.type === "relationship" && effect.status === "courting");
  if (!courtships.length) return outcome.weight;
  const baseline = Math.max(1, world.relationships.initialCloseness);
  const multiplier = Math.min(...courtships.map(effect => Math.max(0.1, Math.min(2,
    relationshipCloseness(world, state, effect.partner) / baseline))));
  return outcome.weight * multiplier;
}

export function marriageRelationshipReason(world: WorldPack, state: LifeState, partner: string): string | undefined {
  if (!world.relationships) return;
  const minimum = world.relationships.marriageMinimum;
  const closeness = relationshipCloseness(world, state, partner);
  if (closeness >= minimum) return;
  const name = world.character?.partners.find(person => person.id === partner)?.name ?? "this person";
  return `Requires closeness ${minimum} with ${name} (currently ${closeness}).`;
}
