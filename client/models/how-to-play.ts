import type { LifeState, WorldPack } from "../../src/types.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import { householdView } from "../../src/demo/household.ts";
import { orderValue, priceText } from "../../src/demo/market-depth.ts";
import { tuning } from "../../src/demo/market-rules.ts";
import { sectionStep, type SectionStepId } from "./section-steps.ts";
import { YEAR_DURATION_MS } from "./playback.ts";
import { focusActivity } from "./yearly-focus.ts";

/**
 * How to Play, laid out like a board game's rule card: each numbered section of the screen as "do this → this
 * happens", a real screenshot, and an example with the player's own character and numbers (from the life itself, so
 * they are always true). Screenshots live in public/assets/how-to-play/.
 */

const SHOTS = "/assets/how-to-play";

export interface Shot { src: string; width: number; height: number; alt: string }

export interface PlayStep {
  id: SectionStepId;
  step: number;
  title: string;
  /** What you do here, in one short line. */
  body: string;
  /** What happens when you do it. */
  result: string;
  /** The same thing with real numbers and the player's own character. */
  example: string;
  /** The section as it looks in the game. */
  shot: Shot;
  /** When the step is not open from birth. */
  opens?: string;
  /** The one rule people trip over, shown with a warning sign. */
  warning?: string;
}

/** The goal, in one line, like the last line of a rule card. */
export const HOW_TO_WIN = "Live one life, birth to old age. Reach 18 to earn a card pack; titles, wealth and a long life earn more.";

/** The rhythm of every year, like "Play or pass, then draw". */
export const YEAR_RHYTHM = "Every year: pick a focus, use your action, answer turning points, let the year run.";

/** Real numbers for the examples, read from the player's own life. */
export interface HowToPlayFacts {
  name: string;
  age: number;
  cash: number;
  secondsPerYear: number;
  household: { grain: number; capacity: number; mouths: number; eating: number; harvest: number; rent: number; spoilage: number; overLimitPercent: number } | null;
  /** The study action, as the world defines it. */
  study: { text: string; cost: number; skill: string; gain: number } | null;
  /** Selling 100 grain now, priced as the order fills. */
  sale: { quantity: number; total: number; from: string; to: string } | null;
  firstRecord: { age: number; text: string } | null;
}

function shot(name: string, width: number, height: number, alt: string): Shot {
  return { src: `${SHOTS}/${name}.webp`, width, height, alt };
}

function step(id: SectionStepId, rest: Omit<PlayStep, "id" | "step">): PlayStep {
  return { id, step: sectionStep(id), ...rest };
}

const SKILL_NAMES: Record<string, string> = { literacy: "Literacy", farming: "Farming", warfare: "Warfare", craft: "Craft" };

function studyFacts(world: WorldPack): HowToPlayFacts["study"] {
  const activity = focusActivity(world, "study");
  if (!activity) return null;
  const cost = activity.when?.type === "cash" && activity.when.op === "gte" ? activity.when.value : 0;
  const effect = activity.outcomes[0]?.effects.find(candidate => candidate.type === "skill");
  if (!effect || effect.type !== "skill") return null;
  return { text: activity.text, cost, skill: SKILL_NAMES[effect.skill] ?? effect.skill, gain: effect.delta };
}

const SALE_QUANTITY = 100;

