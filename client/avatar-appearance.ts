import type { AvatarSex, AvatarStage } from "./life-background.ts";

/** Shared presentation data for portrait and full-body scene artwork. */
export const AVATAR_APPEARANCE_ORIGINS = [
  { id: "merchant-household", title: "Merchant household", background: "#d6b778", accent: "#e4b651", motif: "accounts" },
  { id: "artisan-household", title: "Pottery-worker household", background: "#edcf91", accent: "#ba704c", motif: "pots" },
  { id: "harbor-household", title: "Quay-laborer household", background: "#b8d2c4", accent: "#41637b", motif: "quay" },
  { id: "fishing-household", title: "Fishing household", background: "#76b5b1", accent: "#4e8f9a", motif: "net" },
  { id: "bakery-household", title: "Bakery household", background: "#edcf91", accent: "#8c4947", motif: "oven" },
  { id: "clerk-household", title: "Clerk's household", background: "#f5e6bf", accent: "#41637b", motif: "papyrus" },
  { id: "weaver-household", title: "Weaving household", background: "#b8d2c4", accent: "#8c4947", motif: "loom" },
  { id: "delta-newcomers", title: "Newcomers from the Delta", background: "#b8d2c4", accent: "#6b8051", motif: "reeds" },
] as const;

export type AvatarHairStyle = "short-curls" | "side-part" | "rounded-crop" | "bun" | "side-braid" | "headband";
export type AvatarFacialHair = "none" | "full" | "chin";
export interface AvatarAppearance {
  readonly originId: string;
  readonly sex: AvatarSex;
  readonly variant: number;
  readonly stage: AvatarStage;
  readonly identityKey: string;
  readonly skin: string;
  readonly shade: string;
  readonly baseHair: string;
  readonly hair: string;
  readonly robe: string;
  readonly robeDark: string;
  readonly mantle: string;
  readonly accent: string;
  readonly background: string;
  readonly motif: string;
  readonly hairStyle: AvatarHairStyle;
  readonly facialHair: AvatarFacialHair;
  readonly faceShape: "broad" | "narrow" | "round";
  readonly eyeOffset: number;
  readonly infantBinding: "fold" | "cross";
}

const STAGES: readonly AvatarStage[] = ["infant", "child", "youth", "adult", "middle", "elder"];
const IDENTITIES = [
  { skin: "#bf8b62", shade: "#91644c", hair: "#483d38", robe: "#41637b", robeDark: "#304c60", faceShape: "broad", eyeOffset: 0 },
  { skin: "#d9a579", shade: "#bf8b62", hair: "#65503e", robe: "#6b8051", robeDark: "#4c623d", faceShape: "narrow", eyeOffset: 1 },
  { skin: "#91644c", shade: "#6d4a3a", hair: "#483d38", robe: "#ba704c", robeDark: "#8e4e3b", faceShape: "round", eyeOffset: 0 },
] as const;
const HAIR: Record<AvatarSex, readonly AvatarHairStyle[]> = {
  male: ["short-curls", "side-part", "rounded-crop"],
  female: ["bun", "side-braid", "headband"],
};

/** No seed, randomness, storage or simulation state is read by this projection. */
export function getAvatarAppearance({ originId, sex, variant, stage = "adult" }: {
  originId: string; sex: AvatarSex; variant: number; stage?: AvatarStage;
}): AvatarAppearance {
  if (sex !== "male" && sex !== "female") throw new Error("Avatar appearance requires a recorded male or female identity.");
  if (!Number.isInteger(variant) || variant < 0 || variant >= IDENTITIES.length) throw new Error("Avatar appearance requires variant 0, 1 or 2.");
  if (!STAGES.includes(stage)) throw new Error("Unknown avatar life stage.");
  const origin = AVATAR_APPEARANCE_ORIGINS.find(origin => origin.id === originId) ?? AVATAR_APPEARANCE_ORIGINS[0];
  const identity = IDENTITIES[variant];
  const mature = stage === "adult" || stage === "middle" || stage === "elder";
  return Object.freeze({
    originId: origin.id, sex, variant, stage, identityKey: `${origin.id}:${sex}:${variant}`,
    skin: identity.skin, shade: identity.shade, baseHair: identity.hair,
    hair: stage === "elder" ? "#adb4a6" : identity.hair,
    robe: identity.robe, robeDark: identity.robeDark, mantle: origin.accent, accent: origin.accent,
    background: origin.background, motif: origin.motif, hairStyle: HAIR[sex][variant],
    facialHair: mature && sex === "male" ? variant === 0 ? "full" : variant === 2 ? "chin" : "none" : "none",
    faceShape: identity.faceShape, eyeOffset: identity.eyeOffset,
    infantBinding: sex === "female" ? "cross" : "fold",
  });
}
