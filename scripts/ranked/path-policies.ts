// Deterministic "deliberate player" policies for ranked lives: each path pursues one figure's
// or one NPC career's route through the normal engine API, so a ranked session can adopt every
// returned state with `session.sync(next)`. Used by test/chain-figure-calibration.test.ts.
import { advanceYearWithFocus, selectAutomaticChoice, type YearlyFocusId } from "../../client/yearly-focus.ts";
import type { Choice, LifeEngine, LifeState, WorldPack } from "../../src/types.ts";

export interface CareerPath {
  /** Legacy route whose early-interest flag the player cultivates in childhood choices. */
  route?: string;
  /** The path's jobs, highest first; the player seeks the highest one above its current job. */
  careers: readonly string[];
  /** Path work and accomplishment activities, in priority order. */
  steps: readonly string[];
  /** Skill → the level the player trains it to; skill-tree prerequisites are trained first. */
  training: Readonly<Record<string, number>>;
  /** Decision options whose id or text matches score a point. */
  choices: RegExp;
}

const MILITARY_STEPS = ["complete-service-assignment", "organise-unit-supplies", "organise-war-supplies", "drill-a-unit"] as const;
const MILITARY_CHOICES = /militar|army|soldier|officer|general|drill|serve|command|unit|garrison|war/i;
const SKY_CHOICES = /astronom|astrolog|sky|calendar|table|chart|star|geometr|proof|museum|reckon|count|measure|school|read|study/i;

/**
 * Figure paths mirror chain/catalog/figures.ts; NPC paths cover the letters, military and sky
 * career groups. Alexander's path also needs a royal-household birth, which no policy can choose.
 */
export const PATHS = {
  alexander: {
    route: "military",
    careers: ["general", "officer", "soldier"],
    steps: MILITARY_STEPS,
    training: { warfare: 100, oratory: 100, reckoning: 25 },
    choices: MILITARY_CHOICES,
  },
  aristotle: {
    route: "philosophy",
    careers: ["court-adviser", "philosophy-tutor"],
    steps: ["teach-a-reading-lesson", "prepare-official-petition", "moderate-philosophy-discussion"],
    training: { literacy: 100, philosophy: 100, oratory: 100 },
    choices: /philosoph|lyceum|argument|teach|tutor|read|letters|study|question|reason|court/i,
  },
  euclid: {
    route: "astronomy-calendar",
    careers: ["patron-supported-reader", "sky-table-calculator"],
    steps: ["copy-a-sky-table", "show-sky-calculations", "check-calendar-tables"],
    training: { reckoning: 100, literacy: 100, astronomy: 100 },
    choices: SKY_CHOICES,
  },
  cleomenes: {
    route: "commerce",
    careers: ["shopkeeper"],
    steps: ["fulfil-significant-order", "check-cargo-accounts", "help-count-stock"],
    training: { reckoning: 100, literacy: 100, craft: 15 },
    choices: /commerc|trade|merchant|shop|sell|cargo|invest|grain|account|stock|order|price|profit|count|reckon/i,
  },
  /** Letters group: a copyist. */
  letters: {
    careers: ["copyist"],
    steps: ["careful-copy"],
    training: { literacy: 100 },
    choices: /copy|letters|read|writ|study|scribe|book/i,
  },
  /** Military group: a soldier who seeks an officer's commission. */
  military: {
    route: "military",
    careers: ["officer", "soldier"],
    steps: MILITARY_STEPS,
    training: { warfare: 100, oratory: 40, reckoning: 25 },
    choices: MILITARY_CHOICES,
  },
  /** Sky group: an astrologer (astronomy and reckoning come first through the skill tree). */
  sky: {
    route: "astronomy-calendar",
    careers: ["astrologer"],
    steps: ["prepare-a-chart-reading", "research-astrological-readings"],
    training: { astrology: 100, astronomy: 40, reckoning: 30, literacy: 30 },
    choices: SKY_CHOICES,
  },
} as const satisfies Record<string, CareerPath>;

export type PathId = keyof typeof PATHS;
export const PATH_IDS = Object.keys(PATHS) as PathId[];

/** Random draws in [0, n); deterministic for a seed string (FNV-1a seeded xorshift32). */
export type Rng = (n: number) => number;

export function createRng(seed: string): Rng {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i++) x = Math.imul(x ^ seed.charCodeAt(i), 16777619);
  x = x | 0 || 1;
  return n => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) % n; };
}

