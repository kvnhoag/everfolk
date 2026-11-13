import type { CharacterState, EncounteredPerson, FamilyMember, LifeState, PartnerDefinition, WorldPack } from "../../src/types.ts";
import { familyMemberAge } from "../../src/family.ts";
import { isRoyalLife } from "../../src/royalty.ts";
import { isAristocratLife } from "../../src/aristocracy.ts";
import { avatarStage, portraitVariant } from "./life-background.ts";
import type { AvatarSex, AvatarStage } from "./life-background.ts";
import registry from "./portrait-asset-registry.json" with { type: "json" };

export type PortraitRole = "royalty" | "aristocrat";
export type PortraitWardrobe = "infant" | "child" | "youth" | "everyday" | "work" | "maritime" | "commerce" | "scholarly" | "military" | "elite" | "performance" | PortraitRole;
export interface PortraitInput {
  readonly age?: number;
  readonly seed?: string;
  readonly personKey?: string;
  readonly sex?: AvatarSex;
  readonly avatarVariant?: number;
  readonly jobId?: string | null;
  readonly occupation?: string;
  readonly role?: PortraitRole;
}

/** Derived presentation state. Persisted LifeEngine identity remains authoritative. */
export interface PortraitState {
  readonly schemaVersion: 1;
  readonly libraryId: string;
  readonly subjectKey: string;
  readonly identityKey: string;
  readonly identityId: string;
  readonly bodyTemplate: AvatarSex;
  readonly avatarVariant: number;
  readonly identitySource: "recorded" | "presentation-fallback";
  readonly age: number;
  readonly stage: AvatarStage;
  readonly wardrobeId: PortraitWardrobe;
  readonly selectionReason: "royalty" | "aristocrat" | "job" | "occupation" | "age-default";
  readonly assetId: string;
  readonly combinationKey: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

const assets = new Map(registry.assets.map(asset => [`${asset.identityId}:${asset.stage}:${asset.wardrobeId}`, asset]));
const jobs = new Map(registry.jobs.map(job => [job.id, job]));
const normalOccupation = (value: string) => value.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
interface Clothing { wardrobeId: string; minAge: number }
const occupations = new Map<string, Clothing>();
for (const job of registry.jobs) occupations.set(normalOccupation(job.title), job);
for (const encounter of registry.encounters) occupations.set(normalOccupation(encounter.title), {
  wardrobeId: encounter.wardrobeId, minAge: jobs.get(encounter.jobId ?? "")?.minAge ?? 18,
});

/** Exact authored occupations in src/family.ts, not keyword/name inference. */
const familyClothing: Record<string, Clothing> = {
  "Shopkeeper": { wardrobeId: "commerce", minAge: 18 },
  "Dock laborer": { wardrobeId: "maritime", minAge: 14 },
  "Fisher": { wardrobeId: "maritime", minAge: 16 },
  "Fish seller": { wardrobeId: "commerce", minAge: 18 },
  "Baker": { wardrobeId: "work", minAge: 14 },
  "Bread seller": { wardrobeId: "commerce", minAge: 18 },
  "Weaver": { wardrobeId: "work", minAge: 14 },
  "Thread preparer": { wardrobeId: "work", minAge: 14 },
  "Field worker": { wardrobeId: "work", minAge: 14 },
  "Royal household representative": { wardrobeId: "elite", minAge: 18 },
  "Estate administrator": { wardrobeId: "elite", minAge: 18 },
  "Landowner": { wardrobeId: "elite", minAge: 18 },
  "Temple attendant": { wardrobeId: "everyday", minAge: 18 },
  "Temple record keeper": { wardrobeId: "scholarly", minAge: 18 },
  "Tenant farmer": { wardrobeId: "work", minAge: 14 },
  "Produce seller": { wardrobeId: "commerce", minAge: 18 },
  "Household cook": { wardrobeId: "work", minAge: 14 },
  "Boatbuilder": { wardrobeId: "work", minAge: 14 },
  "Boat repairer": { wardrobeId: "work", minAge: 14 },
  "Performer": { wardrobeId: "performance", minAge: 16 },
};
for (const [occupation, clothing] of Object.entries(familyClothing)) occupations.set(normalOccupation(occupation), clothing);

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** One lookup convention for all 240 shipped combinations; no RNG or mutation. */
export function resolvePortraitState(input: PortraitInput = {}): PortraitState {
  const subjectKey = input.personKey ?? input.seed ?? "unrecorded-person";
  const recordedSex = input.sex === "male" || input.sex === "female";
  // Missing biography gets a stable cosmetic template, never an inferred sex.
  const bodyTemplate = recordedSex ? input.sex! : stableHash(`${subjectKey}:body-template`) % 2 ? "female" : "male";
  const recordedVariant = Number.isInteger(input.avatarVariant) && input.avatarVariant! >= 0 && input.avatarVariant! < 3;
  const avatarVariant = recordedVariant ? input.avatarVariant! : portraitVariant(`${subjectKey}:portrait-variant`);
  const identity = registry.identities.find(identity => identity.sex === bodyTemplate && identity.avatarVariant === avatarVariant)!;
  const age = Number.isFinite(input.age) ? Math.max(0, Math.floor(input.age!)) : 18;
  const stage = avatarStage(age);
  let wardrobeId: PortraitWardrobe = registry.defaultWardrobes[stage] as PortraitWardrobe;
  let selectionReason: PortraitState["selectionReason"] = "age-default";
  const available = (wardrobe: string) => assets.has(`${identity.id}:${stage}:${wardrobe}`);
  const role = registry.roles.find(role => role.roleAlias === input.role);
  if (role && age >= (role.minAge ?? 16) && available(role.wardrobeId)) {
    wardrobeId = role.wardrobeId as PortraitRole;
    selectionReason = role.wardrobeId as PortraitRole;
  } else {
    // An explicit current job wins over an older free-text occupation.
    const currentJob = input.jobId ? jobs.get(input.jobId) : undefined;
    const clothing = input.jobId ? currentJob : input.occupation ? occupations.get(normalOccupation(input.occupation)) : undefined;
    if (clothing && age >= clothing.minAge && available(clothing.wardrobeId)) {
      wardrobeId = clothing.wardrobeId as PortraitWardrobe;
      selectionReason = input.jobId ? "job" : "occupation";
    }
  }
  const combinationKey = `${identity.id}:${stage}:${wardrobeId}`;
  const asset = assets.get(combinationKey);
  if (!asset) throw new Error(`Portrait registry is missing ${combinationKey}.`);
  return Object.freeze({
    schemaVersion: 1, libraryId: registry.libraryId, subjectKey,
    identityKey: `${subjectKey}:${identity.id}`, identityId: identity.id,
    bodyTemplate, avatarVariant, identitySource: recordedSex && recordedVariant ? "recorded" : "presentation-fallback",
    age, stage, wardrobeId, selectionReason, assetId: asset.id, combinationKey,
    src: asset.src, width: registry.dimensions.width, height: registry.dimensions.height,
  });
}

function subjectKey(life: LifeState, kind: string, id: string): string {
  return JSON.stringify([life.worldId, life.worldFingerprint, life.seed, kind, id]);
}

function householdRole(world: WorldPack, life: LifeState): PortraitRole | undefined {
  return isRoyalLife(world, life) ? "royalty" : isAristocratLife(world, life) ? "aristocrat" : undefined;
}

export function playerPortraitState(world: WorldPack, life: LifeState, overrides: { age?: number; avatarVariant?: number } = {}): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "player", "player"), age: overrides.age ?? life.age,
    sex: life.character?.sex, avatarVariant: overrides.avatarVariant ?? life.character?.avatarVariant,
    jobId: life.character?.jobId, role: householdRole(world, life),
  });
}

/** Encounter IDs survive romance/social-label changes. Origin is upbringing only. */
export function personPortraitState(_world: WorldPack, life: LifeState, person: PartnerDefinition | EncounteredPerson): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "person", person.id), age: life.age + person.ageOffset,
    sex: "sex" in person ? person.sex : undefined,
    avatarVariant: "avatarVariant" in person ? person.avatarVariant : undefined,
    occupation: person.occupation,
  });
}

export function familyPortraitState(world: WorldPack, life: LifeState, member: FamilyMember): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "family", member.id), age: familyMemberAge(member, life.age), sex: member.sex,
    occupation: member.occupation,
    role: member.originId === life.originId ? householdRole(world, life) : undefined,
  });
}

export function childPortraitState(world: WorldPack, life: LifeState, child: CharacterState["children"][number]): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "child", child.id), age: life.age - child.birthAge,
    role: householdRole(world, life),
  });
}