/** The first sentence of a record line, so an example stays one line long. */
function firstSentence(text: string): string {
  const match = text.match(/^.+?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

/** The examples' numbers for this life: its household, the study action, a sale of 100 grain and the first record. */
export function howToPlayFacts(world: WorldPack, life: LifeState, name: string, speed: number): HowToPlayFacts {
  const demo = world.demo && life.demo ? { def: world.demo, life: life as LifeStateWithDemo } : null;
  const view = demo ? householdView(demo.def, demo.life, world) : null;
  const value = demo ? orderValue(demo.def, demo.life.demo, "grain", "sell", SALE_QUANTITY) : null;
  const first = life.journal[0];
  return {
    name, age: life.age, cash: life.economy?.cash ?? 0, secondsPerYear: Math.round(YEAR_DURATION_MS / speed / 1000),
    household: view && demo ? { grain: view.grain, capacity: view.capacity, mouths: view.mouths, eating: view.expectedEating, harvest: view.expectedHarvest,
      rent: view.expectedRent, spoilage: view.expectedSpoilage, overLimitPercent: Math.round(demo.def.household.overCapacitySpoilageBps / 100) } : null,
    study: studyFacts(world),
    sale: value && demo?.def.market.depth ? { quantity: SALE_QUANTITY, total: value.total, from: priceText("grain", value.from.bid), to: priceText("grain", value.to.bid) } : null,
    firstRecord: first ? { age: first.age, text: firstSentence(first.text) } : null,
  };
}

const NO_FACTS: HowToPlayFacts = { name: "You", age: 0, cash: 0, secondsPerYear: 6, household: null, study: null, sale: null, firstRecord: null };

function householdExample(facts: HowToPlayFacts): string {
  const h = facts.household;
  if (!h) return "Grain plots feed the household; flax plots grow flax to spin into linen.";
  return `${facts.name}'s household: ${h.mouths} people eat ${h.eating} grain a year. Next harvest +${h.harvest}, rent −${h.rent}, spoilage −${h.spoilage}. `
    + `The store holds ${h.capacity}; grain above that loses about ${h.overLimitPercent}% a year.`;
}

export function howToPlaySteps(ages: { focus: number; action: number; fields: number; trade: number | null }, facts: HowToPlayFacts = NO_FACTS): PlayStep[] {
  const study = facts.study;
  return [
    step("time", {
      title: "Let the year run", body: "Press Resume. Pick a speed from 1× to 16×.",
      result: "Each year the harvest comes in, rent is paid, everyone eats and you turn a year older.",
      example: `${facts.name} is ${facts.age}. At this speed a year takes about ${facts.secondsPerYear} seconds.`,
      shot: shot("time-bar", 548, 60, "The time bar: Resume and the speeds 1× to 16×"),
      warning: "A turning point stops the clock until you choose. So does an open tip.",
    }),
    step("focus", {
      title: "Choose a focus", body: "Pick what you practise: Study, Farming, Friends and more.",
      result: "If a year ends with your action unused, the game stops and asks you to choose, with your focus's action recommended.",
      example: study ? `Focus on Study: at year end "${study.text}" is recommended, ${study.skill} +${study.gain}${study.cost ? ` (needs ${study.cost} dr in hand)` : ""}.` : "Your focus's action is the one recommended at the end of each year.",
      shot: shot("focus", 1144, 152, "This year's focus: Everyday life, Study, Farming, Friends and more"),
      opens: Number.isFinite(ages.focus) ? `Age ${ages.focus}` : undefined, warning: "Skills you stop practising slowly fade.",
    }),
    step("action", {
      title: "Spend your yearly action", body: "Press Do on one card: people, training or work.",
      result: "It happens at once and shows what it changed. One action a year.",
      example: study ? `"${study.text}": ${study.skill} +${study.gain}${study.cost ? `, needs ${study.cost} dr; ${facts.name} has ${facts.cash} dr` : ""}.` : "Each card says what it costs and what it changes before you press Do.",
      shot: shot("action", 1252, 402, "Yearly action cards, each with a Do button and what it changes"),
      opens: `Age ${ages.action}`, warning: "An unused action does not carry over to next year.",
    }),
    step("household", {
      title: "Plan the household", body: "Inventory & Granary: use − and + to split the plots into grain and flax, then Set planting.",
      result: "The split counts for the next harvest and stays until you change it.",
      example: householdExample(facts),
      shot: shot("tasks", 820, 318, "Plan your fields: grain and flax plots with − and + and Set planting"),
      opens: ages.fields > 0 ? `Age ${ages.fields}` : undefined, warning: "If the store runs out, the household goes hungry and health drops.",
    }),
    step("town", {
      title: "Trade at the market", body: "Market & Trade: choose a good, Sell or Buy and a quantity, press Preview order, then Confirm.",
      result: "You see exactly what you get before anything is sold. One market visit a year.",
      example: facts.sale ? `Selling ${facts.sale.quantity} grain now brings ${facts.sale.total} dr; the price falls from ${facts.sale.from} to ${facts.sale.to} dr a measure as the order fills.` : "Big orders move the price against you; the preview shows by how much.",
      shot: shot("market", 1242, 712, "The order ticket with its preview: what you get, the price move and the grain left"),
      opens: ages.trade === null ? undefined : `Age ${ages.trade}`, warning: "Keep enough grain for the household to eat.",
    }),
    step("record", {
      title: "Read your story", body: "Open the Life record to see every year.",
      result: "Green chips are what you gained, red what you lost. At the end your story becomes your card.",
      example: facts.firstRecord ? `Age ${facts.firstRecord.age}: “${facts.firstRecord.text}”` : "Each year's events are written down with what changed.",
      shot: shot("record", 1144, 482, "The Life record: each year's events with gains in green and losses in red"),
    }),
  ];
}

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

/** The trade age, or null when the world has no market. */
export function tradeAgeOf(world: WorldPack): number | null {
  return world.demo ? tuning(world.demo.market).minTradeAge : null;
}

/** What the icons on the household bar mean; the bar itself shows icons and numbers only. */
export const BAR_LEGEND: readonly { icon: string; label: string }[] = [
  { icon: "res-grain", label: "Grain / store size" }, { icon: "res-drachmas", label: "Cash" }, { icon: "res-flax", label: "Flax" },
  { icon: "res-linen", label: "Linen" }, { icon: "res-ox", label: "Oxen" }, { icon: "res-donkey", label: "Donkeys" },
  { icon: "res-fields", label: "Grain plots" }, { icon: "res-flax-plots", label: "Flax plots" }, { icon: "res-reputation", label: "Reputation" },
  { icon: "flood", label: "Nile flood" }, { icon: "military", label: "Army" }, { icon: "road", label: "Road" },
];
