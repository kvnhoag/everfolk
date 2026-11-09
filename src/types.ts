/** JSON-only contracts. The engine has no DOM, network, clock or Node dependencies. */
export type Comparison = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";

export type Condition =
  | { type: "cash" | "debt"; op: Comparison; value: number }
  | { type: "asset"; asset: string; op: Comparison; value: number }
  | { type: "stat"; stat: string; op: Comparison; value: number }
  | { type: "flag"; flag: string; value: boolean }
  | { type: "age"; op: Comparison; value: number }
  | { type: "year"; op: Comparison; value: number }
  | { type: "origin"; origin: string }
  | { type: "skill"; skill: string; op: Comparison; value: number }
  | { type: "job"; job: string | null }
  | { type: "relationship"; status: RelationshipStatus; partner?: string }
  | { type: "known-partner"; partner: string }
  | { type: "children"; op: Comparison; value: number }
  | { type: "all" | "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

export type Effect =
  | { type: "cash" | "debt"; delta: number }
  | { type: "asset"; asset: string; delta: number }
  | { type: "stat"; stat: string; delta: number }
  | { type: "flag"; flag: string; value: boolean }
  | { type: "skill"; skill: string; delta: number }
  | { type: "job"; job: string | null }
  | { type: "relationship"; partner: string; status: "courting" | "married" }
  | { type: "introduce"; partner: string }
  | { type: "divorce" }
  | { type: "child" }
  | { type: "end"; ending: string; deathCause?: string };

/** Inclusive whole-number bounds for a randomized starting attribute. */
export interface StatRange {
  min: number;
  max: number;
}

export interface StatDefinition {
  label: string;
  min: number;
  max: number;
  initial: number;
  /** Optional starting range for main stats; fixed initial values remain replay-compatible. */
  initialRange?: StatRange;
}

/** Skill-tree metadata is optional so older packs keep their original rules. */
export interface SkillDefinition extends StatDefinition {
  description?: string;
  /** Display label for a group of related skills. */
  branch?: string;
  /** Author-supplied layout hint, rather than an additional unlock rule. */
  tier?: number;
  /** Minimum current skill levels required for voluntary training gains. */
  prerequisites?: Record<string, number>;
  /** Declared training activity used to practice this skill. */
  trainingActivity?: string;
}

export type EvidenceKind = "documented-history" | "historically-inspired" | "fictional";

/** Bibliographic support travels with the pack rather than depending on a service. */
export interface HistoricalSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: "primary" | "museum" | "scholarship";
  period: string;
  geography: string;
  summary: string;
  limitations: string;
  accessed: string;
}

export interface EvidenceMetadata {
  sourceIds?: string[];
  evidence?: EvidenceKind;
}

export interface Origin extends EvidenceMetadata {
  id: string;
  title: string;
  text: string;
  weight: number;
  effects: Effect[];
  /** Partial starting-range overrides, drawn before this origin's effects. */
  statRanges?: Record<string, StatRange>;
}

export interface Outcome {
  id: string;
  text: string;
  weight: number;
  effects: Effect[];
}

export interface Choice {
  id: string;
  text: string;
  when?: Condition;
  outcomes: Outcome[];
}

export interface LifeEvent extends EvidenceMetadata {
  id: string;
  title: string;
  text: string;
  trigger:
    | { type: "age"; at: number }
    | { type: "year"; at: number }
    | { type: "random"; weight: number };
  when?: Condition;
  /** Scheduled events occur once. Random events default to once. */
  maxOccurrences?: number;
  cooldownYears?: number;
  /** Automatic events narrate and apply effects without asking the player to choose. */
  mode?: "automatic";
  effects?: Effect[];
  choices: Choice[];
}

export interface Ending extends EvidenceMetadata {
  id: string;
  title: string;
  text: string;
  /** Endings with conditions are checked in declaration order. */
  when?: Condition;
  /** Omitted for legacy chapter endings. Mortality endings must explicitly be deaths. */
  kind?: "death" | "chapter";
}

export interface YearlyRule {
  id: string;
  when?: Condition;
  effects: Effect[];
}

export interface MortalityBand {
  minAge: number;
  maxAge: number;
  annualProbability: number;
  ending: string;
}

export interface MortalityModel {
  description: string;
  sourceIds: string[];
  /** Inclusive, sorted, contiguous age bands cover every age from 0 to maxAge - 1. */
  bands: MortalityBand[];
}

export type RelationshipStatus = "single" | "courting" | "married" | "divorced";

export interface JobDefinition {
  id: string;
  title: string;
  description: string;
  minAge: number;
  requirements?: Record<string, number>;
  yearlyEffects: Effect[];
}

export interface PartnerDefinition {
  id: string;
  name: string;
  /** Candidate age is the player's current age plus this offset. */
  ageOffset: number;
  occupation: string;
  description: string;
}

