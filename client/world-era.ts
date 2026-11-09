import type { WorldPack } from "../src/types.ts";
import { formatYear } from "../src/calendar.ts";

/** The foundation changes the home settlement's name, never a saved birth date. */
export function classicalFoundationYear(world: WorldPack): number | undefined {
  const event = world.events.find(item => item.id === "classical-alexandria-founded");
  return event?.trigger.type === "year" ? event.trigger.at : undefined;
}

export function worldPlace(world: WorldPack, year: number): string {
  const foundation = classicalFoundationYear(world);
  return foundation !== undefined && year < foundation ? "Rhakotis coast" : "Alexandria";
}

export function worldBeginning(world: WorldPack): string {
  const foundation = classicalFoundationYear(world);
  if (foundation !== undefined && world.startYear < foundation) {
    return `Your life begins on Egypt's coast near Rhakotis in ${formatYear(world.startYear)}. Alexandria is founded in ${formatYear(foundation)}. The ambitions of Alexander and the early Hellenistic kingdoms unfold around your household's work and choices.`;
  }
  return `Your life begins in Alexandria in ${formatYear(world.startYear)}. If you live long enough, the city and government around it will change as your own life unfolds.`;
}
