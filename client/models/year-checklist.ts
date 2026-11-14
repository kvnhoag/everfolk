import { sectionStep, SECTION_TITLES, type SectionStepId } from "./section-steps.ts";

/**
 * "This year": one numbered line per section with what it needs now. To do (gold), done (green),
 * locked with its unlock age (grey) or just information. Pure, so every state can be tested.
 */

export type ChecklistState = "todo" | "done" | "locked" | "info";

export interface ChecklistItem {
  id: SectionStepId;
  step: number;
  title: string;
  status: string;
  state: ChecklistState;
}

export interface YearFacts {
  age: number;
  phase: "ready" | "choice" | "ended";
  playing: boolean;
  /** The chosen focus's label, or null for Everyday life (no focus). */
  focusLabel: string | null;
  /** The age the first focus opens; Infinity when the world has none. */
  focusAge: number;
  actionAge: number;
  actionUsed: boolean;
  /** Household fields exist (the free-play economy is on). */
  hasFields: boolean;
  fieldsAge: number;
  grainPlots: number;
  flaxPlots: number;
  /** The age trading opens; null when the world has no market. */
  tradeAge: number | null;
  marketVisited: boolean;
  recordYears: number;
}

function item(id: SectionStepId, state: ChecklistState, status: string): ChecklistItem {
  return { id, step: sectionStep(id), title: SECTION_TITLES[id], state, status };
}

function time(facts: YearFacts): ChecklistItem {
  if (facts.phase === "ended") return item("time", "info", "Life ended");
  if (facts.phase === "choice") return item("time", "todo", "Open the decision");
  return facts.playing ? item("time", "done", "Running") : item("time", "todo", "Paused: press Resume");
}

function focus(facts: YearFacts): ChecklistItem {
  if (facts.age < facts.focusAge) return item("focus", "locked", Number.isFinite(facts.focusAge) ? `Opens at age ${facts.focusAge}` : "Not in this world");
  return facts.focusLabel ? item("focus", "done", facts.focusLabel) : item("focus", "todo", "Pick one");
}

function action(facts: YearFacts): ChecklistItem {
  if (facts.age < facts.actionAge) return item("action", "locked", `Opens at age ${facts.actionAge}`);
  if (facts.actionUsed) return item("action", "done", "Done this year");
  return facts.phase === "choice" ? item("action", "info", "After the decision") : item("action", "todo", "1 left");
}

function household(facts: YearFacts): ChecklistItem {
  if (facts.age < facts.fieldsAge) return item("household", "locked", `Opens at age ${facts.fieldsAge}`);
  return item("household", "info", `${facts.grainPlots} grain · ${facts.flaxPlots} flax`);
}

function town(facts: YearFacts): ChecklistItem {
  if (facts.tradeAge === null) return item("town", "info", "People and work");
  if (facts.age < facts.tradeAge) return item("town", "locked", `Trade at age ${facts.tradeAge}`);
  return facts.marketVisited ? item("town", "done", "Market visited") : item("town", "todo", "1 market visit");
}

export function yearChecklist(facts: YearFacts): ChecklistItem[] {
  if (facts.phase === "ended") return [time(facts), item("record", "info", `${facts.recordYears} years`)];
  return [
    time(facts), focus(facts), action(facts),
    ...(facts.hasFields ? [household(facts), town(facts)] : []),
    item("record", "info", `${facts.recordYears} ${facts.recordYears === 1 ? "year" : "years"}`),
  ];
}

/** The first thing still to do, which the idle hint points at; null when nothing waits. */
export function nextTodo(items: readonly ChecklistItem[]): ChecklistItem | null {
  return items.find(entry => entry.state === "todo") ?? null;
}
