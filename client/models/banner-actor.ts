import type { LifeState } from "../../src/types.ts";
import { avatarArtworkOrigin, portraitVariant } from "./life-background.ts";
import type { LifeBanner } from "./banner-state.ts";

const CONCEPT1_MILITARY_JOBS = new Set(["soldier", "officer", "general", "court-adviser"]);
const CONCEPT1_SCHOLAR_JOBS = new Set([
  "clerk",
  "copyist",
  "philosophy-tutor",
  "sky-table-calculator",
  "astrologer",
  "patron-supported-reader",
]);
const CONCEPT1_COMMERCE_JOBS = new Set(["grain-dealer", "trader", "merchant", "banker", "quartermaster"]);
const CONCEPT1_WORK_JOBS = new Set([
  "farmhand",
  "tenant-farmer",
  "farmer",
  "potter",
  "porter",
  "weaver",
  "baker",
  "boatbuilder",
  "household-worker",
  "apprentice",
]);

function concept1ActorSubject(life: LifeState, banner: LifeBanner, pose: string): string {
  if ((banner.stage === "adult" || banner.stage === "middle") && pose !== "reclined" && pose !== "cradle") {
    const jobId = life.character?.jobId ?? "";
    if (CONCEPT1_MILITARY_JOBS.has(jobId)) return "military";
    if (CONCEPT1_SCHOLAR_JOBS.has(jobId)) return "scholar";
    if (CONCEPT1_COMMERCE_JOBS.has(jobId)) return "commerce";
    if (CONCEPT1_WORK_JOBS.has(jobId)) return "work";
  }
  return banner.stage;
}

function actorIdentity(life: LifeState, banner: LifeBanner) {
  const sex = life.character?.sex ?? "male";
  const selected = life.character?.avatarVariant;
  const variant = selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < 3 ? selected : portraitVariant(life.seed);
  const pose = banner.stage === "infant" ? "cradle" : banner.actorPose === "cradle" ? "seated" : banner.actorPose;
  const origin = avatarArtworkOrigin(life.originId);
  return { sex, variant, pose, origin };
}

/** Legacy 8-bit SVG actor path used when falling back from Concept 1 plates. */
export function bannerActorFallbackSource(life: LifeState, banner: LifeBanner): string | undefined {
  if (!banner.actorVisible) return;
  const { sex, variant, pose, origin } = actorIdentity(life, banner);
  return origin
    ? `/assets/pixel/banners/actors/${origin}/${sex}/${banner.stage}-${variant}-${pose}.svg`
    : `/assets/pixel/banners/actors/${banner.stage}-${sex}-${variant}-${pose}.svg`;
}

/** Identity and pose are presentation choices; they consume no simulation RNG. */
export function bannerActorSource(life: LifeState, banner: LifeBanner): string | undefined {
  if (!banner.actorVisible) return;
  const { sex, variant, pose, origin } = actorIdentity(life, banner);
  if (banner.bannerStyle === "concept1-plate") {
    const subject = concept1ActorSubject(life, banner, pose);
    return origin
      ? `/assets/pixel/banners-concept1/actors/${origin}/${sex}/${subject}-${variant}-${pose}.png`
      : `/assets/pixel/banners-concept1/actors/${subject}-${sex}-${variant}-${pose}.png`;
  }
  return bannerActorFallbackSource(life, banner);
}
