import type { JournalEntry, WorldPack } from "../../src/types.ts";
import { findLifeEvent } from "./life-event-lookup.ts";

/** Runtime settlement and health records are events, rather than offered decisions. */
export function journalKind(entry: JournalEntry, world: WorldPack): string {
  if (entry.type === "choice") return "Selected";
  if (entry.type === "outcome") return "Outcome";
  if (entry.type === "activity") return "Activity";
  if (entry.type === "birth") return "Background";
  if (entry.type === "influence") return "Influence";
  if (entry.type === "ending") return world.endings.find(item => item.id === entry.id)?.kind === "chapter" ? "Record complete" : "Life ended";
  const event = findLifeEvent(world, entry.id);
  if (!event) return "Life event";
  if (event.rarity === "rare") return "Rare encounter";
  if (event.id === "the-first-household") return "Birth";
  if (event.trigger.type === "year") return "History";
  if (event.mode === "automatic" && event.trigger.type === "age") return "Milestone";
  return event.mode === "automatic" ? "Life event" : "Decision";
}
