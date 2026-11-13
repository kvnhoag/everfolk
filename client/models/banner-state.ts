import type { CharacterActivity, LifeState, WorldPack } from "../../src/types.ts";
import { avatarStage } from "./life-background.ts";
import type { AvatarStage } from "./life-background.ts";
import { resolveLifeScenes } from "./scene-model.ts";
import type { EventVisuals, MotionId, SceneContext, SceneId } from "./scene-model.ts";
import { getLoanSummary } from "./loan-summary.ts";

/** Finite compositions, combined with the real identity's six age stages. */
export const BANNER_SITUATION_IDS = [
  "home", "courtyard", "study", "workshop", "sculpture", "philosophy", "harbor", "military",
  "market", "astronomy", "music", "friendship", "courtship", "marriage", "parenthood", "business",
  "illness", "recovery", "debt", "danger", "war", "civic", "retirement", "memorial",
] as const;
export type BannerSituationId = typeof BANNER_SITUATION_IDS[number];
export type BannerActorPose = "cradle" | "standing" | "seated" | "reclined";

export const BANNER_STAGE_LABELS: Record<AvatarStage, string> = {
  infant: "Infancy", child: "Childhood", youth: "Youth", adult: "Adulthood", middle: "Middle years", elder: "Later life",
};

export const BANNER_SITUATIONS: Record<BannerSituationId, { label: string; caption: string; motion: MotionId; pose: BannerActorPose }> = {
  home: { label: "At home", caption: "Meals, familiar voices and the household's daily tasks fill the room.", motion: "gather", pose: "seated" },
  courtyard: { label: "Play and discovery", caption: "You try a game, follow a familiar voice and find something new to ask about.", motion: "play", pose: "standing" },
  study: { label: "Letters and lessons", caption: "You make time for letters, figures and the patient work of learning.", motion: "write", pose: "seated" },
  workshop: { label: "At the workbench", caption: "Tools and materials need your attention before the day's work can be finished.", motion: "work", pose: "standing" },
  sculpture: { label: "At the stone bench", caption: "You turn the piece toward the light and check where the next cut should fall.", motion: "work", pose: "standing" },
  philosophy: { label: "Questions and arguments", caption: "A reading leads to a question, and the question needs an answer you can defend.", motion: "write", pose: "seated" },
  harbor: { label: "Work by the water", caption: "Cargo, ropes and the next delivery keep your attention on the harbor.", motion: "sail", pose: "standing" },
  military: { label: "Training and service", caption: "Equipment, orders and the unit's daily work require a careful account.", motion: "work", pose: "standing" },
  market: { label: "Trade and accounts", caption: "Goods change hands, quantities need checking and the account must balance.", motion: "city", pose: "standing" },
  astronomy: { label: "The sky and its tables", caption: "You compare the observations and check the figures before copying another entry.", motion: "write", pose: "seated" },
  music: { label: "Rehearsal and performance", caption: "You listen for the cue and work through the phrase with the other performers.", motion: "gather", pose: "seated" },
  friendship: { label: "Time with a friend", caption: "There is news to exchange and a conversation worth making time for.", motion: "gather", pose: "standing" },
  courtship: { label: "Getting to know someone", caption: "You and your love interest are making time to see one another.", motion: "gather", pose: "standing" },
  marriage: { label: "A shared household", caption: "You and your spouse share the plans and ordinary demands of a household.", motion: "gather", pose: "standing" },
  parenthood: { label: "Caring for your children", caption: "Your children need meals, company and help with the day's small difficulties.", motion: "gather", pose: "seated" },
  business: { label: "Shared work", caption: "You and a business partner divide the tasks, check the order and settle the account.", motion: "work", pose: "standing" },
  illness: { label: "Care and illness", caption: "Illness or injury changes the day's plans. Rest and care take priority.", motion: "rest", pose: "reclined" },
  recovery: { label: "Rest and recovery", caption: "You set aside the heavier tasks and make room for rest.", motion: "rest", pose: "reclined" },
  debt: { label: "A repayment approaching", caption: "The moneylender's account needs attention before the deadline passes.", motion: "write", pose: "seated" },
  danger: { label: "A dangerous situation", caption: "An immediate threat interrupts the ordinary work of the day.", motion: "unrest", pose: "standing" },
  war: { label: "A city at war", caption: "Fighting reaches the harbor and streets around familiar homes and workplaces.", motion: "unrest", pose: "standing" },
  civic: { label: "The city around you", caption: "Errands and familiar faces bring you into the city's streets.", motion: "city", pose: "standing" },
  retirement: { label: "Stepping back from work", caption: "You have stepped back from regular work and can arrange the day at a different pace.", motion: "reflect", pose: "seated" },
  memorial: { label: "Life ended", caption: "The life record preserves the people, work and choices from these years.", motion: "still", pose: "seated" },
};

