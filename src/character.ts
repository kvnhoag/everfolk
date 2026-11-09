import type { CharacterActivity, CharacterState, Condition, Effect, LifeState, WorldPack } from "./types.ts";
import { financeActivityReason } from "./economy.ts";
import { marriageRelationshipReason, socialRoleEffectReason } from "./relationships.ts";
import { resolvePartner } from "./people.ts";

export function initialCharacter(world: WorldPack): CharacterState | undefined {
  if (!world.character) return undefined;
  return {
    skills: Object.fromEntries(Object.entries(world.character.skills).map(([id, skill]) => [id, skill.initial])),
    jobId: null, partnerId: null, relationshipStatus: "single", children: [],
    lastActivityAge: null, lastActivityAges: {},
    ...(world.character.requireIntroductions ? { knownPartnerIds: [] } : {}),
    ...(world.character.proceduralPartners ? { people: {}, datedPartnerIds: [] } : {}),
  };
}

/** People referenced by a personal action, including conditions with stat-only effects. */
export function activityPartnerIds(activity: CharacterActivity): string[] {
  const people = new Set<string>();
  for (const outcome of activity.outcomes) for (const effect of outcome.effects) {
    if (effect.type === "relationship" || effect.type === "social-role") people.add(effect.partner);
    if (effect.type === "closeness" && effect.target === "partner" && effect.partner) people.add(effect.partner);
  }
  const visit = (condition: Condition | undefined): void => {
    if (!condition) return;
    if (condition.type === "known-partner" || condition.type === "social-role" || condition.type === "closeness" && condition.partner) people.add(condition.partner!);
    else if (condition.type === "relationship" && condition.partner) people.add(condition.partner);
    else if (condition.type === "all" || condition.type === "any") condition.conditions.forEach(visit);
    else if (condition.type === "not") visit(condition.condition);
  };
  visit(activity.when);
  return [...people];
}

/** These invariants apply to authored event effects as well as voluntary actions. */
export function characterEffectReason(world: WorldPack, state: LifeState, effect: Effect, allowUnchanged = false): string | undefined {
  if (effect.type === "social-role") return socialRoleEffectReason(world, state, effect, allowUnchanged);
  if (effect.type === "mastery") {
    if (effect.target === "skill" && (!world.character || !state.character)) return "This world has no character skills.";
    return;
  }
  if (effect.type === "condition" || effect.type === "care") {
    if (!world.health || !state.health) return "This world has no health conditions.";
    if (effect.type === "care" && !state.health.conditions.length) return "There is no illness or injury requiring care.";
    return;
  }
  if (effect.type === "closeness") {
    if (!world.relationships || !state.character?.relationships) return "This world has no individual relationships.";
    if (effect.target === "children") return state.character.children.length ? undefined : "There are no children in this household.";
    const partner = effect.partner ?? state.character.partnerId;
    return partner && state.character.relationships.partners[partner] ? undefined : "Meet this person before spending time together.";
  }
  const definition = world.character;
  const character = state.character;
  if (!["skill", "job", "relationship", "introduce", "end-courtship", "divorce", "child"].includes(effect.type)) return;
  if (!definition || !character) return "This world has no character activities.";
  if (effect.type === "job") {
    if (character.jobId === effect.job) return allowUnchanged ? undefined : effect.job ? "You already hold this job." : "You are not currently employed.";
    if (effect.job === null) return;
    const job = definition.jobs.find(candidate => candidate.id === effect.job)!;
    if (state.age < job.minAge) return `${job.title} requires age ${job.minAge}.`;
    const missing = Object.entries(job.requirements ?? {}).filter(([skill, threshold]) => character.skills[skill] < threshold);
    if (missing.length) return `Requires ${missing.map(([skill, threshold]) => `${definition.skills[skill].label} ${threshold} (currently ${character.skills[skill]})`).join(", ")}.`;
  }
  if (effect.type === "relationship") {
    const partner = resolvePartner(world, state, effect.partner);
    if (!partner) return "Meet this person before beginning a relationship.";
    if (definition.requireIntroductions && !character.knownPartnerIds?.includes(effect.partner)) return "Meet this person before beginning a relationship.";
    if (allowUnchanged && character.relationshipStatus === effect.status && character.partnerId === effect.partner) return;
    if (state.age < 18) return "Relationships unlock at age 18.";
    if (state.age + partner.ageOffset < 18) return `${partner.name} must be at least 18.`;
    if (effect.status === "courting") {
      if (character.relationshipStatus === "married") return "End your current marriage before beginning another courtship.";
      if (character.relationshipStatus === "courting" && character.partnerId === partner.id) return `You are already courting ${partner.name}.`;
      if (definition.exclusiveCourtship && character.relationshipStatus === "courting") return "End your current courtship before starting another.";
    } else if (character.relationshipStatus !== "courting" || character.partnerId !== partner.id) {
      return `Court ${partner.name} before proposing marriage.`;
    }
    if (effect.status === "married") {
      const reason = marriageRelationshipReason(world, state, partner.id);
      if (reason) return reason;
    }
  }
  if (effect.type === "end-courtship" && character.relationshipStatus !== "courting") return "You are not currently courting anyone.";
  if (effect.type === "divorce" && character.relationshipStatus !== "married") return "You must be married to divorce.";
  if (effect.type === "child") {
    if (state.age < 18 || character.relationshipStatus !== "married" || !character.partnerId) return "A married adult household is required.";
    const partner = resolvePartner(world, state, character.partnerId);
    if (!partner) return "Both parents must have a recorded identity.";
    if (state.age + partner.ageOffset < 18) return "Both parents must be adults.";
    if (character.children.length >= 8) return "Your household has reached the limit of eight children.";
    const last = character.children.at(-1);
    if (last && state.age - last.birthAge < 2) return `Allow two years between children (next at age ${last.birthAge + 2}).`;
  }
}