/**
 * Off-path jobs a player short of cash takes so training stays affordable, in preference order.
 * All are the lowest tier of their career group, so a later path career still decides the
 * life's NPC career group (chain/match.ts breaks equal tiers by the most recent job).
 */
const FALLBACK_JOBS = ["porter", "copyist", "apprentice"];
/** Treatment activities; they do not use the yearly activity. */
const CARE_ACTIVITIES = ["seek-a-healer", "ask-household-care", "rest-for-recovery"];
const LOW_CASH = 20;
const STEP_LIMIT = 5_000;

interface WorldIndex {
  /** job id → the activity that takes it (the first whose outcome assigns the job). */
  jobActivity: Map<string, string>;
  /** activity id → accomplishments it can grant. */
  grants: Map<string, string[]>;
  /** job id → the wealth points it adds each year. */
  wages: Map<string, number>;
  interestFlags: Map<string, string | undefined>;
}

const indexes = new WeakMap<WorldPack, WorldIndex>();

function indexFor(world: WorldPack): WorldIndex {
  const cached = indexes.get(world);
  if (cached) return cached;
  const jobActivity = new Map<string, string>();
  const grants = new Map<string, string[]>();
  for (const activity of world.character?.activities ?? []) {
    const effects = activity.outcomes.flatMap(outcome => outcome.effects);
    for (const effect of effects) {
      if (effect.type === "job" && effect.job && !jobActivity.has(effect.job)) jobActivity.set(effect.job, activity.id);
    }
    grants.set(activity.id, effects.flatMap(effect => effect.type === "accomplishment" ? [effect.achievement] : []));
  }
  const interestFlags = new Map((world.legacy?.routes ?? []).map(route => [route.id, route.earlyInterestFlag] as const));
  const unitsPerPoint = world.economy?.unitsPerPoint ?? 1;
  const wages = new Map((world.character?.jobs ?? []).map(job => [job.id, (job.yearlyEffects ?? []).reduce((sum, effect) =>
    sum + (effect.type === "stat" && effect.stat === world.economy?.stat ? effect.delta : effect.type === "cash" ? effect.delta / unitsPerPoint : 0), 0)] as const));
  const index = { jobActivity, grants, wages, interestFlags };
  indexes.set(world, index);
  return index;
}

/** The activity that trains `skill`, or the one for its first unmet prerequisite. */
function trainingFor(world: WorldPack, skill: string, skills: Readonly<Record<string, number>>, depth = 0): string | undefined {
  const definition = world.character?.skills[skill];
  const missing = Object.entries(definition?.prerequisites ?? {}).find(([id, level]) => (skills[id] ?? 0) < level);
  return missing && depth < 8 ? trainingFor(world, missing[0], skills, depth + 1) : definition?.trainingActivity;
}

function careerStep(path: CareerPath, state: LifeState, available: ReadonlySet<string>, index: WorldIndex): string | undefined {
  const current = path.careers.indexOf(state.character?.jobId ?? "");
  const reachable = current === -1 ? path.careers : path.careers.slice(0, current);
  return reachable.map(job => index.jobActivity.get(job)).find((id): id is string => !!id && available.has(id));
}

/** Career first, then path work, then better-paid work when short of cash, then the training furthest behind its target. */
export function pathActivity(engine: LifeEngine, state: LifeState, path: CareerPath): string | undefined {
  const index = indexFor(engine.world);
  const available = new Set(engine.getActivities(state).filter(item => item.available).map(item => item.id));
  const held = new Set((state.accomplishments ?? []).map(record => record.achievementId));
  const step = careerStep(path, state, available, index) ??
    path.steps.find(id => available.has(id) && !(index.grants.get(id) ?? []).some(achievement => held.has(achievement)));
  if (step) return step;
  const job = state.character?.jobId ?? null;
  if ((state.economy?.cash ?? 0) < LOW_CASH && !(job && path.careers.includes(job))) {
    const wage = job ? index.wages.get(job) ?? 0 : -Infinity;
    const work = FALLBACK_JOBS
      .filter(candidate => (index.wages.get(candidate) ?? 0) > wage)
      .map(candidate => index.jobActivity.get(candidate))
      .find((id): id is string => !!id && available.has(id));
    if (work) return work;
  }
  const skills = state.character?.skills ?? {};
  return Object.entries(path.training)
    .filter(([skill, target]) => (skills[skill] ?? 0) < target)
    .sort(([a, targetA], [b, targetB]) => (skills[a] ?? 0) / targetA - (skills[b] ?? 0) / targetB)
    .map(([skill]) => trainingFor(engine.world, skill, skills))
    .find((activity): activity is string => !!activity && available.has(activity));
}

