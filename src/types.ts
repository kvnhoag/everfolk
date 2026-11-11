/** JSON-only contracts. The engine has no DOM, network, clock or Node dependencies. */
export type Comparison = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";

export type Condition =
  | { type: "accomplishment"; achievement: string; minYears?: number }
  | { type: "cash" | "debt"; op: Comparison; value: number }
  | { type: "loan"; status: "none" | "active" | "due" | "overdue" }
  | { type: "loan-overdue"; op: Comparison; value: number }
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
  | { type: "social-role"; partner: string; role: SocialRole; active: boolean }
  | { type: "children"; op: Comparison; value: number }
  /** At least one existing child has this inclusive age range. */
  | { type: "child-age"; min: number; max: number }
  | { type: "has-condition"; condition?: string }
  | { type: "closeness"; partner?: string; op: Comparison; value: number }
  | { type: "all" | "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

export type Effect =
  | { type: "accomplishment"; achievement: string }
  | { type: "mastery"; target: "stat" | "skill"; id: string }
  | { type: "cash" | "debt"; delta: number }
  | { type: "loan"; action: "borrow" | "repay" | "extend"; amount?: number }
  | { type: "asset"; asset: string; delta: number }
  | { type: "stat"; stat: string; delta: number }
  | { type: "flag"; flag: string; value: boolean }
  | { type: "skill"; skill: string; delta: number; gainModifiers?: SkillGainModifier[] }
  | { type: "job"; job: string | null }
  | { type: "relationship"; partner: string; status: "courting" | "married" }
  | { type: "introduce"; partner: string }
  | { type: "social-role"; partner: string; role: SocialRole; active: boolean }
  | { type: "end-courtship" }
  | { type: "divorce" }
  | { type: "child" }
  | { type: "condition"; condition: string }
  | { type: "care"; amount: number }
  | { type: "closeness"; target: "partner"; partner?: string; delta: number }
  | { type: "closeness"; target: "children"; delta: number }
  | { type: "end"; ending: string; deathCause?: string };

/** Optional, non-stacking encouragement for an actually paid training outcome. */
export interface SkillGainModifier {
  flag: string;
  multiplier: number;
  reason: string;
}

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
  /** Optional diminishing multipliers for positive gains, ordered from min. */
  gainCurve?: { from: number; multiplier: number }[];
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

export interface OutcomeWeightModifier {
  when: Condition;
  multiplier: number;
  /** Short explanation shown when this circumstance changes the odds. */
  reason: string;
}

export interface Outcome {
  id: string;
  text: string;
  weight: number;
  effects: Effect[];
  /** Conditional relative-weight changes; no additional random draw. */
  weightModifiers?: OutcomeWeightModifier[];
}

export interface Choice {
  id: string;
  text: string;
  when?: Condition;
  outcomes: Outcome[];
  /** Outcomes counted as the advertised opportunity, rather than guaranteed work. */
  opportunity?: { label: string; outcomeIds: string[] };
}

export interface LifeEvent extends EvidenceMetadata {
  id: string;
  /** Seeded alternatives at one age; offering any member consumes the group. */
  exclusiveGroup?: string;
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
  /** Opt-in annual surprise lane, separate from ordinary weighted stories. */
  rarity?: "rare";
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

/** Optional causal-health rules; all rates and recovery effects are authored. */
export interface HealthConditionDefinition {
  id: string;
  title: string;
  deathCause: string;
  kind: "illness" | "injury" | "frailty";
  weight: number;
  when?: Condition;
  healthLoss: number;
  recoveryChance: number;
  careRecoveryBonus: number;
  fatalHealthThreshold: number;
}
export interface HealthDefinition {
  description: string;
  sourceIds: string[];
  stat: string;
  criticalHealth: number;
  declineCondition: string;
  careDecision: string;
  incidenceBands: { minAge: number; maxAge: number; annualProbability: number }[];
  declineBands: { minAge: number; maxAge: number; healthLoss: number }[];
  supportRecoveryBonus: number;
  conditions: HealthConditionDefinition[];
  /** Optional source-based baseline, decomposed into authored severe episodes. */
  mortalityCalibration?: {
    minAge: number;
    referenceHealth: number;
    referenceCare: number;
    caseFatality: number;
    onsetHealth: number;
    convalescenceLoss: number;
    healthInfluence: number;
    careInfluence: number;
  };
}
export interface ActiveHealthCondition {
  id: string;
  sinceAge: number;
  lastProgressAge: number;
  care: number;
  source?: string;
  /** Health immediately before a warned severe episode; care cannot erase it. */
  severe?: { healthBefore: number };
}
export interface HealthState { conditions: ActiveHealthCondition[]; needsCareDecision: boolean; lastCareAge?: number }

export interface RelationshipDefinition {
  description: string;
  initialCloseness: number;
  childCloseness: number;
  decayAfterYears: number;
  yearlyDecay: number;
  marriageMinimum: number;
  supportThreshold: number;
  maxHealthSupport: number;
}
export type SocialRole = "friend" | "business-partner";
export interface RelationshipTie { closeness: number; lastContactAge: number; roles?: SocialRole[] }
export interface RelationshipState { partners: Record<string, RelationshipTie>; children: Record<string, RelationshipTie> }

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

export type CharacterSex = "male" | "female";

/** A person generated only when their encounter is accepted in this life. */
export interface EncounteredPerson extends PartnerDefinition {
  sex: CharacterSex;
  avatarVariant: number;
  originId: string;
  metAge: number;
}

export interface CharacterActivity extends Choice {
  category: "training" | "career" | "relationship" | "family" | "finance";
  minAge?: number;
  cooldownYears?: number;
  /** Minor actions can retain their own cooldown without spending the annual activity. */
  usesYearlyActivity?: boolean;
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
  /** Opt-in birth identity; older packs retain their original RNG and state. */
  identity?: { namePools: { male: string[]; female: string[] }; avatarVariants: number };
  /** Partner definitions are encounter templates, not a pre-existing named pool. */
  proceduralPartners?: boolean;
  /** Explicit nonromantic roles for encountered people; older packs omit them. */
  socialRelationships?: boolean;
  /** Optional adult encounter lane; all probabilities are authored gameplay. */
  encounterPacing?: { firstMeetingChance: number; meetingChance: number; dateChance: number; cooldownYears: number };
  /** Optional seeded protagonist-name pool; omitted packs retain their original state. */
  playerNames?: string[];
  /** People must be introduced before courtship or marriage when enabled. */
  requireIntroductions?: boolean;
  /** Require an explicit breakup before courting another person. Older packs keep their rules. */
  exclusiveCourtship?: boolean;
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
  sex?: CharacterSex;
  avatarVariant?: number;
  people?: Record<string, EncounteredPerson>;
  datedPartnerIds?: string[];
  knownPartnerIds?: string[];
  skills: Record<string, number>;
  jobId: string | null;
  partnerId: string | null;
  relationshipStatus: RelationshipStatus;
  children: { id: string; name: string; birthAge: number; otherParentId: string }[];
  lastActivityAge: number | null;
  lastActivityAges: Record<string, number>;
  relationships?: RelationshipState;
}

export interface EconomyDefinition {
  stat: string;
  currency: { singular: string; plural: string; short: string };
  unitsPerPoint: number;
  description: string;
  sourceIds?: string[];
  /** Settle outstanding debt from remaining cash after regular yearly costs. */
  autoDebtRepayment?: boolean;
  /** An explicitly accepted risky contract, distinct from unpaid household bills. */
  moneylender?: {
    title: string;
    principal: number;
    fee: number;
    termYears: number;
    threatAfterYears: number;
    attackAfterYears: number;
    extensionYears: number;
    extensionFee: number;
    maxExtensions: number;
    events: { due: string; threat: string; attack: string };
  };
  assets: { id: string; title: string; description: string; value: number; maxOwned: number; yearlyIncome?: number }[];
}

export interface EconomyState {
  cash: number;
  debt: number;
  assets: Record<string, number>;
  /** Its balance is included once in debt. No entry exists before accepting a loan. */
  loan?: { balance: number; borrowedAge: number; dueAge: number; extensions: number; lastCollectionAge?: number };
}

/** Optional, authored retention and age-related Knowledge loss. */
export interface KnowledgeDefinition {
  stat: string;
  minAge: number;
  idleGraceYears: number;
  idleLoss: number;
  ageBands: { minAge: number; maxAge: number; loss: number }[];
  description: string;
}
export interface KnowledgeState { lastPracticeAge: number | null }

/** Optional soft penalties for repeated random stories. No event is forced. */
export interface EventVariety {
  /** Number of previous random events remembered separately in each lane. */
  recentWindow: number;
  /** Multiplier for an event in that lane's recent window, in 0.001..1. */
  recentWeight: number;
  /** Seen-once multiplier; subsequent occurrences taper harmonically, in 0.001..1. */
  repeatWeight: number;
}

/** Optional authored legacy, earned only by an accepted decision/activity outcome. */
export interface LegacyRouteDefinition {
  id: string;
  title: string;
  description: string;
  skillIds: string[];
  jobIds: string[];
  achievementIds: string[];
  earlyInterestFlag?: string;
  /** Optional later progression; achievements within one stage are alternatives. */
  stages?: { title: string; achievementIds: string[] }[];
}
export interface LegacyAchievementDefinition extends EvidenceMetadata {
  id: string;
  routeId: string;
  title: string;
  description: string;
  kind: "ordinary" | "prestige" | "ultimate";
  nameTemplate: string;
  /** Fictional contacts explicitly introduced by the awarding outcome. */
  people: string[];
}
export interface AccomplishmentRecord {
  id: string;
  achievementId: string;
  routeId: string;
  title: string;
  description: string;
  kind: "ordinary" | "prestige" | "ultimate";
  name: string;
  age: number;
  year: number;
  sourceId: string;
  outcomeId: string;
  people: string[];
}
export interface LegacyRouteProgress extends LegacyRouteDefinition {
  earned: readonly AccomplishmentRecord[];
  next?: LegacyAchievementDefinition;
}

/** The NFT that issued an influence command. Opaque to the engine. */
export interface InfluenceSource { contractId: string; tokenId: string }

/** Authored catalog entry an `influence` command may name. */
export interface InfluenceEntry {
  id: string;
  label: string;
  /** Impact weight: small stat effect 1, large stat effect 3, forced decision event 5. */
  baseWeight: 1 | 3 | 5;
  /** apply: numeric deltas scaled by power, applied immediately. */
  effects?: Effect[];
  /** apply: queued as the next pending decision; activate: joins this life's event pool. */
  event?: LifeEvent;
}

/** An activated influence, or an applied one whose event still awaits its turn. */
export interface InfluenceRecord { entry: string; source: InfluenceSource; power: number }

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
  eventPacing?: {
    minChoiceGapYears: number; maxChoiceGapYears: number; variety?: EventVariety;
    /** Shared annual gate and cooldown for marked rare decisions. */
    rareEvents?: { annualChance: number; cooldownYears: number };
  };
  mortality?: MortalityModel;
  health?: HealthDefinition;
  relationships?: RelationshipDefinition;
  character?: CharacterDefinition;
  economy?: EconomyDefinition;
  knowledge?: KnowledgeDefinition;
  legacy?: { routes: LegacyRouteDefinition[]; achievements: LegacyAchievementDefinition[] };
  sources?: HistoricalSource[];
  events: LifeEvent[];
  /** Optional catalog for `influence` commands; omitted packs have no influences. */
  influences?: InfluenceEntry[];
  endings: Ending[];
  /** Used at maxAge if no other ending applies. */
  defaultEnding: string;
}

/** Issued by a ranked life's NFT sources; free play never contains one. */
export interface InfluenceCommand { type: "influence"; source: InfluenceSource; entry: string; power: number; mode: "activate" | "apply" }

export type Command = { type: "advance" } | { type: "choose"; choice: string } | { type: "act"; activity: string } | { type: "avatar"; variant: number } | InfluenceCommand;

export interface JournalEntry {
  type: "birth" | "year" | "event" | "choice" | "outcome" | "ending" | "activity" | "influence";
  age: number;
  year: number;
  id: string;
  text: string;
  /** Only on an influence entry, or on the event entry of a fired influence event. */
  source?: InfluenceSource;
  /** Only on influence entries: nonzero applied changes keyed by stat id, `skill:<id>`, `economy:cash` or `economy:debt`. */
  deltas?: Record<string, number>;
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
  deathCauseKind?: "choice" | "condition";
  health?: HealthState;
  knowledge?: KnowledgeState;
  /** Omitted entirely for earlier packs, preserving their exact snapshots. */
  accomplishments?: AccomplishmentRecord[];
  /** Omitted until the first activation; activated entries' events join the pool. */
  activeInfluences?: InfluenceRecord[];
  /** Applied influence events waiting for the current decision to resolve. */
  queuedInfluences?: InfluenceRecord[];
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
  chooseAvatar(state: LifeState, variant: number): LifeState;
  influence(state: LifeState, command: InfluenceCommand): LifeState;
  replay(seed: string, commands: readonly Command[]): LifeState;
  save(state: LifeState): string;
  load(json: string): LifeState;
}