export interface LifeBanner {
  situation: BannerSituationId;
  stage: AvatarStage;
  stageLabel: string;
  title: string;
  situationLabel: string;
  caption: string;
  alt: string;
  motion: MotionId;
  assetSrc: string;
  actorVisible: boolean;
  actorPose: BannerActorPose;
}

interface BannerOptions { eventVisuals?: EventVisuals; birthReveal?: boolean }

const JOB_SITUATIONS: Record<string, BannerSituationId> = {
  apprentice: "workshop", porter: "harbor", potter: "workshop", clerk: "market", copyist: "study", sailor: "harbor",
  shopkeeper: "market", "ceramic-decorator": "workshop", "wood-carver": "workshop", sculptor: "sculpture",
  "philosophy-tutor": "philosophy", "sky-table-calculator": "astronomy", astrologer: "astronomy",
  soldier: "military", officer: "military", general: "military", "court-adviser": "civic", "patron-supported-reader": "study",
  "pottery-workshop-lead": "workshop", "carving-workshop-lead": "workshop", "sculpture-workshop-lead": "sculpture", performer: "music",
  farmer: "home", weaver: "workshop", writer: "study", boatbuilder: "harbor", trader: "market",
  fisher: "harbor", baker: "home", "household-worker": "home",
  merchant: "market", "estate-steward": "civic", quartermaster: "military",
};
const ROUTE_SITUATIONS: Record<string, BannerSituationId> = {
  sculpture: "sculpture", philosophy: "philosophy", seafaring: "harbor", military: "military", commerce: "market",
  "astronomy-calendar": "astronomy", "music-performance": "music",
};
const ACTIVITY_SITUATIONS: Record<string, BannerSituationId> = {
  "train-sculpture": "sculpture", "small-figure-order": "sculpture", "sculpture-commission": "sculpture",
  "train-philosophy": "philosophy", "teach-a-reading-lesson": "philosophy",
  "train-astronomy": "astronomy", "train-astrology": "astronomy", "copy-a-sky-table": "astronomy",
  "train-music": "music", "work-performer": "music", "complete-paid-engagement": "music",
  "train-seamanship": "harbor", "complete-cargo-voyage": "harbor", "shipboard-watch": "harbor",
  "take-day-cargo-work": "harbor", "take-night-cargo-work": "harbor",
  "train-warfare": "military", "drill-a-unit": "military", "complete-service-assignment": "military",
  "organise-war-supplies": "military", "fulfil-significant-order": "market",
  "focus-market-trading": "market",
  "rest-for-recovery": "recovery", "seek-a-healer": "recovery", "ask-household-care": "recovery", "take-a-rest-day": "recovery",
  "grow-household": "parenthood", "care-for-children": "parenthood", "cook-a-shared-meal": "home",
  "visit-a-friend": "friendship", "join-an-evening-song": "music", "take-an-easy-walk": "civic",
};

function fromScene(scene: SceneId, life: LifeState): BannerSituationId {
  const mappings: Record<SceneId, BannerSituationId> = {
    birth: "home", childhood: "courtyard", learning: "study", work: "workshop", sea: "harbor", family: "home",
    "later-life": life.flags.retired ? "retirement" : "home", memorial: "memorial", rest: "recovery",
    "history-war": "war", "history-city": "civic", music: "music",
  };
  return mappings[scene];
}

