/** JSON-only contracts. The engine has no DOM, network, clock or Node dependencies. */
export type Comparison = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";

export type Condition =
  | { type: "stat"; stat: string; op: Comparison; value: number }
  | { type: "flag"; flag: string; value: boolean }
  | { type: "age"; op: Comparison; value: number }
  | { type: "year"; op: Comparison; value: number }
  | { type: "origin"; origin: string }
  | { type: "all" | "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

export type Effect =
  | { type: "stat"; stat: string; delta: number }
  | { type: "flag"; flag: string; value: boolean }
  | { type: "end"; ending: string };

export interface StatDefinition {
  label: string;
  min: number;
  max: number;
  initial: number;
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
  sources?: HistoricalSource[];
  events: LifeEvent[];
  endings: Ending[];
  /** Used at maxAge if no other ending applies. */
  defaultEnding: string;
}

export type Command = { type: "advance" } | { type: "choose"; choice: string };

export interface JournalEntry {
  type: "birth" | "year" | "event" | "choice" | "outcome" | "ending";
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
  replay(seed: string, commands: readonly Command[]): LifeState;
  save(state: LifeState): string;
  load(json: string): LifeState;
}
