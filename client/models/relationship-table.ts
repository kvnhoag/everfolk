import type { LifeState, RelationshipTie, WorldPack } from "../../src/types.ts";
import { resolvePartner } from "../../src/people.ts";
import { relationshipLabels, romanticPartnerLabel, visibleRelationshipPeople } from "./relationship-labels.ts";

export interface RelationshipRow {
  id: string;
  name: string;
  roles: string[];
  age: string;
  background: string;
  backgroundDetail?: string;
  occupation: string;
  tie?: RelationshipTie;
  deceased?: boolean;
}

/** Recorded facts only: a person's occupation never establishes a social role. */
function personRow(world: WorldPack, life: LifeState, id: string): RelationshipRow | undefined {
  const person = resolvePartner(world, life, id);
  if (!person) return;
  const origin = "originId" in person ? world.origins.find(item => item.id === person.originId) : undefined;
  return {
    id: person.id, name: person.name, roles: relationshipLabels(world, life, id),
    age: `Age ${life.age + person.ageOffset}`,
    background: origin?.title ?? "Not recorded",
    ...(origin ? { backgroundDetail: origin.text } : {}),
    occupation: person.occupation,
    tie: life.character?.relationships?.partners[id],
  };
}

export function socialRelationshipRows(world: WorldPack, life: LifeState): RelationshipRow[] {
  return visibleRelationshipPeople(world, life).flatMap(person => {
    const row = personRow(world, life, person.id);
    return row && row.roles.length > 0 ? [row] : [];
  });
}

const familyLabels: Record<string, string> = {
  mother: "Mother", father: "Father",
  "maternal-grandmother": "Maternal grandmother", "maternal-grandfather": "Maternal grandfather",
  "paternal-grandmother": "Paternal grandmother", "paternal-grandfather": "Paternal grandfather",
};

/** Family records exist from birth; spouses and children follow accepted events. */
export function familyRelationshipRows(world: WorldPack, life: LifeState): RelationshipRow[] {
  const character = life.character;
  if (!character) return [];
  const rows: RelationshipRow[] = (character.family ?? []).map(member => {
    const deceased = life.age + member.ageOffset >= member.deathAge;
    const origin = world.origins.find(item => item.id === member.originId);
    return {
      id: member.id, name: member.name, roles: [familyLabels[member.relation] ?? member.relation],
      age: deceased ? `Deceased · age ${member.deathAge}` : `Age ${life.age + member.ageOffset}`,
      background: origin?.title ?? "Family background",
      backgroundDetail: member.background,
      occupation: member.occupation, deceased,
    };
  });
  if (character.partnerId && character.relationshipStatus === "married") {
    const spouse = personRow(world, life, character.partnerId);
    if (spouse) rows.push({ ...spouse, roles: [romanticPartnerLabel(world, life) ?? "Spouse"] });
  }
  for (const child of character.children) {
    const age = life.age - child.birthAge;
    if (age < 0) continue;
    rows.push({
      id: child.id, name: child.name, roles: ["Child"],
      age: age === 0 ? "Newborn" : `Age ${age}`,
      background: "Your household",
      backgroundDetail: `Other parent: ${resolvePartner(world, life, child.otherParentId)?.name ?? "Not recorded"}.`,
      occupation: age < 18 ? "No occupation yet" : "Not recorded",
      tie: character.relationships?.children[child.id],
    });
  }
  return rows;
}

export function relationshipBond(value: number, world: WorldPack): string {
  return value >= (world.relationships?.supportThreshold ?? 60) ? "Close"
    : value < (world.relationships?.marriageMinimum ?? 40) ? "Strained" : "Steady";
}
