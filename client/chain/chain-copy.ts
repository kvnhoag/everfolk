import { groupOfNpcAction, DEMO_DEED_INFLUENCES } from "../../chain/catalog/demo-deeds.ts";
import { FIGURE_ACTIONS, RARITY_LABELS } from "../../chain/ids.ts";
import type { ActionId, CareerGroup, FigureId } from "../../chain/ids.ts";
import { FIGURES, INFLUENCES } from "../../chain/catalog/index.ts";
import { correctHistoricalInfluences } from "../../chain/catalog/historical-content.ts";

/** Player-facing names for chain ids. Short menu names follow spec §6.7; descriptions come from the influence catalog. */

export const ACTION_NAMES = {
  "alexander.levy": "Levy the city",
  "alexander.found": "Found and build",
  "aristotle.lyceum": "Found the Lyceum",
  "aristotle.tutor-court": "Tutor the court",
  "euclid.school": "Open a school",
  "euclid.museum": "Check the proofs",
  "cleomenes.corner-grain": "Corner the grain",
  "cleomenes.granaries": "Release grain reserves",
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
  "farming.stock-granary": "Stock the granary",
  "farming.share-seed": "Share seed",
} as const satisfies Record<ActionId, string>;

const EXTRA_ACTION_NAMES = {
  "military.guard-road": "Guard the road",
} as const;

/** What a figure is doing in the world a ranked life is born into ("Euclid … will support geometrical teaching."). */
export const FIGURE_DEEDS = {
  "alexander.levy": "will call for service in Egypt",
  "alexander.found": "will found Alexandria",
  "aristotle.lyceum": "will establish the Lyceum",
  "aristotle.tutor-court": "will support court tuition",
  "euclid.school": "will support geometrical teaching",
  "euclid.museum": "will support work on mathematical proofs",
  "cleomenes.corner-grain": "will control grain exports",
  "cleomenes.granaries": "will release grain reserves",
} as const satisfies Record<(typeof FIGURE_ACTIONS)[FigureId][number], string>;

/** One person of each career group, as a draw or a source is introduced. */
export const GROUP_PERSON: Record<CareerGroup, string> = {
  letters: "A scholar", military: "A soldier", commerce: "A trader", craft: "A craftworker", sky: "A stargazer", performance: "A performer", farming: "A farmer",
};

/** Title of an NPC token of each career group. */
export const GROUP_TITLE: Record<CareerGroup, string> = {
  letters: "Scholar of Alexandria", military: "Soldier of Alexandria", commerce: "Trader of Alexandria",
  craft: "Craftworker of Alexandria", sky: "Stargazer of Alexandria", performance: "Performer of Alexandria",
  farming: "Farmer of Alexandria",
};

const descriptions = new Map([...correctHistoricalInfluences(INFLUENCES), ...DEMO_DEED_INFLUENCES].map(entry => [entry.id, entry.label]));
const figureTitles = new Map(FIGURES.map(figure => [figure.figure, figure.title]));

export interface ActionOption { id: string; name: string; description: string }

const DEMO_DEEDS: Record<string, string> = {
  "farming.stock-granary": "Stock a granary",
  "farming.share-seed": "Share seed",
  "military.guard-road": "Guard the road",
};

export function actionName(actionId: string | null): string {
  return (actionId && ((ACTION_NAMES as Record<string, string>)[actionId] || (EXTRA_ACTION_NAMES as Record<string, string>)[actionId] || DEMO_DEEDS[actionId])) || "An unknown deed";
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
  return groupOfNpcAction(actionId);
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
