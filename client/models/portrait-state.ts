import type { CharacterState, EncounteredPerson, FamilyMember, LifeState, PartnerDefinition, WorldPack } from "../../src/types.ts";
import type { NpcPerson } from "../../src/npc/types.ts";
import { familyMemberAge } from "../../src/family.ts";
import { isRoyalLife } from "../../src/royalty.ts";
import { isAristocratLife } from "../../src/aristocracy.ts";
import { avatarStage, portraitVariant } from "./life-background.ts";
import type { AvatarSex, AvatarStage } from "./life-background.ts";
import v3Registry from "./portrait-asset-registry.json" with { type: "json" };
import concept1Registry from "./portrait-concept1-registry.json" with { type: "json" };

export type PortraitSet = "concept1" | "ordinary-v3";
export type PortraitRole = "royalty" | "aristocrat";
export type PortraitSpecialRole = PortraitRole | "banker";
export type PortraitWardrobe =
  | "infant" | "child" | "youth" | "everyday" | "work" | "maritime" | "commerce"
  | "scholarly" | "military" | "elite" | "performance" | "banker" | PortraitRole;

export interface PortraitInput {
  readonly age?: number;
  readonly seed?: string;
  readonly personKey?: string;
  readonly sex?: AvatarSex;
  readonly avatarVariant?: number;
  readonly jobId?: string | null;
  readonly occupation?: string;
  readonly role?: PortraitSpecialRole;
  readonly portraitSet?: PortraitSet;
}

/** Derived presentation state. Persisted LifeEngine identity remains authoritative. */
export interface PortraitState {
  readonly schemaVersion: 1;
  readonly portraitSet: PortraitSet;
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
  readonly selectionReason: "royalty" | "aristocrat" | "banker" | "job" | "occupation" | "age-default";
  readonly assetId: string;
  readonly combinationKey: string;
  readonly src: string;
  readonly fallbackSrc: string;
  readonly width: number;
  readonly height: number;
}

interface Clothing { readonly wardrobeId: string; readonly minAge: number }
interface RegistryShape {
  readonly libraryId: string;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly identities: readonly { readonly id: string; readonly sex: string; readonly avatarVariant: number }[];
  readonly defaultWardrobes: Readonly<Record<string, string>>;
  readonly stageWardrobes: Readonly<Record<string, readonly string[]>>;
  readonly jobs: readonly { readonly id: string; readonly title: string; readonly wardrobeId: string; readonly minAge: number }[];
  readonly occupationAliases?: readonly { readonly title: string; readonly wardrobeId: string; readonly minAge: number }[];
  readonly encounters: readonly { readonly id: string; readonly title: string; readonly jobId: string | null; readonly wardrobeId: string }[];
  readonly roles: readonly { readonly roleAlias: string; readonly wardrobeId: string; readonly minAge?: number }[];
}

const normalOccupation = (value: string) => value.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

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

function buildLookup(source: RegistryShape) {
  const jobs = new Map(source.jobs.map(job => [job.id, job]));
  const occupations = new Map<string, Clothing>();
  for (const job of source.jobs) occupations.set(normalOccupation(job.title), job);
  for (const alias of source.occupationAliases ?? []) occupations.set(normalOccupation(alias.title), alias);
  for (const encounter of source.encounters) {
    occupations.set(normalOccupation(encounter.title), {
      wardrobeId: encounter.wardrobeId,
      minAge: jobs.get(encounter.jobId ?? "")?.minAge ?? 18,
    });
  }
  for (const [occupation, clothing] of Object.entries(familyClothing)) {
    occupations.set(normalOccupation(occupation), clothing);
  }
  return { source, jobs, occupations };
}

