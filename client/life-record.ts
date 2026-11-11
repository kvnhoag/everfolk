import { createEngine } from "../src/engine.ts";
import { getNetWorth } from "../src/economy.ts";
import type { LifeEngine, LifeState } from "../src/types.ts";
import type { LifeEventRow } from "./life-events.ts";

export interface YearChange { id: string; label: string; delta: number; unit?: string }

/** Prefer a personal outcome over background history or routine work. */
export function lifeYearHeadline(events: readonly LifeEventRow[]): string {
  const priority = (event: LifeEventRow) => event.kind === "ending" ? 50
    : event.kind === "event" && event.title ? 40
    : /health-(onset|recovery|severe)/.test(event.key) ? 35
    : event.kind === "milestone" ? 30 : event.kind === "history" ? 25
    : event.kind === "event" ? 15 : 10;
  const main = events.reduce<LifeEventRow | undefined>((best, event) =>
    !best || priority(event) > priority(best) ? event : best, undefined);
  if (!main) return "A quiet year";
  const text = main.title || main.text.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || main.text;
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
}

function values(state: LifeState, engine: LifeEngine): Record<string, number> {
  const result = { ...state.stats };
  if (engine.world.economy && state.economy) result[engine.world.economy.stat] = getNetWorth(engine.world, state);
  for (const [id, value] of Object.entries(state.character?.skills ?? {})) result[`skill:${id}`] = value;
  return result;
}

// Extend the previous projection when another command is accepted. This avoids
// replaying an entire long life on every action, and never mutates the live save.
const cache = new WeakMap<LifeEngine, { seed: string; commands: string[]; state: LifeState; tracer: LifeEngine; entries: Map<number, Record<string, number>>; totals: Map<number, Record<string, number>> }>();
export function lifeRecordChanges(life: LifeState, engine: LifeEngine): { years: Map<number, YearChange[]>; entries: Map<number, YearChange[]> } {
  const commands = life.commands.map(command => JSON.stringify(command));
  let projection = cache.get(engine);
  if (!projection || projection.seed !== life.seed || projection.commands.length > commands.length ||
    projection.commands.some((command, index) => command !== commands[index])) {
    const entries = new Map<number, Record<string, number>>();
    const tracer = createEngine(engine.world, { onChange(index, changes) {
      const totals = entries.get(index) ?? {};
      for (const [id, delta] of Object.entries(changes)) totals[id] = (totals[id] ?? 0) + delta;
      entries.set(index, totals);
    } });
    projection = { seed: life.seed, commands: [], state: tracer.start(life.seed), tracer, entries, totals: new Map() };
  }
  for (let index = projection.commands.length; index < life.commands.length; index++) {
    const before = values(projection.state, engine), command = life.commands[index];
    const after = command.type === "advance" ? projection.tracer.advance(projection.state)
      : command.type === "choose" ? projection.tracer.choose(projection.state, command.choice)
      : command.type === "act" ? projection.tracer.act(projection.state, command.activity)
      : command.type === "influence" ? projection.tracer.influence(projection.state, command)
      : projection.tracer.chooseAvatar(projection.state, command.variant);
    const totals = projection.totals.get(after.age) ?? {};
    for (const [id, value] of Object.entries(values(after, engine))) totals[id] = (totals[id] ?? 0) + value - (before[id] ?? 0);
    projection.totals.set(after.age, totals);
    projection.state = after;
    projection.commands.push(commands[index]);
  }
  cache.set(engine, projection);
  const format = (totals: Record<string, number>): YearChange[] => Object.entries(totals).flatMap(([id, amount]) => {
    const delta = Math.round(amount * 100) / 100;
    if (!delta) return [];
    const skill = id.startsWith("skill:") ? id.slice(6) : undefined;
    const money = !skill && id === engine.world.economy?.stat;
    return [{ id, label: skill ? engine.world.character?.skills[skill]?.label ?? skill : money ? "Total wealth" : engine.world.stats[id]?.label ?? id,
      delta, unit: money ? engine.world.economy?.currency.short : undefined }];
  });
  return {
    years: new Map([...projection.totals].map(([age, totals]) => [age, format(totals)])),
    entries: new Map([...projection.entries].map(([index, totals]) => [index, format(totals)])),
  };
}

export function lifeYearChanges(life: LifeState, engine: LifeEngine): Map<number, YearChange[]> {
  return lifeRecordChanges(life, engine).years;
}
