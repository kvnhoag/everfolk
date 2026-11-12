/** Life paths: fields of work, district people, field needs, affinity and stage records. */

export type FieldId = "farming" | "clothing" | "ceramics" | "sculpture" | "research" | "civic" | "trade" | "soldiering";
export const FIELD_IDS: readonly FieldId[] = ["farming", "clothing", "ceramics", "sculpture", "research", "civic", "trade", "soldiering"];

export type Tier = "learner" | "worker" | "master" | "renowned";
export const TIERS: readonly Tier[] = ["learner", "worker", "master", "renowned"];

/** People of one field in a district, by tier: learners, workers, masters, renowned. */
export type TierCounts = [learner: number, worker: number, master: number, renowned: number];

export type NeedLabel = "scarce" | "steady" | "crowded";

export interface FieldDefinition {
  title: string;
  /** One practitioner, e.g. "potter". */
  practitioner: string;
  /** Skills practised in the field; the first is the field's entry skill. */
  skills: string[];
  jobs: string[];
  /** Skill-atlas specialization names that belong to the field. */
  specializations: string[];
}

export interface DistrictDefinition {
  title: string;
  /** Birthplaces (origin IDs) that start a life in this district. */
  origins: string[];
  /** Per field: the workers the district needs, and its starting people by tier. */
  profile: Record<FieldId, { demand: number; people: TierCounts }>;
  /** A farming district: neighbours share seed and channel work, and the fields are at home. */
  farmEdge?: FarmEdge;
}

export interface FarmEdge {
  /** Price of farm inputs (flax seed, channel and store work) here, in basis points of the usual. */
  inputBps: number;
  /** Health gained in a year of farm work at home here. */
  healthPerYear: number;
}

export interface PathsDefinition {
  fields: Record<FieldId, FieldDefinition>;
  districts: Record<string, DistrictDefinition>;
  /** Pay multiplier bounds and label thresholds, in basis points. */
  pay: { minBps: number; maxBps: number; scarceBps: number; crowdedBps: number };
  /** Materials placed in the vocation inventory at birth, by origin. */
  startingMaterials?: Record<string, Record<string, number>>;
  /** Affinity a household background gives at birth, by origin. */
  originAffinity?: Record<string, Partial<Record<FieldId, number>>>;
}

export interface Practitioner {
  id: string;
  name: string;
  field: FieldId;
  tier: Tier;
  district: string;
  metAge: number;
}

export interface PathsState {
  /** The birth district, where the household stays. */
  home: string;
  /** Where the player lives now. Only the player moves. */
  district: string;
  /** Cached needs of the player's district; refreshed whenever people or the district change. */
  needs: Record<FieldId, { bps: number; label: NeedLabel }>;
  people: Record<FieldId, TierCounts>;
  affinity: Record<FieldId, number>;
  /** Last age the player practised or worked in each field. */
  lastPractice: Partial<Record<FieldId, number>>;
  practitioners: Practitioner[];
  introductions: FieldId[];
  moves: { age: number; from: string; to: string }[];
}

export interface StageRecord {
  stageId: string;
  title: string;
  fromAge: number;
  toAge: number;
  district: string;
  field: FieldId | null;
  tier: Tier;
  jobId: string | null;
  topSkills: Record<string, number>;
  nodes: string[];
  reputation: number;
  accomplishments: string[];
  mentors: string[];
}
