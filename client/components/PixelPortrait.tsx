import { resolvePortraitState } from "../models/portrait-state.ts";
import type { PortraitState } from "../models/portrait-state.ts";
import type { AvatarSex } from "../models/life-background.ts";

export interface PixelPortraitProps {
  age?: number;
  seed?: string;
  name?: string;
  className?: string;
  /** Retained for caller compatibility; game subjects supply a resolved state. */
  originId?: string;
  sex?: AvatarSex;
  avatarVariant?: number;
  personKey?: string;
  jobId?: string | null;
  occupation?: string;
  role?: "royalty" | "aristocrat";
  portrait?: PortraitState;
  loading?: "eager" | "lazy";
}

/** Render resolved state; scalar appearance props support standalone previews. */
export default function PixelPortrait({ age = 18, seed = "", name = "Your character", className = "portrait", sex, avatarVariant, personKey, jobId, occupation, role, portrait, loading = "lazy" }: PixelPortraitProps) {
  const state = portrait ?? resolvePortraitState({ age, seed, personKey, sex, avatarVariant, jobId, occupation, role });
  const { stage } = state;
  return <img className={`pixel-portrait ${className}`} src={state.src} width={state.width} height={state.height} data-portrait-key={state.combinationKey} data-portrait-identity={state.identityId} alt={`Pixel portrait of ${name}, ${stage === "elder" ? "in later life" : stage === "middle" ? "in middle age" : stage === "infant" ? "an infant in a swaddle" : stage === "child" ? "a child" : stage === "youth" ? "a young person" : "an adult"}`} loading={loading} decoding="async" draggable={false} />;
}
