/** Presentation-only variation, independent of every gameplay random draw. */
export function portraitVariant(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return (hash >>> 0) % 3;
}

export type AvatarSex = "male" | "female";
export const AVATAR_STAGES = ["infant", "child", "youth", "adult", "middle", "elder"] as const;
export type AvatarStage = typeof AVATAR_STAGES[number];
export const AVATAR_ORIGIN_IDS = ["merchant-household", "artisan-household", "harbor-household", "fishing-household", "bakery-household", "clerk-household", "weaver-household", "delta-newcomers"] as const;

/** New household stories reuse complete shipped lifetimes. These are artwork
 * archetypes, not assertions about royal or occupational clothing. */
export const AVATAR_ORIGIN_ALIASES = {
  "royal-household": "merchant-household",
  "estate-household": "merchant-household",
  "temple-household": "clerk-household",
  "soldier-household": "harbor-household",
  "tenant-farming-household": "delta-newcomers",
  "domestic-service-household": "weaver-household",
  "boatbuilder-household": "artisan-household",
  "musician-household": "weaver-household",
} as const;

/** Resolve portraits and scene actors through the same real asset family. */
export function avatarArtworkOrigin(originId?: string): typeof AVATAR_ORIGIN_IDS[number] | undefined {
  if (!originId) return;
  const mapped = (AVATAR_ORIGIN_ALIASES as Partial<Record<string, typeof AVATAR_ORIGIN_IDS[number]>>)[originId] ?? originId;
  return AVATAR_ORIGIN_IDS.find(id => id === mapped);
}

export function avatarStage(age: number): AvatarStage {
  return age < 3 ? "infant" : age < 13 ? "child" : age < 18 ? "youth" : age < 40 ? "adult" : age < 60 ? "middle" : "elder";
}

/** Three complete lifetime identities; the picker never draws gameplay RNG. */
export function avatarOptions(originId: string, sex: AvatarSex, stage: AvatarStage = "adult"): { variant: number; src: string; label: string }[] {
  const artworkOrigin = avatarArtworkOrigin(originId);
  if (!artworkOrigin || !["male", "female"].includes(sex) || !AVATAR_STAGES.includes(stage)) return [];
  return [0, 1, 2].map(variant => ({ variant, src: `/assets/pixel/portraits/${artworkOrigin}/${sex}/${stage}-${variant}.svg`, label: `Avatar ${variant + 1}` }));
}

/** Unsupported or retained identities deliberately keep the original asset path. */
export function portraitSource({ age = 18, seed = "", originId, sex, avatarVariant }: { age?: number; seed?: string; originId?: string; sex?: AvatarSex; avatarVariant?: number }): string {
  const stage = avatarStage(age);
  const variant = avatarVariant !== undefined && Number.isInteger(avatarVariant) && avatarVariant >= 0 && avatarVariant < 3 ? avatarVariant : portraitVariant(seed);
  return originId && sex && avatarOptions(originId, sex, stage)[variant]?.src || `/assets/pixel/portraits/${stage}-${portraitVariant(seed)}.svg`;
}