const v3Catalog = buildLookup(v3Registry);
const concept1Catalog = buildLookup(concept1Registry);
const v3Assets = new Map(v3Registry.assets.map(asset => [`${asset.identityId}:${asset.stage}:${asset.wardrobeId}`, asset]));
const concept1Routes = new Map(Object.entries(concept1Registry.combinationRoutes));
const concept1PersonOverrides = new Map<string, { readonly file: string; readonly wardrobeId: string }>(
  Object.entries(concept1Registry.personOverrides),
);
const concept1Portraits = new Map(Object.entries(concept1Registry.portraits));

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** Resolve either Concept 1 in-game portraits or ordinary-v3 legacy/NFT portraits; no RNG or mutation. */
export function resolvePortraitState(input: PortraitInput = {}): PortraitState {
  const portraitSet: PortraitSet = input.portraitSet ?? "concept1";
  const catalog = portraitSet === "ordinary-v3" ? v3Catalog : concept1Catalog;
  const registry = catalog.source;
  const subjectKey = input.personKey ?? input.seed ?? "unrecorded-person";
  const recordedSex = input.sex === "male" || input.sex === "female";
  // Missing biography gets a stable cosmetic template, never an inferred sex.
  const bodyTemplate = recordedSex ? input.sex! : stableHash(`${subjectKey}:body-template`) % 2 ? "female" : "male";
  const recordedVariant = Number.isInteger(input.avatarVariant) && input.avatarVariant! >= 0 && input.avatarVariant! < 3;
  const avatarVariant = recordedVariant ? input.avatarVariant! : portraitVariant(`${subjectKey}:portrait-variant`);
  const identity = registry.identities.find(item => item.sex === bodyTemplate && item.avatarVariant === avatarVariant)!;
  const age = Number.isFinite(input.age) ? Math.max(0, Math.floor(input.age!)) : 18;
  const stage = avatarStage(age);
  let wardrobeId: PortraitWardrobe = registry.defaultWardrobes[stage] as PortraitWardrobe;
  let selectionReason: PortraitState["selectionReason"] = "age-default";
  const available = (wardrobe: string) =>
    portraitSet === "ordinary-v3"
      ? v3Assets.has(`${identity.id}:${stage}:${wardrobe}`)
      : concept1Routes.has(`${bodyTemplate}:${stage}:${wardrobe}`);

  const role = registry.roles.find(item => item.roleAlias === input.role);
  if (role && age >= (role.minAge ?? 16) && available(role.wardrobeId)) {
    wardrobeId = role.wardrobeId as PortraitRole | "banker";
    selectionReason = role.wardrobeId as PortraitRole | "banker";
  } else {
    // An explicit current job wins over an older free-text occupation.
    const currentJob = input.jobId ? catalog.jobs.get(input.jobId) : undefined;
    const clothing = input.jobId
      ? currentJob
      : input.occupation
        ? catalog.occupations.get(normalOccupation(input.occupation))
        : undefined;
    if (clothing && age >= clothing.minAge && available(clothing.wardrobeId)) {
      wardrobeId = clothing.wardrobeId as PortraitWardrobe;
      selectionReason = input.jobId ? "job" : "occupation";
    } else if (portraitSet === "concept1" && !input.jobId && !input.occupation) {
      const override = concept1PersonOverrides.get(subjectKey);
      if (override && available(override.wardrobeId)) {
        wardrobeId = override.wardrobeId as PortraitWardrobe;
        selectionReason = override.wardrobeId === "banker" ? "banker" : "occupation";
      }
    }
  }

  const combinationKey = `${identity.id}:${stage}:${wardrobeId}`;
  const v3Wardrobe = wardrobeId === "banker" ? "commerce" : wardrobeId;
  const fallbackAsset = v3Assets.get(`${identity.id}:${stage}:${v3Wardrobe}`) ?? v3Assets.get(`${identity.id}:${stage}:${v3Registry.defaultWardrobes[stage]}`);
  if (!fallbackAsset) throw new Error(`Portrait registry is missing ${combinationKey}.`);

  if (portraitSet === "ordinary-v3") {
    const asset = v3Assets.get(combinationKey);
    if (!asset) throw new Error(`Portrait registry is missing ${combinationKey}.`);
    return Object.freeze({
      schemaVersion: 1,
      portraitSet,
      libraryId: v3Registry.libraryId,
      subjectKey,
      identityKey: `${subjectKey}:${identity.id}`,
      identityId: identity.id,
      bodyTemplate,
      avatarVariant,
      identitySource: recordedSex && recordedVariant ? "recorded" : "presentation-fallback",
      age,
      stage,
      wardrobeId,
      selectionReason,
      assetId: asset.id,
      combinationKey,
      src: asset.src,
      fallbackSrc: fallbackAsset.src,
      width: v3Registry.dimensions.width,
      height: v3Registry.dimensions.height,
    });
  }

  const override = concept1PersonOverrides.get(subjectKey);
  const route = (override && wardrobeId === override.wardrobeId ? concept1Portraits.get(override.file) : undefined)
    ?? concept1Routes.get(`${bodyTemplate}:${stage}:${wardrobeId}`);
  if (!route) throw new Error(`Concept 1 portrait registry is missing ${bodyTemplate}:${stage}:${wardrobeId}.`);
  return Object.freeze({
    schemaVersion: 1,
    portraitSet,
    libraryId: concept1Registry.libraryId,
    subjectKey,
    identityKey: `${subjectKey}:${identity.id}`,
    identityId: identity.id,
    bodyTemplate,
    avatarVariant,
    identitySource: recordedSex && recordedVariant ? "recorded" : "presentation-fallback",
    age,
    stage,
    wardrobeId,
    selectionReason,
    assetId: route.id,
    combinationKey,
    src: route.src,
    fallbackSrc: fallbackAsset.src,
    width: concept1Registry.dimensions.width,
    height: concept1Registry.dimensions.height,
  });
}

function subjectKey(life: LifeState, kind: string, id: string): string {
  return JSON.stringify([life.worldId, life.worldFingerprint, life.seed, kind, id]);
}

