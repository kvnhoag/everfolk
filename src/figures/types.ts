import type { Condition, AccomplishmentRecord } from "../types.ts";

export type FigureAssociationRank = "Uncommon" | "Rare" | "Epic";
export type FigurePrincipalRank = "Epic" | "Legendary";
export interface FigurePathEncounter {
  access?: "direct" | "circle";
  fromYear: number;
  toYear?: number;
  location: string;
  activityId: string;
  achievementId: string;
}
export interface FigurePathTradition {
  fromYear: number;
  location: string;
  activityId: string;
  achievementId: string;
}
export interface FigurePathStage {
  rank: FigureAssociationRank;
  title: string;
  traditionTitle: string;
  achievementId: string;
  activityId: string;
  workActionId: string;
  workYears: number;
  description: string;
  requires: Condition;
}
export interface FigurePathCapstone {
  attemptAchievementId?: string;
  title: string;
  achievementId: string;
  activityId: string;
  description: string;
  requires: Condition;
}
export interface FigurePathPromotion {
  attemptAchievementId?: string;
  achievementId: string;
  activityId: string;
  milestone: "rhodes-captured" | "ptolemaic-dynasty-founded" | "stoic-school-established";
  title: string;
  alternateHistory: boolean;
  provisional?: boolean;
}
/** Frozen, JSON-only route metadata belongs to the world revision that authored its activities. */
export interface FigurePathDefinition {
  id: string;
  name: string;
  summary: string;
  baseRank: FigurePrincipalRank;
  maximumRank: FigurePrincipalRank;
  sources: { title: string; url: string }[];
  encounter: FigurePathEncounter;
  tradition?: FigurePathTradition;
  stages: FigurePathStage[];
  capstone: FigurePathCapstone;
  promotion?: FigurePathPromotion;
}
export interface FigurePathStageProgress {
  definition: FigurePathStage;
  earned: boolean;
  ready: boolean;
  missingRequirements: string[];
  record?: AccomplishmentRecord;
}
export interface FigurePathCapstoneProgress {
  definition: FigurePathCapstone;
  attempted: boolean;
  failed: boolean;
  earned: boolean;
  ready: boolean;
  missingRequirements: string[];
  record?: AccomplishmentRecord;
}
export interface FigurePathProgress {
  definition: FigurePathDefinition;
  encounterMode: "direct" | "circle" | "tradition" | null;
  encounterRecord?: AccomplishmentRecord;
  directAvailable: boolean;
  traditionAvailable: boolean;
  principalRank: FigurePrincipalRank;
  principalTitle: string;
  promoted: boolean;
  promotionOutcome: "not-attempted" | "succeeded" | "failed";
  alternateHistory: boolean;
  provisionalPromotion: boolean;
  associationRank: FigureAssociationRank | null;
  associationTitle: string | null;
  stages: FigurePathStageProgress[];
  nextStage: FigurePathStageProgress | null;
  capstone: FigurePathCapstoneProgress;
  specialTitle: { title: string; rank: FigurePrincipalRank; alternateHistory: boolean; record: AccomplishmentRecord } | null;
}
