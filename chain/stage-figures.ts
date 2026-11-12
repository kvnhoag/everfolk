import type { FigureId } from "./ids.ts";
import type { FigureRequirement } from "./catalog/figures.ts";
import { figureFrontPath, figureMediaPath } from "./figure-media.ts";
import { figuresForWorld } from "./catalog/demo-figures.ts";

export interface StageRecord {
  stageId: string;
  title: string;
  fromAge: number;
  toAge: number;
  district: string;
  field: string;
  tier: number;
  jobId?: string;
  topSkills: Record<string, number>;
  nodes: string[];
  reputation: number;
  accomplishments: string[];
  mentors: string[];
}

export interface StageCharacterContext {
  characterName: string;
  originId: string;
  sex?: "male" | "female";
  avatarVariant?: number;
  seed: string;
  worldVersion?: string;
  stats?: Record<string, number>;
}

export interface MatchedStageFigure {
  kind: "historical" | "generic";
  historicalFigureId?: FigureId;
  title: string;
  name: string;
  summary: string;
  media: string;
  frontMedia?: string;
  stageRecord: StageRecord;
}

const AVATAR_ORIGIN_ALIASES: Record<string, string> = {
  "tenant-farming-household": "delta-newcomers",
  "domestic-service-household": "weaver-household",
  "boatbuilder-household": "artisan-household",
  "musician-household": "weaver-household",
};

export function stageAvatarStage(age: number): string {
  if (age < 3) return "infant";
  if (age < 13) return "child";
  if (age < 18) return "youth";
  if (age < 40) return "adult";
  if (age < 60) return "middle";
  return "elder";
}

export function stagePortraitPath({
  age,
  originId,
  sex,
  avatarVariant = 0,
}: {
  age: number;
  originId?: string;
  sex?: "male" | "female";
  avatarVariant?: number;
}): string {
  const stage = stageAvatarStage(age);
  const variant = Math.max(0, Math.min(2, Math.floor(avatarVariant)));
  const mappedOrigin = originId ? (AVATAR_ORIGIN_ALIASES[originId] ?? originId) : undefined;
  if (mappedOrigin && sex && (sex === "male" || sex === "female")) {
    return `/assets/pixel/portraits/${mappedOrigin}/${sex}/${stage}-${variant}.svg`;
  }
  return `/assets/pixel/portraits/${stage}-${variant}.svg`;
}

function formatWord(id: string): string {
  return id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function shortFigureName(figureId: FigureId, title: string): string {
  if (figureId === "cleomenes") return "Cleomenes";
  return title.split(",")[0].trim();
}

/** Checks whether a stage record meets all requirements of a historical figure. */
export function stageMeetsFigure(stage: StageRecord, context: StageCharacterContext, figure: FigureRequirement): boolean {
  // Age and stage windows
  if (figure.stages?.length && !figure.stages.includes(stage.stageId)) return false;
  if (figure.minAge !== undefined && stage.toAge < figure.minAge) return false;
  if (figure.maxAge !== undefined && stage.fromAge > figure.maxAge) return false;

  // Origin check
  if (figure.origins?.length && !figure.origins.includes(context.originId)) return false;

  // Job check
  if (figure.jobsAny?.length && (!stage.jobId || !figure.jobsAny.includes(stage.jobId))) return false;

  // Skills check
  if (figure.minSkills) {
    for (const [skill, min] of Object.entries(figure.minSkills)) {
      if ((stage.topSkills[skill] ?? 0) < min) return false;
    }
  }

  // Stats check
  if (figure.minStats && context.stats) {
    for (const [stat, min] of Object.entries(figure.minStats)) {
      if ((context.stats[stat] ?? 0) < min) return false;
    }
  }

  // Reputation check
  if (figure.minReputation !== undefined && stage.reputation < figure.minReputation) return false;

  // Accomplishments check
  if (figure.accomplishmentsAny?.length) {
    const hasAny = stage.accomplishments.some(acc => figure.accomplishmentsAny!.includes(acc));
    if (!hasAny) return false;
    if (figure.maxAgeAtAccomplishment !== undefined && stage.fromAge > figure.maxAgeAtAccomplishment) return false;
  }

  return true;
}

/** Pure matcher: finds the first matching historical figure for a stage record, or null. */
export function matchStageRecordToHistorical(
  stage: StageRecord,
  context: StageCharacterContext,
  figures: readonly FigureRequirement[] = figuresForWorld(context.worldVersion ?? ""),
): FigureRequirement | null {
  for (const figure of figures) {
    if (stageMeetsFigure(stage, context, figure)) return figure;
  }
  return null;
}

/**
 * Pure matcher: maps a stage record to either a historical figure (if eligible at this age/stage)
 * or a generic stage portrait of the player's own character.
 */
export function matchStageFigure(
  stage: StageRecord,
  context: StageCharacterContext,
  figures?: readonly FigureRequirement[],
): MatchedStageFigure {
  const figureCatalog = figures ?? figuresForWorld(context.worldVersion ?? "");
  const historical = matchStageRecordToHistorical(stage, context, figureCatalog);

  if (historical) {
    return {
      kind: "historical",
      historicalFigureId: historical.figure,
      title: historical.title,
      name: shortFigureName(historical.figure, historical.title),
      summary: historical.summary,
      media: figureMediaPath(historical.figure),
      frontMedia: figureFrontPath(historical.figure),
      stageRecord: stage,
    };
  }

  const ageForPortrait = Math.round((stage.fromAge + stage.toAge) / 2);
  const media = stagePortraitPath({
    age: ageForPortrait,
    originId: context.originId,
    sex: context.sex,
    avatarVariant: context.avatarVariant,
  });

  const jobPart = stage.jobId ? formatWord(stage.jobId) : `${formatWord(stage.field)} Tier ${stage.tier}`;
  const districtPart = formatWord(stage.district);
  const title = `${context.characterName}, ${jobPart} in ${districtPart}`;
  const summary = `Portrait from ${stage.title.toLowerCase()} (ages ${stage.fromAge}–${stage.toAge}) in ${districtPart}. Focused on ${stage.field} (tier ${stage.tier})${stage.jobId ? ` as ${formatWord(stage.jobId)}` : ""}.`;

  return {
    kind: "generic",
    title,
    name: context.characterName,
    summary,
    media,
    stageRecord: stage,
  };
}
