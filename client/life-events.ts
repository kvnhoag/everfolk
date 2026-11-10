import { displayProse } from "./display-prose.ts";
import { yearAtAge } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

export interface LifeEventRow {
  key: string;
  kind: "event" | "history" | "milestone" | "activity" | "ending";
  /** Metadata for the event; the feed displays the completed fact in text. */
  title?: string;
  text: string;
  sourceIds: readonly string[];
}

export interface LifeEventYear {
  age: number;
  year: number;
  events: LifeEventRow[];
}

/**
 * A compact record of what happened, separate from the detailed command journal.
 * Reading this projection cannot advance a life or change its saved history.
 */
export function buildLifeEvents(life: LifeState, world: WorldPack): LifeEventYear[] {
  const years = Array.from({ length: life.age + 1 }, (_, age): LifeEventYear => ({
    age, year: yearAtAge(world.startYear, age), events: [],
  }));
  const events = new Map(world.events.map(event => [event.id, event]));
  const activities = new Map(world.character?.activities.map(activity => [activity.id, activity]) ?? []);
  const jobs = new Set(world.character?.jobs.map(job => job.id) ?? []);
  let lastWork: { id: string; age: number } | undefined;
  // Outcome IDs are unique within a world. Resolving by ID also handles several
  // decisions/actions in one year without mistaking introductions for actions.
  const outcomes = new Map<string, { title: string; kind: "event" | "activity"; sourceIds: readonly string[] }>();
  for (const event of world.events) for (const choice of event.choices) for (const outcome of choice.outcomes) {
    outcomes.set(outcome.id, { title: event.title, kind: "event", sourceIds: event.sourceIds ?? [] });
  }
  for (const activity of activities.values()) for (const outcome of activity.outcomes) {
    outcomes.set(outcome.id, { title: activity.text, kind: "activity", sourceIds: [] });
  }

  life.journal.forEach((entry, index) => {
    const group = years[entry.age];
    if (!group) return;
    const key = `${entry.age}-${index}-${entry.type}-${entry.id}`;
    if (entry.type === "event") {
      const event = events.get(entry.id);
      // Health progression and individual relationship warnings are completed
      // facts recorded by the engine, rather than authored decision prompts.
      if (!event) {
        group.events.push({ key, kind: "event", text: entry.text, sourceIds: entry.id.startsWith("health-") ? world.health?.sourceIds ?? [] : [] });
        return;
      }
      // An offered decision is still a question. Its accepted outcome is added
      // below, so prompts and selected option labels never fill the event feed.
      if (event.mode !== "automatic") return;
      group.events.push({
        key, kind: event.trigger.type === "year" ? "history" : event.trigger.type === "age" ? "milestone" : "event",
        title: event.title,
        text: event.trigger.type === "age" ? event.title : event.text,
        sourceIds: event.sourceIds ?? [],
      });
    } else if (entry.type === "outcome") {
      const owner = outcomes.get(entry.id);
      group.events.push({ key, kind: owner?.kind ?? "event", title: owner?.title, text: entry.text, sourceIds: owner?.sourceIds ?? [] });
    } else if (entry.type === "activity") {
      // Regular work is already represented in the yearly budget. Record its
      // first year, a changed job or a return after a gap, rather than repeating
      // the same sentence every year. The full chronicle retains every entry.
      if (jobs.has(entry.id)) {
        const changed = !lastWork || lastWork.id !== entry.id || entry.age > lastWork.age + 1;
        lastWork = { id: entry.id, age: entry.age };
        if (!changed) return;
      }
      // Known activity IDs are action labels followed by an outcome. Other
      // activity records are standalone facts: wages, meeting people, a name.
      if (!activities.has(entry.id)) group.events.push({ key, kind: "activity", text: entry.text, sourceIds: [] });
    } else if (entry.type === "ending") {
      const ending = world.endings.find(ending => ending.id === entry.id);
      const cause = world.character?.deathCauses.find(cause => cause.id === life.deathCauseId);
      group.events.push({ key, kind: "ending", title: cause?.title ?? ending?.title,
        text: cause ? `Cause of death: ${cause.title}.` : entry.text,
        sourceIds: ending?.sourceIds ?? [],
      });
    }
    // Birth-background paragraphs, birthday markers and option labels remain in
    // the full chronicle. Every lived year still has a header in this projection.
  });
  return years.reverse().map(group => ({ ...group, events: group.events.reverse().map(event => ({ ...event, ...(event.title ? { title: displayProse(event.title) } : {}), text: displayProse(event.text) })) }));
}
