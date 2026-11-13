import { sectionStep, type SectionStepId } from "./section-steps.ts";

/**
 * How to Play, written like a board-game rule sheet but shown with the game's own screens: three key facts, one
 * numbered step per section (the numbers the screen shows) with a real screenshot, the year as a loop, and the
 * life stages as a road. Screenshots live in public/assets/how-to-play/.
 */

const SHOTS = "/assets/how-to-play";

export interface Shot { src: string; width: number; height: number; alt: string }

export interface PlayStep {
  id: SectionStepId;
  step: number;
  title: string;
  /** One line: what to do here. */
  body: string;
  /** The section as it looks in the game. */
  shot: Shot;
  /** When the step is not open from birth. */
  opens?: string;
  /** The one rule people trip over, shown with a warning sign. */
  warning?: string;
}

/** Three numbered facts that frame everything else, like a quick-reference card. */
export const KEY_FACTS: readonly string[] = [
  "You live one life. The clock runs by itself; you steer it.",
  "Everything is scarce: one action a year, one market visit, grain to eat.",
  "Reach 18 to earn a card pack; titles and a long life earn more.",
];

/** The rhythm of every year, like a board game's "play, then draw". */
export const YEAR_RHYTHM = "Every year: pick a focus, use your action, answer turning points, let the year run.";

function shot(name: string, width: number, height: number, alt: string): Shot {
  return { src: `${SHOTS}/${name}.webp`, width, height, alt };
}

function step(id: SectionStepId, rest: Omit<PlayStep, "id" | "step">): PlayStep {
  return { id, step: sectionStep(id), ...rest };
}

export function howToPlaySteps(ages: { focus: number; action: number; fields: number; trade: number | null }): PlayStep[] {
  return [
    step("time", { title: "Let the year run", body: "Resume, pause or speed up. A year passes every few seconds.",
      shot: shot("time-bar", 411, 45, "The time bar: Resume and the speeds 1× to 16×"),
      warning: "A turning point stops the clock until you choose." }),
    step("focus", { title: "Choose a focus", body: "What you practise every year, without a click.",
      shot: shot("focus", 640, 85, "This year's focus: Everyday life, Study, Farming, Friends and more"),
      opens: Number.isFinite(ages.focus) ? `Age ${ages.focus}` : undefined, warning: "Knowledge you stop practising fades." }),
    step("action", { title: "Spend your yearly action", body: "Press Do on one card: people, training or work.",
      shot: shot("action", 640, 314, "Yearly action cards, each with a Do button and what it changes"),
      opens: `Age ${ages.action}`, warning: "One a year; an unused action does not carry over." }),
    step("household", { title: "Plan the household", body: "Inventory & Granary: split the fields into grain and flax.",
      shot: shot("tasks", 615, 239, "Plan your fields: grain and flax plots with − and + and Set planting"),
      opens: ages.fields > 0 ? `Age ${ages.fields}` : undefined, warning: "If the store runs out, the household goes hungry." }),
    step("town", { title: "Trade and find work", body: "Market & Trade: buy or sell once a year. Work opens as you grow.",
      shot: shot("market", 640, 378, "The grain market: what you hold, prices and Sell or Buy"),
      opens: ages.trade === null ? undefined : `Age ${ages.trade}`, warning: "Keep enough grain for the household to eat." }),
    step("record", { title: "Read your story", body: "Every year's events, with what you gained and lost.",
      shot: shot("record", 600, 253, "The Life record: each year's events with gains in green and losses in red") }),
  ];
}

/** The whole game screen, with each numbered section's box in percent of the image. */
export const SCREEN_SHOT: Shot & { areas: Record<SectionStepId, { x: number; y: number; w: number; h: number }> } = {
  ...shot("screen", 900, 1238, "The game screen with its six numbered sections"),
  areas: {
    time: { x: 1.52, y: 1.32, w: 96.97, h: 3.41 },
    household: { x: 1.52, y: 16.02, w: 96.97, h: 2.75 },
    action: { x: 48.77, y: 19.76, w: 49.72, h: 23.73 },
    town: { x: 48.77, y: 44.26, w: 49.72, h: 55.74 },
    focus: { x: 1.52, y: 51.81, w: 45.89, h: 10.19 },
    record: { x: 1.52, y: 78.93, w: 45.89, h: 20.19 },
  },
};

/** The "This year" checklist and a decision, as they look in the game. */
export const CHECKLIST_SHOT = shot("checklist", 1100, 52, "This year: the numbered checklist under the time bar");
export const DECISION_SHOT = shot("decision", 482, 299, "A turning point: numbered options to choose from");

/** What the icons on the household bar mean; the bar itself shows icons and numbers only. */
export const BAR_LEGEND: readonly { icon: string; label: string }[] = [
  { icon: "res-grain", label: "Grain / store size" }, { icon: "res-drachmas", label: "Cash" }, { icon: "res-flax", label: "Flax" },
  { icon: "res-linen", label: "Linen" }, { icon: "res-ox", label: "Oxen" }, { icon: "res-donkey", label: "Donkeys" },
  { icon: "res-fields", label: "Grain plots" }, { icon: "res-flax-plots", label: "Flax plots" }, { icon: "res-reputation", label: "Reputation" },
  { icon: "flood", label: "Flood" }, { icon: "military", label: "Army" }, { icon: "road", label: "Road" },
];

/** "A year, in order": what happens every year, scripted like a game's night order. */
export interface YearBeat { title: string; detail: string; icon: string; you?: boolean }

export const YEAR_SCRIPT: readonly YearBeat[] = [
  { icon: "sun", title: "The year opens", detail: "Flood, army and road for the year." },
  { icon: "check", title: "You act", detail: "Focus, yearly action, one market visit.", you: true },
  { icon: "pin", title: "Turning points", detail: "The clock waits for your choice.", you: true },
  { icon: "res-grain", title: "Harvest settled", detail: "Harvest in, rent, wages, the household eats, grain spoils, flax is spun." },
  { icon: "commerce", title: "The town moves", detail: "Merchants trade; prices change." },
  { icon: "feather", title: "A year older", detail: "Age +1; new things may unlock." },
];
