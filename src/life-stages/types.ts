import type { Condition, Effect } from "../types.ts";

/** Who would really make a decision; see `LifeStagesDefinition.scopes`. */
export type DecisionScope = "personal" | "work" | "community" | "household";
export const DECISION_SCOPES: readonly DecisionScope[] = ["personal", "work", "community", "household"];

export interface LifeStage {
  id: string;
  title: string;
  /** Stages are ordered by `minAge`; the first starts at 0 and each lasts until the next. */
  minAge: number;
}

/** Opt-in. Worlds without it keep their previous event rules. */
export interface LifeStagesDefinition {
  stages: LifeStage[];
  /** The first stage in which the player decides events of each scope. */
  scopes: Record<DecisionScope, string>;
}

/** One rule the household or community follows when the player is too young to decide. */
export interface DependentResponse {
  id: string;
  text: string;
  /**
   * Responses with a condition are rules: one matching rule is drawn by weight. Responses without a
   * condition are the fallback, drawn only when no rule matches. The last response is a fallback.
   */
  when?: Condition;
  weight?: number;
  effects: Effect[];
}

export interface DependentResolution {
  /** Replaces the event text when others decide. Say who decides. */
  text: string;
  responses: DependentResponse[];
}

export interface LifeStageView {
  id: string;
  title: string;
  decides: DecisionScope[];
}