export function playerHouseholdRole(world: WorldPack, life: LifeState): PortraitRole | undefined {
  return isRoyalLife(world, life) ? "royalty" : isAristocratLife(world, life) ? "aristocrat" : undefined;
}

export function playerPortraitState(
  world: WorldPack,
  life: LifeState,
  overrides: { age?: number; avatarVariant?: number; portraitSet?: PortraitSet } = {},
): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "player", "player"),
    age: overrides.age ?? life.age,
    sex: life.character?.sex,
    avatarVariant: overrides.avatarVariant ?? life.character?.avatarVariant,
    jobId: life.character?.jobId,
    role: playerHouseholdRole(world, life),
    portraitSet: overrides.portraitSet,
  });
}

/** Encounter IDs survive romance/social-label changes. Origin is upbringing only. */
export function personPortraitState(
  _world: WorldPack,
  life: LifeState,
  person: PartnerDefinition | EncounteredPerson,
  portraitSet?: PortraitSet,
): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "person", person.id),
    age: life.age + person.ageOffset,
    sex: "sex" in person ? person.sex : undefined,
    avatarVariant: "avatarVariant" in person ? person.avatarVariant : undefined,
    occupation: person.occupation,
    portraitSet,
  });
}

export function familyPortraitState(
  world: WorldPack,
  life: LifeState,
  member: FamilyMember,
  portraitSet?: PortraitSet,
): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "family", member.id),
    age: familyMemberAge(member, life.age),
    sex: member.sex,
    occupation: member.occupation,
    role: member.originId === life.originId ? playerHouseholdRole(world, life) : undefined,
    portraitSet,
  });
}

export function childPortraitState(
  world: WorldPack,
  life: LifeState,
  child: CharacterState["children"][number],
  portraitSet?: PortraitSet,
): PortraitState {
  return resolvePortraitState({
    personKey: subjectKey(life, "child", child.id),
    age: life.age - child.birthAge,
    role: playerHouseholdRole(world, life),
    portraitSet,
  });
}

const TOWN_FIGURE_JOBS = {
  merchant: "merchant",
  grower: "farmer",
  army: "quartermaster",
} as const;

export interface TownFigurePortraitInput {
  readonly role: keyof typeof TOWN_FIGURE_JOBS;
  readonly age: number;
  readonly sex: AvatarSex;
  readonly avatarVariant: number;
}

export function townFigurePortraitState(figure: TownFigurePortraitInput, portraitSet?: PortraitSet): PortraitState {
  return resolvePortraitState({
    personKey: `town:${figure.role}`,
    age: figure.age,
    sex: figure.sex,
    avatarVariant: figure.avatarVariant,
    jobId: TOWN_FIGURE_JOBS[figure.role],
    portraitSet,
  });
}

export function moneylenderPortraitState(world?: WorldPack, portraitSet?: PortraitSet): PortraitState {
  return resolvePortraitState({
    personKey: "town:moneylender",
    age: 52,
    sex: "male",
    avatarVariant: 2,
    jobId: "banker",
    occupation: world?.economy?.moneylender?.title ?? "Harbor moneylender",
    portraitSet,
  });
}

const MALE_NPC_NAMES = new Set(["Damon", "Menedemos", "Sostratos", "Nikon"]);
const FEMALE_NPC_NAMES = new Set(["Thais", "Berenike", "Myrine", "Phile"]);

export function npcPortraitState(
  world: WorldPack,
  life: LifeState,
  npc: Pick<NpcPerson, "id" | "name" | "role" | "born" | "familyId">,
  portraitSet?: PortraitSet,
): PortraitState {
  const age = Math.max(0, life.year - npc.born);
  const family = npc.familyId
    ? life.character?.family?.find(member => member.id === npc.familyId)
    : undefined;
  const familyRole = family?.originId === life.originId ? playerHouseholdRole(world, life) : undefined;
  const namedSex = MALE_NPC_NAMES.has(npc.name) ? "male" : FEMALE_NPC_NAMES.has(npc.name) ? "female" : undefined;
  if (npc.role === "caregiver-a" || npc.role === "caregiver-b") {
    return resolvePortraitState({
      personKey: family ? `family:${family.id}` : `npc:${npc.id}`,
      age,
      sex: family?.sex ?? (npc.role === "caregiver-a" ? "female" : "male"),
      occupation: family?.occupation,
      role: familyRole,
      portraitSet,
    });
  }
  if (npc.role === "mentor") {
    return resolvePortraitState({
      personKey: `npc:${npc.id}`,
      age,
      sex: namedSex ?? "female",
      jobId: "philosophy-tutor",
      portraitSet,
    });
  }
  if (npc.role === "merchant") {
    return resolvePortraitState({
      personKey: `npc:${npc.id}`,
      age,
      sex: namedSex ?? "male",
      jobId: "merchant",
      portraitSet,
    });
  }
  return resolvePortraitState({
    personKey: `npc:${npc.id}`,
    age,
    sex: namedSex ?? "male",
    portraitSet,
  });
}
