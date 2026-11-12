import type { LifeState, WorldPack } from "../../src/types.ts";
import { resolvePartner } from "../../src/people.ts";

type ResolvedPerson = NonNullable<ReturnType<typeof resolvePartner>>;

/** Romantic status follows the current partner, never a person's name or job. */
export function romanticPartnerLabel(world: WorldPack, life: LifeState, personId = life.character?.partnerId ?? undefined): string | undefined {
  const character = life.character;
  if (!character || !personId || character.partnerId !== personId) return;
  const person = resolvePartner(world, life, personId);
  if (!person) return;
  if (character.relationshipStatus === "courting") return "Love interest";
  if (character.relationshipStatus !== "married") return;
  const sex = "sex" in person ? person.sex : undefined;
  return sex === "female" ? "Wife" : sex === "male" ? "Husband" : "Spouse";
}

/** Only earned roles are named; friendship and business can coexist with love. */
export function relationshipLabels(world: WorldPack, life: LifeState, personId: string): string[] {
  if (!resolvePartner(world, life, personId)) return [];
  const labels: string[] = [];
  const romantic = romanticPartnerLabel(world, life, personId);
  if (romantic) labels.push(romantic);
  else if (life.character?.datedPartnerIds?.includes(personId)) labels.push("Former partner");
  if (world.character?.socialRelationships) {
    const roles = life.character?.relationships?.partners[personId]?.roles;
    if (roles?.includes("friend")) labels.push("Friend");
    if (roles?.includes("business-partner")) labels.push("Business partner");
    if (world.character.extendedSocialRoles) {
      if (roles?.includes("teacher")) labels.push("Teacher");
      if (roles?.includes("disciple")) labels.push("Disciple");
      if (roles?.includes("enemy")) labels.push("Enemy");
    }
  }
  return labels;
}

function hasSocialRoleHistory(world: WorldPack, life: LifeState, partnerId: string): boolean {
  if (!world.character?.socialRelationships) return false;
  const character = life.character;
  if (!character) return false;

  const socialActionIds = new Set<string>();
  for (const activity of world.character.activities ?? []) {
    if (activity.outcomes?.some(o => o.effects?.some(e => e.type === "social-role" && e.partner === partnerId))) {
      socialActionIds.add(activity.id);
    }
  }
  for (const event of world.events ?? []) {
    for (const choice of event.choices ?? []) {
      if (choice.outcomes?.some(o => o.effects?.some(e => e.type === "social-role" && e.partner === partnerId))) {
        socialActionIds.add(choice.id);
      }
    }
  }
  const lastAges = character.lastActivityAges;
  if (lastAges && Object.keys(lastAges).some(id => socialActionIds.has(id))) return true;
  if (life.journal && life.journal.some(j => socialActionIds.has(j.id))) return true;
  return false;
}

/** Meeting alone stays private; retained releases keep their own catalog rules. */
export function visibleRelationshipPeople(world: WorldPack, life: LifeState): ResolvedPerson[] {
  const definition = world.character, character = life.character;
  if (!definition || !character) return [];
  const known = new Set([
    ...(character.knownPartnerIds ?? []),
    ...(character.partnerId ? [character.partnerId] : []),
    ...character.children.map(child => child.otherParentId),
  ]);
  return definition.partners.flatMap(template => {
    if (definition.requireIntroductions && !known.has(template.id)) return [];
    const person = resolvePartner(world, life, template.id);
    if (!person) return [];
    if (!definition.proceduralPartners) return [person];
    const dated = character.datedPartnerIds?.includes(person.id) === true;
    const roles = definition.socialRelationships ? character.relationships?.partners[person.id]?.roles : undefined;
    const social = roles?.some(role => role === "friend" || role === "business-partner" || definition.extendedSocialRoles && (role === "teacher" || role === "disciple" || role === "enemy")) === true;
    const established = hasSocialRoleHistory(world, life, person.id);
    return dated || social || established ? [person] : [];
  });
}