function latestActivity(context: SceneContext, life: LifeState, world: WorldPack): CharacterActivity | undefined {
  if (context.kind !== "outcome" || !context.id.startsWith(`activity-${life.age}-`)) return;
  return world.character?.activities.find(activity => context.id.endsWith(`-${activity.id}`));
}

/** Only inspect accepted state: a tempting option or a high skill is not a career. */
function situationForContext(context: SceneContext, life: LifeState, world: WorldPack): BannerSituationId {
  const id = context.eventId ?? "";
  if (id.startsWith("lender-")) return ["lender-threat", "lender-confrontation"].includes(id) ? "danger" : "debt";
  if (["rare-abduction", "rare-scaffold-collapse", "adult-a-warehouse-fire", "adult-robbers-in-a-lane"].includes(id)) return "danger";
  if (id.startsWith("business-proposal-person-")) {
    const person = id.slice("business-proposal-".length);
    return life.character?.relationships?.partners[person]?.roles?.includes("business-partner") ? "business" : fromScene(context.scene, life);
  }
  if (id.startsWith("date-person-")) {
    const person = id.slice("date-".length);
    if (life.character?.partnerId === person && life.character.relationshipStatus === "courting") return "courtship";
    return life.character?.relationships?.partners[person]?.roles?.includes("friend") ? "friendship" : "civic";
  }
  for (const [route, situation] of Object.entries(ROUTE_SITUATIONS)) {
    if (id.startsWith(`legacy-${route}-`) || id === `early-interest-recalled-${route}` || id === `credit-opportunity-${route}`) {
      if (route === "military" && life.year >= -30 && id.includes("callback")) return "business";
      return situation;
    }
  }
  if (id === "specialist-sculpture-detail") return "sculpture";
  if (id === "specialist-philosophy-objection") return "philosophy";
  if (["specialist-sky-record", "specialist-conflicting-charts", "specialist-dendera-chart"].includes(id)) return "astronomy";
  const activity = latestActivity(context, life, world);
  if (activity) {
    if (activity.id.startsWith("marry-") && life.character?.relationshipStatus === "married") return "marriage";
    if (activity.id.startsWith("court-") && life.character?.relationshipStatus === "courting") return "courtship";
    if (activity.id.startsWith("friend-time-") || activity.id.startsWith("befriend-")) return "friendship";
    if (activity.id.startsWith("form-business-") || activity.id.startsWith("joint-order-")) return "business";
    if (ACTIVITY_SITUATIONS[activity.id]) return ACTIVITY_SITUATIONS[activity.id];
  }
  return fromScene(context.scene, life);
}

function fallbackSituation(life: LifeState): BannerSituationId {
  if (life.age < 3) return "home";
  if (life.flags.retired) return "retirement";
  const job = life.character?.jobId;
  if (job && JOB_SITUATIONS[job]) return JOB_SITUATIONS[job];
  if (life.age < 13) return "courtyard";
  if (life.age < 18) return "study";
  if (life.character?.children.length || life.flags.parent) return "parenthood";
  if (life.character?.relationshipStatus === "married" || life.flags.partnered) return "marriage";
  if (life.character?.relationshipStatus === "courting") return "courtship";
  const ties = Object.values(life.character?.relationships?.partners ?? {});
  if (ties.some(tie => tie.roles?.includes("business-partner"))) return "business";
  if (ties.some(tie => tie.roles?.includes("friend"))) return "friendship";
  return life.age >= 60 ? "home" : "civic";
}

function twoSentences(text: string): string {
  return text.trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
}

const EVENT_BACKDROPS: Readonly<Partial<Record<string, { file: string; label: string }>>> = {
  "child-route-care-floating-reed": { file: "reed-washing-court", label: "A reed on the water" },
  "child-route-learning-shadow-marks": { file: "shadow-mark-terrace", label: "Measuring shadows on the terrace" },
  "child-route-training-vessel-packing": { file: "pottery-packing-room", label: "Packing a vessel in the workshop" },
};

