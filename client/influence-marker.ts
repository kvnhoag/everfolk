import { INFLUENCES } from "../chain/catalog/index.ts";
import type { FigureId } from "../chain/ids.ts";
import type { InfluenceEntry, JournalEntry, WorldPack } from "../src/types.ts";
import { actionName, figureName, figureOfAction, groupOfAction, GROUP_PERSON } from "./chain/chain-copy.ts";

/**
 * "Shaped by …": who reached a ranked life through an NFT influence, and with
 * which deed. Presentation only: it reads a journal entry's `source` and the
 * catalog, never the engine state, so free play (no `source`) is unchanged.
 */
export interface InfluenceMarker {
  kind: "figure" | "npc";
  /** Creator material ramp: gold for famous figures, faience for people of the city. */
  material: "gold" | "faience";
  actionId: string | null;
  figureId: FigureId | null;
  /** "Euclid", "a scholar". */
  who: string;
  /** Short deed name from the action menu: "Open a school". */
  actionLabel: string;
  /** One line for screen readers and titles: "Shaped by Euclid: Open a school". */
  text: string;
  tokenId: string;
}

const SOMEONE = "someone in the city";

function lowerFirst(text: string): string {
  return text ? text[0].toLocaleLowerCase() + text.slice(1) : text;
}

/** The action whose authored event this entry records; the pack's own catalog first. */
function actionForEvent(eventId: string, world: Pick<WorldPack, "influences">): string | null {
  const find = (entries: readonly InfluenceEntry[] | undefined) => entries?.find(entry => entry.event?.id === eventId)?.id ?? null;
  return find(world.influences) ?? find(INFLUENCES);
}

export function influenceActionId(entry: Pick<JournalEntry, "type" | "id">, world: Pick<WorldPack, "influences">): string | null {
  if (entry.type === "influence") return entry.id;
  if (entry.type === "event") return actionForEvent(entry.id, world);
  return null;
}

export function influenceMarker(entry: Pick<JournalEntry, "type" | "id" | "source">, world: Pick<WorldPack, "influences">): InfluenceMarker | null {
  const source = entry.source;
  if (!source || typeof source.tokenId !== "string") return null;
  const actionId = influenceActionId(entry, world);
  const figureId = figureOfAction(actionId);
  const group = groupOfAction(actionId);
  const who = figureId ? figureName(figureId) : group ? lowerFirst(GROUP_PERSON[group]) : SOMEONE;
  const actionLabel = actionName(actionId);
  return {
    kind: figureId ? "figure" : "npc",
    material: figureId ? "gold" : "faience",
    actionId, figureId, who, actionLabel,
    text: `Shaped by ${who}: ${actionLabel}`,
    tokenId: source.tokenId,
  };
}