export function activityReason(
  world: WorldPack, state: LifeState, activity: CharacterActivity,
  matches: (condition: Condition | undefined, state: LifeState) => boolean,
): string | undefined {
  if (!state.character || !world.character) return "This world has no character activities.";
  if (state.phase === "ended") return "This life has ended.";
  if (state.phase !== "ready") return "Resolve the current decision first.";
  if (activity.usesYearlyActivity !== false && state.character.lastActivityAge === state.age) return "Your major activity for this year is complete. Advance a year to act again.";
  if (state.age < (activity.minAge ?? 0)) return `Available from age ${activity.minAge}.`;
  const lastAge = state.character.lastActivityAges[activity.id];
  const nextAge = lastAge === undefined ? 0 : lastAge + (activity.cooldownYears ?? 1);
  if (state.age < nextAge) return `Available again at age ${nextAge}.`;
  const financeReason = financeActivityReason(world, state, activity);
  if (financeReason) return financeReason;
  if (world.health && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "care")) && state.health?.lastCareAge === state.age) return "Care has already been arranged this year.";
  if (activity.category === "training") {
    const gains = new Set(activity.outcomes.flatMap(outcome => outcome.effects
      .filter(effect => effect.type === "skill" && effect.delta > 0)
      .map(effect => (effect as Extract<Effect, { type: "skill" }>).skill)));
    for (const skill of gains) {
      const definition = world.character.skills[skill];
      const missing = Object.entries(definition.prerequisites ?? {})
        .filter(([prerequisite, threshold]) => state.character!.skills[prerequisite] < threshold);
      if (missing.length) return `Training ${definition.label} requires ${missing.map(([prerequisite, threshold]) =>
        `${world.character!.skills[prerequisite].label} ${threshold} (currently ${state.character!.skills[prerequisite]})`).join("; ")}.`;
    }
  }
  for (const outcome of activity.outcomes) {
    for (const effect of outcome.effects) {
      const reason = characterEffectReason(world, state, effect);
      if (reason) return reason;
    }
  }
  if (!matches(activity.when, state)) {
    const describe = (condition: Condition | undefined): string[] => {
      if (!condition || matches(condition, state)) return [];
      if (condition.type === "all") return condition.conditions.flatMap(describe);
      if (condition.type !== "skill" && condition.type !== "stat") return [];
      const definition = condition.type === "skill" ? world.character!.skills[condition.skill] : world.stats[condition.stat];
      const current = condition.type === "skill" ? state.character!.skills[condition.skill] : state.stats[condition.stat];
      const comparison = { eq: "exactly", ne: "different from", gt: "above", gte: "at least", lt: "below", lte: "at most" }[condition.op];
      return [`${definition.label} ${comparison} ${condition.value} (you have ${current})`];
    };
    const missing = describe(activity.when);
    return missing.length ? `Requires ${missing.join("; ")}.` : "Your household does not yet meet this activity's requirements.";
  }
}