export interface CharacterActivity extends Choice {
  category: "training" | "career" | "relationship" | "family" | "finance";
  minAge?: number;
  cooldownYears?: number;
}

export interface ActivityAvailability extends CharacterActivity {
  available: boolean;
  reason?: string;
}

export interface DeathCause {
  id: string;
  title: string;
  text: string;
  weight: number;
  /** Reserved for an explicit authored fatal consequence, never natural sampling. */
  choiceOnly?: boolean;
  /** Eligibility for random attribution. Explicit authored fatal effects can override it. */
  when?: Condition;
}

/** Authored gameplay, including fictional cause weights rather than measured rates. */
export interface CharacterDefinition {
  /** Optional seeded protagonist-name pool; omitted packs retain their original state. */
  playerNames?: string[];
  /** People must be introduced before courtship or marriage when enabled. */
  requireIntroductions?: boolean;
  skills: Record<string, SkillDefinition>;
  jobs: JobDefinition[];
  partners: PartnerDefinition[];
  activities: CharacterActivity[];
  childNames: string[];
  deathCauses: DeathCause[];
  deathCauseDescription: string;
}

export interface CharacterState {
  name?: string;
  knownPartnerIds?: string[];
  skills: Record<string, number>;
  jobId: string | null;
  partnerId: string | null;
  relationshipStatus: RelationshipStatus;
  children: { id: string; name: string; birthAge: number; otherParentId: string }[];
  lastActivityAge: number | null;
  lastActivityAges: Record<string, number>;
}

export interface EconomyDefinition {
  stat: string;
  currency: { singular: string; plural: string; short: string };
  unitsPerPoint: number;
  description: string;
  sourceIds?: string[];
  assets: { id: string; title: string; description: string; value: number; maxOwned: number; yearlyIncome?: number }[];
}

export interface EconomyState {
  cash: number;
  debt: number;
  assets: Record<string, number>;
}

export interface WorldPack {
  schemaVersion: 1;
  id: string;
  version: string;
  title: string;
  description: string;
  /** Signed historical years: -1 is 1 BCE, followed by 1 CE. No year zero. */
  startYear: number;
  maxAge: number;
  stats: Record<string, StatDefinition>;
  flags: Record<string, { label: string; initial: boolean }>;
  origins: Origin[];
  yearlyEffects: Effect[];
  yearlyRules?: YearlyRule[];
  /** Separate annual background stories from decisions with a seeded global gap. */
  eventPacing?: { minChoiceGapYears: number; maxChoiceGapYears: number };
  mortality?: MortalityModel;
  character?: CharacterDefinition;
  economy?: EconomyDefinition;
  sources?: HistoricalSource[];
  events: LifeEvent[];
  endings: Ending[];
  /** Used at maxAge if no other ending applies. */
  defaultEnding: string;
}

export type Command = { type: "advance" } | { type: "choose"; choice: string } | { type: "act"; activity: string };

export interface JournalEntry {
  type: "birth" | "year" | "event" | "choice" | "outcome" | "ending" | "activity";
  age: number;
  year: number;
  id: string;
  text: string;
}

export interface LifeState {
  schemaVersion: 1;
  worldId: string;
  worldVersion: string;
  worldFingerprint: string;
  seed: string;
  rngState: number;
  age: number;
  year: number;
  originId: string;
  stats: Record<string, number>;
  flags: Record<string, boolean>;
  phase: "ready" | "choice" | "ended";
  pendingEventId: string | null;
  endingId: string | null;
  eventCounts: Record<string, number>;
  lastEventAge: Record<string, number>;
  /** Only paced worlds use this; part of deterministic replay, never a wall clock. */
  nextChoiceAge?: number;
  character?: CharacterState;
  economy?: EconomyState;
  deathCauseId?: string;
  /** The accepted decision and outcome when they explicitly end life with an authored cause. */
  deathCauseContext?: string;
  journal: JournalEntry[];
  commands: Command[];
}

/** Saves store accepted commands; loading reconstructs and verifies the state. */
export interface SaveFile {
  schemaVersion: 1;
  worldId: string;
  worldVersion: string;
  worldFingerprint: string;
  seed: string;
  commands: Command[];
}

export interface LifeEngine {
  readonly world: WorldPack;
  readonly fingerprint: string;
  start(seed: string): LifeState;
  advance(state: LifeState): LifeState;
  choose(state: LifeState, choiceId: string): LifeState;
  getChoices(state: LifeState): readonly Choice[];
  getActivities(state: LifeState): readonly ActivityAvailability[];
  act(state: LifeState, activityId: string): LifeState;
  replay(seed: string, commands: readonly Command[]): LifeState;
  save(state: LifeState): string;
  load(json: string): LifeState;
}
