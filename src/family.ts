import type { FamilyMember, FamilyRelation, LifeState, WorldPack } from "./types.ts";
import { nextRandom, seedToUint32 } from "./random.ts";

/** Authored household stories, not occupational or lifespan measurements. */
const HOUSEHOLD_BACKGROUNDS: Record<string, { background: string; occupations: readonly string[] }> = {
  "merchant-household": { background: "Raised in a household trading goods from a small harbor shop.", occupations: ["Shopkeeper", "Merchant"] },
  "artisan-household": { background: "Raised among pottery workers sharing a courtyard and workshop.", occupations: ["Potter", "Ceramic decorator"] },
  "harbor-household": { background: "Raised in a household supported by loading and carrying work at the quays.", occupations: ["Quay porter", "Dock laborer"] },
  "fishing-household": { background: "Raised in a coastal household catching and selling fish.", occupations: ["Fisher", "Fish seller"] },
  "bakery-household": { background: "Raised in a household earning its living from a rented bakery.", occupations: ["Baker", "Bread seller"] },
  "clerk-household": { background: "Raised in a household supported by paid writing and record keeping.", occupations: ["Merchant's clerk", "Workshop copyist"] },
  "weaver-household": { background: "Raised in a household preparing thread and weaving cloth for customers.", occupations: ["Weaver", "Thread preparer"] },
  "delta-newcomers": { background: "From a Delta village, with family seeking steady work along the coast.", occupations: ["Field worker", "Quay porter"] },
  "royal-household": { background: "From a fictional minor branch of Egypt's native royal family on a coastal estate.", occupations: ["Royal household representative", "Estate administrator"] },
  "estate-household": { background: "Raised in a landowning household with fields and storage buildings near the coast.", occupations: ["Landowner", "Estate steward"] },
  "temple-household": { background: "Raised in a household serving a local temple and helping keep its records.", occupations: ["Temple attendant", "Temple record keeper"] },
  "soldier-household": { background: "Raised in a garrison household supported partly by military service.", occupations: ["Royal army soldier", "Household worker"] },
  "tenant-farming-household": { background: "Raised in a household cultivating rented Delta land and selling produce on the coast.", occupations: ["Tenant farmer", "Produce seller"] },
  "domestic-service-household": { background: "Raised in a household earning wages through cooking, cleaning and domestic work.", occupations: ["Household cook", "Household worker"] },
  "boatbuilder-household": { background: "Raised beside a shared coastal workyard building and repairing working boats.", occupations: ["Boatbuilder", "Boat repairer"] },
  "musician-household": { background: "Raised in a household performing for small payments at coastal gatherings.", occupations: ["Hired musician", "Performer"] },
};

/** Generate a separate family stream so household detail never rerolls gameplay. */
export function initializeFamily(world: WorldPack, state: LifeState): void {
  const identity = world.character?.identity;
  if (!world.character?.familyBackgrounds || !identity || !state.character) return;
  let randomState = seedToUint32(`${state.seed}:natal-family:${state.originId}`);
  const integer = (minimum: number, maximum: number): number => {
    const draw = nextRandom(randomState);
    randomState = draw.state;
    return minimum + Math.floor(draw.value * (maximum - minimum + 1));
  };
  const used = new Set([state.character.name, ...Object.values(state.character.people ?? {}).map(person => person.name)]);
  const story = HOUSEHOLD_BACKGROUNDS[state.originId] ?? {
    background: world.origins.find(origin => origin.id === state.originId)?.title ?? "Family background unrecorded.",
    occupations: ["Household worker"],
  };
  const motherAge = integer(18, 30), fatherAge = integer(20, 38);
  const relatives: { relation: FamilyRelation; sex: FamilyMember["sex"]; ageOffset: number }[] = [
    { relation: "mother", sex: "female", ageOffset: motherAge },
    { relation: "father", sex: "male", ageOffset: fatherAge },
    { relation: "maternal-grandmother", sex: "female", ageOffset: motherAge + integer(18, 30) },
    { relation: "maternal-grandfather", sex: "male", ageOffset: motherAge + integer(20, 38) },
    { relation: "paternal-grandmother", sex: "female", ageOffset: fatherAge + integer(18, 30) },
    { relation: "paternal-grandfather", sex: "male", ageOffset: fatherAge + integer(20, 38) },
  ];
  const remaining = { male: 3, female: 3 };
  state.character.family = relatives.map(relative => {
    remaining[relative.sex]--;
    // A name may occur in both pools. Keep enough unused names for each sex
    // rather than consuming a scarce shared name before its later relative.
    const names = identity.namePools[relative.sex].filter(name => !used.has(name) &&
      (["male", "female"] as const).every(sex => identity.namePools[sex].filter(candidate => candidate !== name && !used.has(candidate)).length >= remaining[sex]));
    if (!names.length) throw new Error("No unused family identity remains in the name pool.");
    const name = names[integer(0, names.length - 1)];
    used.add(name);
    // Retained family releases keep their original lifespans. Newer worlds
    // apply the household survival roll after every identity has been recorded.
    const minimumDeathAge = relative.relation === "mother" || relative.relation === "father" || relative.relation === "maternal-grandmother"
      ? Math.max(42, relative.ageOffset + 1) : 42;
    return {
      id: `family-${relative.relation}`, ...relative, name,
      originId: state.originId, background: story.background,
      occupation: story.occupations[integer(0, story.occupations.length - 1)],
      deathAge: integer(minimumDeathAge, 85),
    };
  });
  const livingChance = world.character.familyLivingGrandparentChance;
  if (livingChance === undefined) return;
  const grandparents = state.character.family.filter(member => member.relation.includes("grand"));
  const survival = nextRandom(randomState);
  randomState = survival.state;
  const survivor = survival.value < livingChance ? integer(0, grandparents.length - 1) : -1;
  for (const [index, member] of grandparents.entries()) {
    const parentAge = member.relation.startsWith("maternal-") ? motherAge : fatherAge;
    const ageWhenParentBorn = member.ageOffset - parentAge;
    // Authored rarity: most births have no living grandparent. Remembered
    // relatives still survived long enough to have their recorded child.
    member.deathAge = index === survivor ? integer(member.ageOffset + 1, 85)
      : integer(ageWhenParentBorn + 1, member.ageOffset);
  }
}

/** Once deceased, a relative's displayed age stops at their terminal age. */
export function familyMemberAge(member: FamilyMember, playerAge: number): number {
  return Math.min(member.deathAge, playerAge + member.ageOffset);
}

export function familyMemberIsAlive(member: FamilyMember, playerAge: number): boolean {
  return playerAge + member.ageOffset < member.deathAge;
}
