/** The age the yearly personal action board appears. */
export const YEARLY_ACTION_AGE = 6;

/**
 * The yearly "Plan this year" notice and its callout. It names at most one thing, and only something the player can
 * do now: the next step they have not learned yet (focus, then the yearly action, the market, the fields), or a
 * problem a click can fix. A step is pointed at once at most, and a problem once while it lasts, so nothing repeats
 * year after year. Pure, so every rule is tested.
 */

/** In teaching order. */
export const YEAR_TASKS = ["focus", "action", "market", "planting"] as const;
export type YearTask = typeof YEAR_TASKS[number];

export interface YearTaskFacts {
  /** "ready" while the year runs; nothing is named during a decision or after the life ends. */
  phase: "ready" | "choice" | "ended";
  /** Steps the player can use right now (the action not spent, the market visit not used). */
  open: readonly YearTask[];
  /** Steps the player has used at least once in this life. */
  learned: readonly YearTask[];
  /** Steps an earlier year's notice already pointed at. */
  pointed: readonly YearTask[];
  /** Steps whose tip introduces them this year; the tip does the pointing. */
  introduced: readonly YearTask[];
  /** The field plan has a problem a new plan fixes (no seed, no grain plots). */
  planProblem: boolean;
  /** The grain store is, or after this harvest will be, over its limit: selling grain fixes it. */
  overfull: boolean;
  /** Problems already named and not solved since. */
  ongoing: readonly YearTask[];
}

export interface YearReminderPick {
  task: YearTask;
  reason: "learn" | "problem";
}

/** Each step's section, as selector alternatives (the first one drawn is pointed at). */
export const YEAR_TASK_TARGETS: Record<YearTask, readonly string[]> = {
  focus: [".yearly-focus"],
  action: [".life-yearly-action-deck"],
  market: [".demo-economy section[aria-label='Grain market']:not([hidden])", ".demo-economy .demo-deck-tab[data-tab='market']"],
  planting: [".aoe-planting-row", ".demo-economy .demo-deck-tab[data-tab='farm']"],
};

function problem(facts: YearTaskFacts): YearReminderPick | null {
  const open = (task: YearTask) => facts.open.includes(task) && !facts.ongoing.includes(task);
  if (facts.planProblem && open("planting")) return { task: "planting", reason: "problem" };
  // Selling grain empties an overfull store; a new field plan cannot, so the fields are never named for it.
  if (facts.overfull && open("market")) return { task: "market", reason: "problem" };
  return null;
}

/** The one thing to name this year, or null when there is nothing new for the player to do. */
export function yearTask(facts: YearTaskFacts): YearReminderPick | null {
  if (facts.phase !== "ready") return null;
  const learn = YEAR_TASKS.find(task => facts.open.includes(task) && !facts.learned.includes(task)
    && !facts.pointed.includes(task) && !facts.introduced.includes(task));
  return problem(facts) ?? (learn ? { task: learn, reason: "learn" } : null);
}

export interface YearReminderLine {
  /** The thing named, as it appears in both the notice and the callout. */
  thing: string;
  /** The notice's sentence. */
  body: string;
  /** The words on the section the callout points at. */
  label: string;
}

const LINES: Record<YearReminderPick["reason"], Record<YearTask, Omit<YearReminderLine, "label"> | null>> = {
  learn: {
    focus: { thing: "focus", body: "Choose a focus: what you practise this year." },
    action: { thing: "action", body: "Choose this year's action: people, training or work." },
    market: { thing: "market", body: "Visit the market once this year to buy or sell." },
    planting: { thing: "fields", body: "Plan your fields in Farm & Granary." },
  },
  problem: {
    focus: null,
    action: null,
    market: { thing: "sell grain", body: "Your grain store is over its limit: sell grain at the market." },
    planting: { thing: "field plan", body: "Your field plan has a problem: check your field plan." },
  },
};

const LABELS: Record<YearTask, Record<YearReminderPick["reason"], string>> = {
  focus: { learn: "This year: choose a focus", problem: "" },
  action: { learn: "This year: choose an action", problem: "" },
  market: { learn: "This year: visit the market", problem: "Sell grain here" },
  planting: { learn: "This year: plan your fields", problem: "Fix your field plan here" },
};

export function yearReminderLine(pick: YearReminderPick): YearReminderLine {
  const line = LINES[pick.reason][pick.task] ?? LINES.learn[pick.task]!;
  return { ...line, label: LABELS[pick.task][pick.reason] || LABELS[pick.task].learn };
}

/** One notice per life and year; the key never repeats, so a year is only announced once. */
export function yearReminderKey(lifeKey: string, age: number): string {
  return `year-reminder:${lifeKey}:${age}`;
}
