import type { GameSection } from "./onboarding-sections.ts";
import { TUTORIAL_HINT_IDS, type TutorialHintId } from "./tutorial-hints.ts";

/**
 * When each tutorial hint matters. Pure functions of what is on screen and the life's state, so every hint can be
 * tested to fire exactly at its stage and never for a section the player cannot see.
 */

/** The screen the player is looking at. "elsewhere" covers popups and pages that have no hints. */
export type TutorialView = "home" | "new-life" | "game" | "decision" | "character" | "weave" | "nft-market" | "figures" | "mine" | "elsewhere";

/** What the current life shows; read from the game's own state. */
export interface TutorialLifeFacts {
  /** Which life this is; a new key is a life entered (born, continued or loaded). */
  lifeKey: string;
  age: number;
  ended: boolean;
  decisionPending: boolean;
  learnedSkills: number;
  /** The life screen's sections drawn at this age (see onboarding-sections). */
  sections: readonly GameSection[];
  /** At least one notification is on screen. */
  notificationShown: boolean;
  /** Tips whose stage passed before this year; seen at once when a life is entered mid-way (a loaded save). */
  passed: readonly TutorialHintId[];
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
/** On the game screen while the section is drawn. */
const shows = (section: GameSection): HintRule["available"] => (context, life) => onGame(context, life) && life.sections.includes(section);
/** Help only: the section's "?" opens it, but it never opens by itself (another tip already introduces it). */
const helpOnly = (rule: HintRule): HintRule => ({ ...rule, triggered: never });

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
  "rail": helpOnly({ available: onGame }),
  "resources": { available: shows("resources") },
  "planting": { available: (context, life) => shows("planting")(context, life) && !life!.ended },
  "scene": { available: onGame, triggered: fromAge(1) },
  "focus": { available: (context, life) => shows("focus")(context, life) && !life!.ended },
  "wealth": { available: shows("wealth") },
  "life-record": helpOnly({ available: onGame }),
  // The action cards are drawn only when no decision is waiting, so the tip waits for that too.
  "yearly-action": { available: (context, life) => shows("yearly-action")(context, life) && !life!.ended && !life!.decisionPending },
  // The market tip introduces the deck; the deck's own tip stays behind its "?".
  "command-deck": helpOnly({ available: (context, life) => shows("command-deck")(context, life) && !life!.ended }),
  "market": { available: (context, life) => shows("deck-market")(context, life) && !life!.ended },
  "notifications": { available: onGame, triggered: (_context, life) => life.notificationShown },
  "skills": {
    available: (context, life) => context.view === "character" || shows("skill-tree")(context, life),
    triggered: (context, life) => context.view === "character" ? context.characterSection === "skills" : life.learnedSkills > 0,
  },
  "character": { available: (context, life) => context.view === "character" || shows("character")(context, life) },
  "weave": view("weave"),
  "nft-market": view("nft-market"),
  "figures": view("figures"),
  "mine": view("mine"),
  "about": { available: never },
};

/**
 * Which hint opens first when several fire at once: first-visit screens, then events, then the life's sections in the
 * order the early years teach them.
 */
const AUTO_ORDER: readonly TutorialHintId[] = [
  "welcome", "roll", "weave", "nft-market", "figures", "mine",
  "time-bar", "decision", "ending", "scene", "notifications",
  "focus", "yearly-action", "wealth", "resources", "market", "character", "skills", "planting",
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
