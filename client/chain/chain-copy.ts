import { FIGURE_ACTIONS, NPC_ACTIONS, RARITY_LABELS } from "../../chain/ids.ts";
import type { ActionId, CareerGroup, FigureId } from "../../chain/ids.ts";
import { FIGURES, INFLUENCES } from "../../chain/catalog/index.ts";

/** Player-facing names for chain ids. Short menu names follow spec §6.7; descriptions come from the influence catalog. */

export const ACTION_NAMES = {
  "alexander.levy": "Levy the city",
  "alexander.found": "Found and build",
  "aristotle.lyceum": "Found the Lyceum",
  "aristotle.tutor-court": "Tutor the court",
  "euclid.school": "Open a school",
  "euclid.museum": "Keep to the Museum",
  "cleomenes.corner-grain": "Corner the grain",
  "cleomenes.granaries": "Fill the granaries",
  "letters.teach": "Teach the young",
  "letters.lend-books": "Lend books",
  "military.mentor": "Mentor a recruit",
  "military.warn-levy": "Warn of the levy",
  "commerce.credit": "Extend credit",
  "commerce.hire": "Hire a hand",
  "craft.apprentice": "Take an apprentice",
  "craft.commission": "Share a commission",
  "sky.omen": "Cast a favourable omen",
  "sky.warn-year": "Warn of a bad year",
  "performance.lift": "Lift the spirits",
  "performance.lend-hand": "Lend a hand",
} as const satisfies Record<ActionId, string>;

/** What a figure is doing in the world a ranked life is born into ("Euclid … has opened a school."). */
export const FIGURE_DEEDS = {
  "alexander.levy": "has called a levy on the city",
  "alexander.found": "is founding and building the city",
  "aristotle.lyceum": "has founded the Lyceum",
  "aristotle.tutor-court": "is tutoring the court",
  "euclid.school": "has opened a school",
  "euclid.museum": "keeps to the Museum",
  "cleomenes.corner-grain": "has cornered the grain",
  "cleomenes.granaries": "has filled the granaries",
} as const satisfies Record<(typeof FIGURE_ACTIONS)[FigureId][number], string>;

/** One person of each career group, as a draw or a source is introduced. */
export const GROUP_PERSON: Record<CareerGroup, string> = {
  letters: "A scholar", military: "A soldier", commerce: "A trader", craft: "A craftworker", sky: "A stargazer", performance: "A performer",
};

/** Title of an NPC token of each career group. */
export const GROUP_TITLE: Record<CareerGroup, string> = {
  letters: "Scholar of Alexandria", military: "Soldier of Alexandria", commerce: "Trader of Alexandria",
  craft: "Craftworker of Alexandria", sky: "Stargazer of Alexandria", performance: "Performer of Alexandria",
};

const descriptions = new Map(INFLUENCES.map(entry => [entry.id, entry.label]));
const figureTitles = new Map(FIGURES.map(figure => [figure.figure, figure.title]));

export interface ActionOption { id: string; name: string; description: string }

export function actionName(actionId: string | null): string {
  return (actionId && (ACTION_NAMES as Record<string, string>)[actionId]) || "An unknown deed";
}

export function actionDescription(actionId: string | null): string {
  return (actionId && descriptions.get(actionId)) || "";
}

export function actionOption(actionId: string): ActionOption {
  return { id: actionId, name: actionName(actionId), description: actionDescription(actionId) };
}

/** "Euclid, the geometer" */
export function figureTitle(figureId: FigureId): string {
  return figureTitles.get(figureId) ?? figureId;
}

/** "Euclid" */
export function figureName(figureId: FigureId): string {
  return figureTitle(figureId).split(",")[0];
}

export function rarityLabel(rarity: number | null): string {
  return rarity === null ? "" : RARITY_LABELS[rarity] ?? "Unknown";
}

export function groupOfAction(actionId: string | null): CareerGroup | null {
  if (!actionId) return null;
  const entry = (Object.entries(NPC_ACTIONS) as [CareerGroup, { actions: readonly string[] }][]).find(([, group]) => group.actions.includes(actionId));
  return entry ? entry[0] : null;
}

export function figureOfAction(actionId: string | null): FigureId | null {
  if (!actionId) return null;
  const entry = (Object.entries(FIGURE_ACTIONS) as [FigureId, readonly string[]][]).find(([, actions]) => actions.includes(actionId));
  return entry ? entry[0] : null;
}

/** "A scholar" for an NPC action, the figure's name for a figure action. */
export function personForAction(actionId: string | null): string {
  const figure = figureOfAction(actionId);
  if (figure) return figureName(figure);
  const group = groupOfAction(actionId);
  return group ? GROUP_PERSON[group] : "Someone in the city";
}

export function withOwner(name: string, owner: string | undefined | null): string {
  return owner ? `${name} (${owner})` : name;
}
