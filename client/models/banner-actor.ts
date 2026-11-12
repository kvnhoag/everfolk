import type { LifeState } from "../../src/types.ts";
import { avatarArtworkOrigin, portraitVariant } from "./life-background.ts";
import type { LifeBanner } from "./banner-state.ts";

/** Identity and pose are presentation choices; they consume no simulation RNG. */
export function bannerActorSource(life: LifeState, banner: LifeBanner): string | undefined {
  if (!banner.actorVisible) return;
  const sex = life.character?.sex ?? "male";
  const selected = life.character?.avatarVariant;
  const variant = selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < 3 ? selected : portraitVariant(life.seed);
  const pose = banner.stage === "infant" ? "cradle" : banner.actorPose === "cradle" ? "seated" : banner.actorPose;
  const origin = avatarArtworkOrigin(life.originId);
  return origin
    ? `/assets/pixel/banners/actors/${origin}/${sex}/${banner.stage}-${variant}-${pose}.svg`
    : `/assets/pixel/banners/actors/${banner.stage}-${sex}-${variant}-${pose}.svg`;
}
