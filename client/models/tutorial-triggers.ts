import { TUTORIAL_HINT_IDS, type TutorialHintId } from "./tutorial-hints.ts";

/**
 * When each tutorial hint matters. Pure functions of what is on screen and the life's state, so every hint can be
 * tested to fire exactly at its stage and never for a section the player cannot see.
 */

/** The screen the player is looking at. "elsewhere" covers popups and pages that have no hints. */
export type TutorialView = "home" | "new-life" | "game" | "decision" | "character" | "weave" | "nft-market" | "figures" | "mine" | "elsewhere";

/** What the current life shows; read from the game's own state. */
export interface TutorialLifeFacts {
  age: number;
  ended: boolean;
  decisionPending: boolean;
  learnedSkills: number;
  focusShown: boolean;
  resourcesShown: boolean;
  wealthShown: boolean;
  /** The Household & Town command deck is on screen. */
  deckShown: boolean;
  /** At least one notification is on screen. */
  notificationShown: boolean;
  /** The age the world's grain market opens, or null when the world has no market. */
  tradeAge: number | null;
}

export interface TutorialContext {
  view: TutorialView;
  /** The open Character popup tab; null outside the popup. */
  characterSection: string | null;
  life: TutorialLifeFacts | null;
}

export const NO_TUTORIAL_CONTEXT: TutorialContext = Object.freeze({ view: "elsewhere", characterSection: null, life: null });

interface HintRule {
  /** The section is on the current screen, so its hint may show. */
  available(context: TutorialContext, life: TutorialLifeFacts | null): boolean;
  /** The stage at which the hint opens by itself (only while available). Defaults to `available`. */
  triggered?(context: TutorialContext, life: TutorialLifeFacts): boolean;
}

const onGame = (context: TutorialContext, life: TutorialLifeFacts | null): life is TutorialLifeFacts => context.view === "game" && life !== null;
const fromAge = (age: number): HintRule["triggered"] => (_context, life) => life.age >= age;
const view = (name: TutorialView): HintRule => ({ available: context => context.view === name });
const never = () => false;

/** The age the "Plan your fields" tip opens; the yearly reminder to plan starts the same year. */
/** The household's decisions, fields included, become the player's at 16 (adulthood in the world's decision stages). */
export const PLANTING_HINT_AGE = 16;

const RULES: Record<TutorialHintId, HintRule> = {
  "welcome": view("home"),
  "home-begin": { ...view("home"), triggered: never },
  "home-weave": { ...view("home"), triggered: never },
  "home-header": { ...view("home"), triggered: never },
  "roll": view("new-life"),
  "time-bar": { available: onGame },
  "decision": { available: (context, life) => context.view === "decision" || onGame(context, life), triggered: (_context, life) => life.decisionPending },
  "ending": { available: (context, life) => onGame(context, life) && life.ended },
  "rail": { available: onGame, triggered: fromAge(2) },
  "resources": { available: (context, life) => onGame(context, life) && life.resourcesShown, triggered: fromAge(3) },
  "planting": { available: (context, life) => onGame(context, life) && life.resourcesShown && !life.ended, triggered: fromAge(PLANTING_HINT_AGE) },
  "scene": { available: onGame, triggered: fromAge(1) },
  "focus": { available: (context, life) => onGame(context, life) && life.focusShown },
  "wealth": { available: (context, life) => onGame(context, life) && life.wealthShown, triggered: fromAge(4) },
  "life-record": { available: onGame, triggered: fromAge(5) },
  // The action cards are drawn only when no decision is waiting, so the tip waits for that too.
  "yearly-action": { available: (context, life) => onGame(context, life) && life.age >= 6 && !life.ended && !life.decisionPending },
  "command-deck": { available: (context, life) => onGame(context, life) && life.deckShown, triggered: fromAge(8) },
  "market": { available: (context, life) => onGame(context, life) && life.deckShown && life.tradeAge !== null && life.age >= life.tradeAge },
  "notifications": { available: onGame, triggered: (_context, life) => life.notificationShown },
  "skills": {
    available: (context, life) => context.view === "character" || onGame(context, life) && life.learnedSkills > 0,
    triggered: (context, life) => context.view === "character" ? context.characterSection === "skills" : life.learnedSkills > 0,
  },
  "character": view("character"),
  "weave": view("weave"),
  "nft-market": view("nft-market"),
  "figures": view("figures"),
  "mine": view("mine"),
  "about": { available: never },
};

/** Which hint opens first when several fire at once: first-visit screens, then events, then the layout. */
const AUTO_ORDER: readonly TutorialHintId[] = [
  "welcome", "roll", "weave", "nft-market", "figures", "mine", "character", "skills",
  "time-bar", "decision", "ending", "notifications", "market", "yearly-action", "focus",
  "scene", "rail", "resources", "planting", "wealth", "life-record", "command-deck",
];

export function hintAvailable(id: TutorialHintId, context: TutorialContext): boolean {
  return RULES[id].available(context, context.life);
}

export function hintTriggered(id: TutorialHintId, context: TutorialContext): boolean {
  const rule = RULES[id];
  if (!rule.available(context, context.life)) return false;
  if (!rule.triggered) return true;
  return context.life !== null && rule.triggered(context, context.life);
}

/** Every hint whose section is on screen, top to bottom. */
export function availableHints(context: TutorialContext): TutorialHintId[] {
  return TUTORIAL_HINT_IDS.filter(id => hintAvailable(id, context));
}

/** Unseen hints that have reached their stage, most important first. */
export function triggeredHints(context: TutorialContext, seen: readonly string[]): TutorialHintId[] {
  return AUTO_ORDER.filter(id => !seen.includes(id) && hintTriggered(id, context));
}

/** The game's own screen state, as App holds it. */
export interface GameTutorialInput {
  menuOpen: boolean;
  birthPopoverOpen: boolean;
  hasBegun: boolean;
  panel: string | null;
  characterSection: string | null;
  decisionOpen: boolean;
  /** A popup without hints covers the game (new life, loans, the legacy pack, the world library). */
  blockingDialog: boolean;
  life: TutorialLifeFacts;
}

function gameView(input: GameTutorialInput): TutorialView {
  if (input.blockingDialog) return "elsewhere";
  if (input.birthPopoverOpen) return "new-life";
  if (input.menuOpen) return "home";
  if (input.panel === "character") return "character";
  if (input.panel || !input.hasBegun) return "elsewhere";
  return input.decisionOpen ? "decision" : "game";
}

export function gameTutorialContext(input: GameTutorialInput): TutorialContext {
  const view = gameView(input);
  return { view, characterSection: view === "character" ? input.characterSection : null, life: input.life };
}

/** The Weave screen opened by a hash route, or null when none is open. */
export function chainTutorialView(kind: string | null): TutorialView | null {
  if (kind === null) return null;
  if (kind === "ranked") return "weave";
  if (kind === "market") return "nft-market";
  if (kind === "figures" || kind === "mine") return kind;
  return "elsewhere";
}
