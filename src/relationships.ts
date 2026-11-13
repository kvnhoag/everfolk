import type { Effect, LifeState, Outcome, RelationshipState, RelationshipTie, SocialRole, WorldPack } from "./types.ts";
import { resolvePartner } from "./people.ts";

type ClosenessEffect = Extract<Effect, { type: "closeness" }>;
type SocialRoleEffect = Extract<Effect, { type: "social-role" }>;

/** Roles are independent of the one current romantic relationship. */
export function hasSocialRole(state: LifeState, partner: string, role: SocialRole): boolean {
  return state.character?.relationships?.partners[partner]?.roles?.includes(role) === true;
}

export function socialRoleEffectReason(world: WorldPack, state: LifeState, effect: SocialRoleEffect, allowUnchanged = false): string | undefined {
  if (!world.character?.socialRelationships || !world.relationships || !state.character?.relationships) return "This world has no social relationship roles.";
  if (state.phase === "ended") return "This life has ended.";
  const person = resolvePartner(world, state, effect.partner);
  if (!person || !("metAge" in person)) return "Meet this person before establishing a social relationship.";
  if (state.age < 18 || state.age + person.ageOffset < 18) return "Both people must be at least 18.";
  if (!["friend", "business-partner"].includes(effect.role) && !world.character.extendedSocialRoles) return "This world has no teaching or enemy relationships.";
  if (effect.active && world.character.extendedSocialRoles) {
    const roles = state.character.relationships.partners[effect.partner]?.roles ?? [];
    if (effect.role === "enemy") {
      if (roles.some(role => role !== "enemy")) return `End your cooperative relationships with ${person.name} before becoming enemies.`;
      if (state.character.partnerId === effect.partner && (state.character.relationshipStatus === "courting" || state.character.relationshipStatus === "married")) return "End your romantic relationship before becoming enemies.";
    } else if (roles.includes("enemy")) return `Settle your hostility with ${person.name} before beginning a cooperative relationship.`;
    if (effect.role === "teacher" && roles.includes("disciple") || effect.role === "disciple" && roles.includes("teacher")) return "End the current teaching arrangement before reversing teacher and disciple roles.";
  }
  if (!allowUnchanged && hasSocialRole(state, effect.partner, effect.role) === effect.active) {
    if (effect.role === "friend") return effect.active ? `You are already friends with ${person.name}.` : `You and ${person.name} have not established a friendship.`;
    if (effect.role === "business-partner") return effect.active ? `${person.name} is already your business partner.` : `You have no business partnership with ${person.name}.`;
    return effect.active ? `${person.name} already has the ${effect.role} role in your life.` : `${person.name} has no ${effect.role} relationship with you.`;
  }
}

/** Called only on an accepted detached engine snapshot, with no automatic reward. */
export function applySocialRole(world: WorldPack, state: LifeState, effect: SocialRoleEffect): void {
  const reason = socialRoleEffectReason(world, state, effect, true);
  if (reason) throw new Error(reason);
  introduceRelationship(world, state, effect.partner);
  const tie = state.character!.relationships!.partners[effect.partner];
  const roles = tie.roles ?? [];
  if (effect.active && !roles.includes(effect.role)) tie.roles = [...roles, effect.role];
  else if (!effect.active && roles.includes(effect.role)) {
    const remaining = roles.filter(role => role !== effect.role);
    if (remaining.length) tie.roles = remaining;
    else delete tie.roles;
  }
}

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
  return Boolean(resolvePartner(world, state, partner) &&
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
    const person = resolvePartner(world, state, id);
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
  const name = resolvePartner(world, state, partner)?.name ?? "this person";
  return `Requires closeness ${minimum} with ${name} (currently ${closeness}).`;
}
