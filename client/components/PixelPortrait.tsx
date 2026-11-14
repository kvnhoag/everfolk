import { useState } from "react";
import { resolvePortraitState } from "../models/portrait-state.ts";
import type { PortraitSet, PortraitSpecialRole, PortraitState } from "../models/portrait-state.ts";
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
  role?: PortraitSpecialRole;
  portraitSet?: PortraitSet;
  portrait?: PortraitState;
  loading?: "eager" | "lazy";
}

/** Render resolved state; scalar appearance props support standalone previews. */
export default function PixelPortrait({
  age = 18,
  seed = "",
  name = "Your character",
  className = "portrait",
  sex,
  avatarVariant,
  personKey,
  jobId,
  occupation,
  role,
  portraitSet,
  portrait,
  loading = "lazy",
}: PixelPortraitProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const state = portrait ?? resolvePortraitState({
    age, seed, personKey, sex, avatarVariant, jobId, occupation, role, portraitSet,
  });
  const { stage } = state;
  const activeSrc = failedSrc === state.src && state.fallbackSrc ? state.fallbackSrc : state.src;
  return (
    <img
      className={`pixel-portrait ${className}`}
      src={activeSrc}
      width={state.width}
      height={state.height}
      data-portrait-key={state.combinationKey}
      data-portrait-identity={state.identityId}
      data-portrait-set={state.portraitSet}
      onError={() => {
        if (state.fallbackSrc && state.src !== state.fallbackSrc) setFailedSrc(state.src);
      }}
      alt={`Pixel portrait of ${name}, ${stage === "elder" ? "in later life" : stage === "middle" ? "in middle age" : stage === "infant" ? "an infant in a swaddle" : stage === "child" ? "a child" : stage === "youth" ? "a young person" : "an adult"}`}
      loading={loading}
      decoding="async"
      draggable={false}
    />
  );
}