/** How well an option serves the path: its early interest, then its path skills, then its wording. */
function pathScore(path: CareerPath, choice: Choice, index: WorldIndex): number {
  const interest = path.route ? index.interestFlags.get(path.route) : undefined;
  const effects = choice.outcomes.flatMap(outcome => outcome.effects);
  const cultivates = !!interest && effects.some(effect => effect.type === "flag" && effect.flag === interest && effect.value);
  const skills = effects.reduce((sum, effect) =>
    sum + (effect.type === "skill" && effect.skill in path.training ? Math.max(0, effect.delta) : 0), 0);
  return (cultivates ? 10 : 0) + Math.min(skills, 9) / 10 + (path.choices.test(`${choice.id} ${choice.text}`) ? 1 : 0);
}

/** Medical decisions take the safest option; otherwise the best-scoring options, safest first. */
export function pathChoice(engine: LifeEngine, state: LifeState, path: CareerPath): Choice {
  const choices = engine.getChoices(state);
  if (!choices.length) throw new Error(`No choice is available for ${state.pendingEventId}.`);
  const index = indexFor(engine.world);
  const medical = state.pendingEventId === engine.world.health?.careDecision;
  const scores = choices.map(choice => medical ? 0 : pathScore(path, choice, index));
  const best = Math.max(...scores);
  const preferred = best > 0 ? choices.filter((_, i) => scores[i] === best) : choices;
  return selectAutomaticChoice(preferred, engine.world, state) ?? preferred[0];
}

/** A careful player treats an illness before the year's activity. */
function careFor(engine: LifeEngine, state: LifeState): LifeState {
  const care = engine.getActivities(state).find(item => CARE_ACTIVITIES.includes(item.id) && item.available);
  return care ? engine.act(state, care.id) : state;
}

const resolvePath = (path: PathId | CareerPath): CareerPath => typeof path === "string" ? PATHS[path] : path;

/**
 * One step of a deliberate life: answers a pending decision, or treats illness, takes the
 * path's activity for the year and advances. Returns the next state (or the same one if ended).
 * The rng is accepted for a uniform policy signature; the deliberate policy does not need it.
 */
export function nextState(engine: LifeEngine, state: LifeState, path: PathId | CareerPath, _rng?: Rng): LifeState {
  if (state.phase === "ended") return state;
  const plan = resolvePath(path);
  if (state.phase === "choice") return engine.choose(state, pathChoice(engine, state, plan).id);
  const cared = careFor(engine, state);
  if (cared.phase !== "ready") return cared;
  const activity = pathActivity(engine, cared, plan);
  const acted = activity ? engine.act(cared, activity) : cared;
  return acted.phase === "ready" ? engine.advance(acted) : acted;
}

/**
 * One step of an unfocused life, like the genesis lives: a fixed yearly focus, and seven in ten
 * decisions take Auto mode's safe pick while the rest are random.
 */
export function unfocusedState(engine: LifeEngine, state: LifeState, focus: YearlyFocusId, rng: Rng): LifeState {
  if (state.phase === "ended") return state;
  if (state.phase !== "choice") return advanceYearWithFocus(engine, state, focus);
  const choices = engine.getChoices(state);
  const safe = selectAutomaticChoice(choices, engine.world, state);
  return engine.choose(state, (rng(10) < 7 && safe ? safe : choices[rng(choices.length)]).id);
}

/** Plays a deliberate life to its end; deterministic for the engine, starting state and seed. */
export function playToEnd(engine: LifeEngine, state: LifeState, path: PathId | CareerPath, seed: string = state.seed): LifeState {
  const rng = createRng(seed);
  let next = state;
  for (let steps = 0; next.phase !== "ended" && steps < STEP_LIMIT; steps++) next = nextState(engine, next, path, rng);
  if (next.phase !== "ended") throw new Error(`Life ${state.seed} did not end within ${STEP_LIMIT} steps.`);
  return next;
}

/** Plays an unfocused life to its end. */
export function playUnfocusedToEnd(engine: LifeEngine, state: LifeState, focus: YearlyFocusId, seed: string = state.seed): LifeState {
  const rng = createRng(seed);
  let next = state;
  for (let steps = 0; next.phase !== "ended" && steps < STEP_LIMIT; steps++) next = unfocusedState(engine, next, focus, rng);
  if (next.phase !== "ended") throw new Error(`Life ${state.seed} did not end within ${STEP_LIMIT} steps.`);
  return next;
}
