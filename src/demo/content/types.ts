import type { CharacterActivity, InfluenceEntry, JobDefinition, LegacyAchievementDefinition, LegacyRouteDefinition, LifeEvent, Origin, SkillDefinition } from "../../types.ts";

/** Authored additions one track contributes to `alexandria-demo-1`. */
export interface DemoContent {
  jobs?: JobDefinition[];
  /** Replaces existing jobs with the same id (for example soldier pay moving to the army purse). */
  replaceJobs?: JobDefinition[];
  skills?: Record<string, SkillDefinition>;
  activities?: CharacterActivity[];
  events?: LifeEvent[];
  /** Existing event ids this world drops (for example the old poor-harvest event). */
  removeEvents?: string[];
  /** Existing events replaced by id (same id, new definition). */
  replaceEvents?: LifeEvent[];
  routes?: LegacyRouteDefinition[];
  achievements?: LegacyAchievementDefinition[];
  /** When set, the world keeps only these origins (rural births). */
  origins?: Origin[];
  /** Existing influence entries (figure deeds) replaced by id, tying them to this world's accounts. */
  replaceInfluences?: InfluenceEntry[];
}
