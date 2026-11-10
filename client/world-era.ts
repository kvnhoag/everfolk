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
    return `You are born near Rhakotis on Egypt's coast in ${formatYear(world.startYear)}. Alexandria will be founded here in ${formatYear(foundation)}.`;
  }
  return `You are born in Alexandria in ${formatYear(world.startYear)}.`;
}
