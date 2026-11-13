import type { AccomplishmentRecord, LifeState, WorldPack } from "../../src/types.ts";
import { getFigurePathProgress } from "../../src/figures/progress.ts";
import { figureRosterEntry, type FigureCardRank, type FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import { contributionCardRanks } from "./figure-contribution-ranks.ts";
import type { LegacyEntry } from "../storage/legacy-store.ts";

export interface LegacyFigureCard {
  figure: FigureRosterEntry;
  rank: FigureCardRank;
  title: string;
  mode: "principal" | "contribution";
  contributionRanks?: readonly FigureCardRank[];
  gender?: "male" | "female";
}
const sameRecord = (saved: AccomplishmentRecord, recorded?: AccomplishmentRecord) => recorded !== undefined &&
  saved.id === recorded.id && saved.achievementId === recorded.achievementId && saved.routeId === recorded.routeId &&
  saved.sourceId === recorded.sourceId && saved.outcomeId === recorded.outcomeId && saved.age === recorded.age && saved.year === recorded.year;

/** Render replay-derived earned records only; stored labels and NFT attachments never assign rarity. */
export function legacyFigureCard(entry: LegacyEntry, world?: WorldPack, life?: LifeState): LegacyFigureCard | undefined {
  if (!world || !life || entry.worldId !== world.id || entry.worldVersion !== world.version ||
    entry.worldId !== life.worldId || entry.worldVersion !== life.worldVersion || entry.worldFingerprint !== life.worldFingerprint ||
    entry.seed !== life.seed) return;
  const path = world.figurePaths?.find(path => `figure-${path.id}` === entry.accomplishment.routeId);
  const figure = path && figureRosterEntry(path.id);
  if (!path || !figure) return;
  const progress = getFigurePathProgress(world, path, life);
  const contributionRanks = contributionCardRanks(figure, progress);
  const stage = progress.stages.find(stage => stage.earned && sameRecord(entry.accomplishment, stage.record));
  if (stage) return { figure, rank: stage.definition.rank, mode: "contribution", contributionRanks, title: progress.encounterMode === "tradition" ? stage.definition.traditionTitle : stage.definition.title };
  const recognition = progress.legendaryContribution;
  if (recognition?.earned && sameRecord(entry.accomplishment, recognition.record)) return {
    figure, rank: "Epic", mode: "contribution", contributionRanks,
    title: progress.encounterMode === "tradition" ? recognition.definition.traditionTitle : recognition.definition.title,
  };
  // A capstone retains its original grade even if a separate promotion was earned later.
  if (progress.capstone.earned && sameRecord(entry.accomplishment, progress.capstone.record)) {
    return { figure, rank: figure.baseRank, mode: "principal", title: path.capstone.title };
  }
  if (progress.promoted && path.promotion && life.accomplishments?.some(record =>
    record.achievementId === path.promotion!.achievementId && record.sourceId === path.promotion!.activityId &&
    sameRecord(entry.accomplishment, record) && world.character?.activities.find(activity => activity.id === record.sourceId)?.outcomes.some(outcome =>
      outcome.id === record.outcomeId && outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === path.promotion!.achievementId)))) {
    return { figure, rank: figure.maximumRank, mode: "principal", title: path.promotion.title };
  }
}
