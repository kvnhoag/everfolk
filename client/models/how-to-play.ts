import { sectionStep, type SectionStepId } from "./section-steps.ts";

/**
 * Page 1 of How to Play, written like a board-game rule sheet: the goal first, then one numbered step per
 * section of the screen (the same numbers the screen shows), each with a tiny "do this → get that" example,
 * and a one-line rhythm for every year.
 */

export interface PlayChip { icon: string; text: string; tone?: "gain" | "loss" | "neutral" | "action" }

export interface PlayStep {
  id: SectionStepId;
  step: number;
  title: string;
  body: string;
  /** "Do this" on the left of the arrow. */
  doThis: PlayChip;
  /** "Get that" on the right of the arrow. */
  getThat: PlayChip[];
  /** When the step is not open from birth. */
  opens?: string;
}

export const HOW_TO_PLAY_GOAL = "Live one life on Egypt's ancient coast, from birth to old age. Grow skills, wealth and family; a life that reaches 18 earns a pack of cards.";

/** The rhythm of every year, like a board game's "play, then draw". */
export const YEAR_RHYTHM = "Every year: pick a focus, use your action, answer turning points, let the year run.";

function step(id: SectionStepId, rest: Omit<PlayStep, "id" | "step">): PlayStep {
  return { id, step: sectionStep(id), ...rest };
}

export function howToPlaySteps(ages: { focus: number; action: number; fields: number; trade: number | null }): PlayStep[] {
  return [
    step("time", { title: "Let the year run",
      body: "A year passes every few seconds. Pause, resume or speed up. A turning point stops the clock until you choose.",
      doThis: { icon: "play", text: "Resume", tone: "action" }, getThat: [{ icon: "hourglass", text: "Age +1" }] }),
    step("focus", { title: "Choose a focus",
      body: "Study, Farming, Friends… Each year your focus is practised for you, so its skills grow on their own.",
      doThis: { icon: "literacy", text: "Study", tone: "action" }, getThat: [{ icon: "book", text: "Knowledge +1", tone: "gain" }],
      opens: Number.isFinite(ages.focus) ? `Age ${ages.focus}` : undefined }),
    step("action", { title: "Spend your yearly action",
      body: "One card a year: time with people, training or work. Press Do on the card you want.",
      doThis: { icon: "check", text: "Do →", tone: "action" }, getThat: [{ icon: "people", text: "Bonds +0.2", tone: "gain" }, { icon: "coin", text: "+10 dr", tone: "gain" }],
      opens: `Age ${ages.action}` }),
    step("household", { title: "Plan the household",
      body: "Inventory & Granary: split the fields between grain (food, rent) and flax (linen to sell).",
      doThis: { icon: "res-grain", text: "2 grain · 1 flax", tone: "action" }, getThat: [{ icon: "res-grain", text: "+1300", tone: "gain" }, { icon: "home", text: "−260 rent", tone: "loss" }],
      opens: ages.fields > 0 ? `Age ${ages.fields}` : undefined }),
    step("town", { title: "Trade and find work",
      body: "Market & Trade: one visit a year to buy or sell. People & Town and Career open as you grow.",
      doThis: { icon: "commerce", text: "Sell 30 grain", tone: "action" }, getThat: [{ icon: "coin", text: "+24 dr", tone: "gain" }],
      opens: ages.trade === null ? undefined : `Trade at ${ages.trade}` }),
    step("record", { title: "Read your story",
      body: "The Life record keeps every year: what happened, what you gained and what you lost.",
      doThis: { icon: "feather", text: "Life record", tone: "action" }, getThat: [{ icon: "heart", text: "+0.2", tone: "gain" }, { icon: "coin", text: "+167 dr", tone: "gain" }] }),
  ];
}