/** Presentation only. No mutation, random draw, stored progress or engine command. */
export function resolveLifeBanner(life: LifeState, world: WorldPack, context?: SceneContext, options: BannerOptions = {}): LifeBanner {
  const stage = avatarStage(life.age), stageLabel = BANNER_STAGE_LABELS[stage];
  let situation: BannerSituationId;
  let caption: string | undefined;
  let situationLabel: string | undefined;
  let motion: MotionId | undefined;
  let backdrop: { file: string; label: string } | undefined;
  const ending = life.phase === "ended" ? world.endings.find(item => item.id === life.endingId) : undefined;
  // The dashboard must not turn a proposed route into a completed scene.
  const candidate = context ?? resolveLifeScenes(life, world, options.eventVisuals)[0];
  const accepted = candidate?.kind === "pending"
    ? resolveLifeScenes({ ...life, phase: "ready", pendingEventId: null }, world, options.eventVisuals)[0]
    : candidate;
  if (life.phase === "ended") {
    situation = ending?.kind === "chapter" ? "home" : "memorial";
    caption = candidate?.caption ?? world.character?.deathCauses.find(item => item.id === life.deathCauseId)?.text ?? ending?.text;
    situationLabel = ending?.kind === "chapter" ? "Life record complete" : "Life ended";
    motion = "still";
  } else if (life.health?.conditions.length) {
    situation = "illness";
    const condition = world.health?.conditions.find(item => item.id === life.health!.conditions[0].id);
    caption = condition ? `${condition.title} affects your day. Rest and care take priority while the household makes other arrangements.` : undefined;
  } else if (options.birthReveal) {
    situation = "home";
    caption = "You are born into this household. For now, feeding, sleep and familiar hands make up your world.";
    situationLabel = "A new life at home";
  } else {
    const loan = getLoanSummary(world, life);
    const explicit = accepted?.eventId && options.eventVisuals?.[accepted.eventId];
    if (loan && loan.yearsLeft <= 1) {
      situation = loan.threatened || loan.dangerous ? "danger" : "debt";
      situationLabel = loan.threatened || loan.dangerous ? "An overdue loan and a threat" : loan.yearsLeft < 0 ? "Repayment overdue" : loan.yearsLeft === 0 ? "Repayment due this year" : "Repayment due next year";
      caption = `${loan.description} ${loan.threatened ? "The unpaid account has brought threats from the collectors." : "The remaining balance needs attention alongside the household's other costs."}`;
    } else if (explicit && accepted) {
      situation = fromScene(explicit.scene, life);
      caption = explicit.caption ?? accepted.caption;
      motion = explicit.motion;
    } else if (accepted && accepted.kind !== "fallback" && accepted.kind !== "birth") {
      situation = situationForContext(accepted, life, world);
      caption = accepted.caption;
      motion = accepted.motion;
      backdrop = accepted.eventId ? EVENT_BACKDROPS[accepted.eventId] : undefined;
      situationLabel = backdrop?.label;
    } else {
      situation = fallbackSituation(life);
      if (life.age < 3) {
        situationLabel = "Care at home";
        caption = "Your household feeds you, carries you and keeps familiar hands close by.";
      }
    }
  }
  const definition = BANNER_SITUATIONS[situation];
  return {
    situation, stage, stageLabel, title: life.phase === "ended" ? ending?.kind === "chapter" ? "Life complete" : "Life ended" : stageLabel,
    situationLabel: situationLabel ?? definition.label,
    caption: twoSentences(caption ?? definition.caption),
    alt: `Layered pixel scene: ${stageLabel.toLowerCase()}, ${(situationLabel ?? definition.label).toLowerCase()}`,
    motion: motion ?? (life.age < 3 && situation === "home" ? "cradle" : definition.motion),
    assetSrc: backdrop ? `/assets/pixel/banners/events/${backdrop.file}.svg` : `/assets/pixel/banners/${situation}.svg`,
    actorVisible: situation !== "memorial",
    actorPose: life.age < 3 ? "cradle" : definition.pose,
  };
}
