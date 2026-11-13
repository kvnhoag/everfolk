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
  /** The one rule people trip over, shown with a warning sign (rule-sheet style). */
  warning?: string;
}

/** Three numbered facts that frame everything else, like a quick-reference card. */
export const KEY_FACTS: readonly string[] = [
  "You live one life. The clock runs by itself; you steer where it goes.",
  "Everything is scarce: one action a year, one market visit, and grain the household must eat.",
  "Reach 18 to earn a card pack. Titles, skills and a long life earn more cards.",
];

/** The rhythm of every year, like a board game's "play, then draw". */
export const YEAR_RHYTHM = "Every year: pick a focus, use your action, answer turning points, let the year run.";

function step(id: SectionStepId, rest: Omit<PlayStep, "id" | "step">): PlayStep {
  return { id, step: sectionStep(id), ...rest };
}

export function howToPlaySteps(ages: { focus: number; action: number; fields: number; trade: number | null }): PlayStep[] {
  return [
    step("time", { title: "Let the year run",
      body: "A year passes every few seconds. Pause, resume or speed up whenever you like.",
      doThis: { icon: "play", text: "Resume", tone: "action" }, getThat: [{ icon: "hourglass", text: "Age +1" }],
      warning: "A turning point stops the clock until you choose (or turn on Auto mode)." }),
    step("focus", { title: "Choose a focus",
      body: "Study, Farming, Friends… Each year your focus is practised for you, so its skills grow on their own.",
      doThis: { icon: "literacy", text: "Study", tone: "action" }, getThat: [{ icon: "book", text: "Knowledge +1", tone: "gain" }],
      opens: Number.isFinite(ages.focus) ? `Age ${ages.focus}` : undefined,
      warning: "Knowledge you stop practising slowly fades." }),
    step("action", { title: "Spend your yearly action",
      body: "One card a year: time with people, training or work. Press Do on the card you want.",
      doThis: { icon: "check", text: "Do →", tone: "action" }, getThat: [{ icon: "people", text: "Bonds +0.2", tone: "gain" }, { icon: "coin", text: "+10 dr", tone: "gain" }],
      opens: `Age ${ages.action}`,
      warning: "One action a year: an unused one does not carry over." }),
    step("household", { title: "Plan the household",
      body: "Inventory & Granary: split the fields between grain (food, rent) and flax (linen to sell).",
      doThis: { icon: "res-grain", text: "2 grain · 1 flax", tone: "action" }, getThat: [{ icon: "res-grain", text: "+1300", tone: "gain" }, { icon: "home", text: "−260 rent", tone: "loss" }],
      opens: ages.fields > 0 ? `Age ${ages.fields}` : undefined,
      warning: "If the store runs out, the household goes hungry and health drops." }),
    step("town", { title: "Trade and find work",
      body: "Market & Trade: one visit a year to buy or sell. People & Town and Career open as you grow.",
      doThis: { icon: "commerce", text: "Sell 30 grain", tone: "action" }, getThat: [{ icon: "coin", text: "+24 dr", tone: "gain" }],
      opens: ages.trade === null ? undefined : `Trade at ${ages.trade}`,
      warning: "Selling grain the household needs to eat leaves everyone short." }),
    step("record", { title: "Read your story",
      body: "The Life record keeps every year: what happened, what you gained and what you lost.",
      doThis: { icon: "feather", text: "Life record", tone: "action" }, getThat: [{ icon: "heart", text: "+0.2", tone: "gain" }, { icon: "coin", text: "+167 dr", tone: "gain" }] }),
  ];
}

/** "Your screen": what each numbered area is for, like an annotated card. Layout positions are grid areas. */
export interface ScreenArea { id: SectionStepId; step: number; label: string; note: string }

export function screenAreas(): ScreenArea[] {
  const note: Record<SectionStepId, [string, string]> = {
    time: ["Time bar", "Pause or Resume, speed 1×–16×, Next decision, Auto mode."],
    focus: ["This year’s focus", "What you practise every year without a click."],
    action: ["Yearly action", "One card a year: people, training or work."],
    household: ["Household bar", "Grain, cash, goods and fields; Inventory & Granary opens the store."],
    town: ["Market & town", "Trade, the farm, career, people and town works in tabs."],
    record: ["Life record", "Every year’s events, newest first."],
  };
  return (Object.keys(note) as SectionStepId[]).map(id => ({ id, step: sectionStep(id), label: note[id][0], note: note[id][1] }));
}

/** "A year, in order": what happens every year, scripted like a game's night order. */
export interface YearBeat { title: string; line: string; detail: string; icon: string; you?: boolean }

export const YEAR_SCRIPT: readonly YearBeat[] = [
  { icon: "sun", title: "The year opens", line: "“The Nile rises…”", detail: "Family news, then this year’s flood, army and road appear on the household bar." },
  { icon: "check", title: "You act", line: "“What will you do this year?”", detail: "Your focus is practised, you spend your yearly action and may visit the market once.", you: true },
  { icon: "pin", title: "Turning points", line: "“A choice is waiting.”", detail: "The clock stops until you decide; your family decides while you are small.", you: true },
  { icon: "res-grain", title: "The harvest is settled", line: "“Bring in the grain.”", detail: "Harvest in, rent to the landowner, wages paid, the household eats, stored grain spoils, flax is spun." },
  { icon: "commerce", title: "The town moves", line: "“The market shifts.”", detail: "Merchants trade and prices change for next year." },
  { icon: "feather", title: "A year older", line: "“Happy birthday.”", detail: "Age +1. The Life record writes the year down; new things may unlock." },
];

/** "Look it up": every resource, what it is for, where it comes from and where it goes. */
export interface ResourceRow { icon: string; name: string; use: string; gain: string; loss: string }

export const RESOURCE_GUIDE: readonly ResourceRow[] = [
  { icon: "res-grain", name: "Grain", use: "Food for every mouth, rent and seed.", gain: "Harvest, buying at the market.", loss: "Eating, rent, spoilage, selling." },
  { icon: "res-drachmas", name: "Cash (dr)", use: "Buying goods, lessons and help.", gain: "Wages, selling, work.", loss: "Purchases, fees, debts." },
  { icon: "res-flax", name: "Flax", use: "Spun into linen.", gain: "Flax plots at harvest.", loss: "Spinning, flax rent." },
  { icon: "res-linen", name: "Linen", use: "Cloth to sell.", gain: "Spinning flax in the quiet season.", loss: "Selling." },
  { icon: "res-ox", name: "Herd", use: "Oxen and donkeys help the farm.", gain: "Buying at the market.", loss: "They eat grain; hunger kills them." },
  { icon: "res-fields", name: "Fields", use: "Split into grain and flax plots.", gain: "The household’s plot.", loss: "Lying fallow without seed or hands." },
  { icon: "res-reputation", name: "Reputation", use: "Standing in town, works and offers.", gain: "Good deeds and finished works.", loss: "Broken promises." },
  { icon: "heart", name: "Health", use: "Staying alive and able to work.", gain: "Rest, care, easy walks.", loss: "Age, hunger, illness." },
  { icon: "book", name: "Knowledge", use: "Opens skilled work and choices.", gain: "Study and practice.", loss: "Fades without practice." },
  { icon: "people", name: "Bonds", use: "Friends, marriage and help.", gain: "Time with people.", loss: "Neglect and quarrels." },
];
