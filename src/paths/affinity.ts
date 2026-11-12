/** Affinity: a visible, bounded pull toward a field of work. */
import type { LifeEvent, LifeState, WorldPack } from "../types.ts";
import { FIELD_IDS } from "./types.ts";
import type { FieldId } from "./types.ts";
import { derivedStream } from "./district.ts";

const MAX_AFFINITY = 100;
const PRACTICE_BONUS_BPS = 2000;
const JOURNAL_THRESHOLD = 5;
const FADE_FROM_AGE = 12, FADE_AFTER_YEARS = 3;

export const affinityJournalId = (field: FieldId): string => `paths-affinity-${field}`;

/** Returns the journal text when the change is large enough to tell the player. */
export function changeAffinity(world: WorldPack, life: LifeState, field: FieldId, delta: number, source: string): string | undefined {
  const paths = life.paths!;
  const before = paths.affinity[field];
  const after = Math.min(MAX_AFFINITY, Math.max(0, before + delta));
  paths.affinity = { ...paths.affinity, [field]: after };
  if (delta > 0) paths.lastPractice = { ...paths.lastPractice, [field]: life.age };
  if (after - before < JOURNAL_THRESHOLD) return undefined;
  return `Drawn to ${world.paths!.fields[field].title.toLowerCase()}: ${source}.`;
}

function fieldsWithSkill(world: WorldPack, skill: string): FieldId[] {
  return FIELD_IDS.filter(field => world.paths!.fields[field].skills.includes(skill));
}

function highest(life: LifeState, fields: readonly FieldId[]): number {
  return fields.reduce((best, field) => Math.max(best, life.paths!.affinity[field]), 0);
}

/**
 * Positive practice in a skill grows by up to 20% with the strongest affinity among its fields.
 * The fractional part is rounded up by chance on a side stream, so small gains still grow on average.
 */
export function practiceBonus(world: WorldPack, life: LifeState, skill: string, delta: number): number {
  if (delta <= 0 || !world.paths || !life.paths) return delta;
  const scaled = delta * PRACTICE_BONUS_BPS * highest(life, fieldsWithSkill(world, skill));
  const whole = Math.floor(scaled / (10_000 * MAX_AFFINITY)), fraction = (scaled % (10_000 * MAX_AFFINITY)) / (10_000 * MAX_AFFINITY);
  if (fraction === 0) return delta + whole;
  const random = derivedStream(life, `practice:${life.age}:${skill}:${life.journal.length}`);
  return delta + whole + (random() < fraction ? 1 : 0);
}

/** A practice gain as the engine applies it: affinity bonus, and the fields marked as practised. */
export function practiceGain(world: WorldPack, life: LifeState, skill: string, delta: number): number {
  if (!world.paths || !life.paths) return delta;
  if (delta > 0) notePractice(world, life, skill);
  return practiceBonus(world, life, skill, delta);
}

/** Marks the fields of a practised skill as touched this year. */
export function notePractice(world: WorldPack, life: LifeState, skill: string): void {
  if (!world.paths || !life.paths) return;
  const touched = Object.fromEntries(fieldsWithSkill(world, skill).map(field => [field, life.age]));
  life.paths.lastPractice = { ...life.paths.lastPractice, ...touched };
}

/** 1 without fields or affinity; up to 2 at full affinity. */
export function eventFieldWeight(world: WorldPack, life: LifeState, event: LifeEvent): number {
  if (!world.paths || !life.paths || !event.fields) return 1;
  return 1 + highest(life, event.fields) / MAX_AFFINITY;
}

function lastTouched(world: WorldPack, life: LifeState, field: FieldId): number {
  const practice = life.paths!.lastPractice[field] ?? -Infinity;
  const work = (life.capabilities?.evidence ?? [])
    .filter(item => {
      const node = world.capabilities?.nodes.find(candidate => candidate.id === item.nodeId);
      return node?.specialization ? world.paths!.fields[field].specializations.includes(node.specialization) : false;
    })
    .reduce((latest, item) => Math.max(latest, item.age), -Infinity);
  return Math.max(practice, work);
}

/** From age 12, a field untouched for more than three years loses 1 a year, down to its background. */
export function fadeAffinity(world: WorldPack, life: LifeState): void {
  if (!world.paths || !life.paths || life.age < FADE_FROM_AGE) return;
  const background = world.paths.originAffinity?.[life.originId] ?? {};
  const affinity = { ...life.paths.affinity };
  for (const field of FIELD_IDS) {
    const floor = background[field] ?? 0;
    if (affinity[field] > floor && life.age - lastTouched(world, life, field) > FADE_AFTER_YEARS) affinity[field] -= 1;
  }
  life.paths.affinity = affinity;
}

export interface AffinityEntry { field: FieldId; title: string; affinity: number; sources: string[] }

export function affinityView(world: WorldPack, life: LifeState): AffinityEntry[] {
  if (!world.paths || !life.paths) return [];
  return FIELD_IDS.map(field => ({
    field,
    title: world.paths!.fields[field].title,
    affinity: life.paths!.affinity[field],
    sources: life.journal.filter(entry => entry.id === affinityJournalId(field)).map(entry => entry.text.slice(entry.text.indexOf(": ") + 2)),
  })).sort((a, b) => b.affinity - a.affinity || FIELD_IDS.indexOf(a.field) - FIELD_IDS.indexOf(b.field));
}
