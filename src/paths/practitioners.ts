/** Meeting people who do the work, introductions, and moving the player (never the household). */
import type { Effect, LifeState, WorldPack } from "../types.ts";
import { lifeStageAt } from "../life-stages/index.ts";
import { TIERS } from "./types.ts";
import type { FieldId, PathsState, Tier, TierCounts } from "./types.ts";
import { derivedStream } from "./district.ts";
import { refreshNeeds } from "./needs.ts";

export type MeetingBand = "child" | "young" | "adult" | "elder";
export const MEETING_BANDS: readonly MeetingBand[] = ["child", "young", "adult", "elder"];

/**
 * Weight per person of each tier. Learners and workers are many; renowned people are few, but as
 * public figures they are seen more often than their numbers alone suggest.
 */
const TIER_WEIGHT: Record<Tier, number> = { learner: 4, worker: 3, master: 2, renowned: 3 };
const PULL: Record<Tier, { affinity: number; skill: number; introduce: boolean }> = {
  learner: { affinity: 5, skill: 0, introduce: false },
  worker: { affinity: 10, skill: 2, introduce: false },
  master: { affinity: 20, skill: 4, introduce: true },
  renowned: { affinity: 35, skill: 6, introduce: true },
};
const TIER_TITLE: Record<Tier, string> = { learner: "a young", worker: "a", master: "a master", renowned: "the renowned" };
const BAND_TEXT: Record<MeetingBand, string> = {
  child: "You stop to watch {who} at work until someone calls you home.",
  young: "You help {who} for a day and ask more questions than you are answered.",
  adult: "You fall into talk about the trade with {who}.",
  elder: "You compare a lifetime of work with {who}.",
};

export interface Meeting { text: string; effects: Effect[] }

function drawTier(people: TierCounts, random: () => number): Tier | undefined {
  const weights = TIERS.map((tier, i) => TIER_WEIGHT[tier] * people[i]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return undefined;
  let remaining = random() * total;
  for (let i = 0; i < TIERS.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return TIERS[i];
  }
  return TIERS[TIERS.length - 1];
}

/** Egyptian names in the pools; before Alexandria (331 BCE) the people met are Egyptian. */
const EGYPTIAN_NAMES: ReadonlySet<string> = new Set(["Horus", "Imouthes", "Pachrates", "Panebchounis", "Petosiris", "Psenamounis", "Psais", "Tesenouphis",
  "Thermuthis", "Taesis", "Tanouphis", "Senamounis", "Taphis"]);
/** Names of the Ptolemaic court and the Sarapis cult, in use only once Ptolemy is king (305 BCE). */
const DYNASTIC_NAMES: ReadonlySet<string> = new Set(["Ptolemaios", "Soter", "Berenike", "Ptolemais", "Sarapion", "Kleopatra"]);
const FOUNDING_YEAR = -331, KINGSHIP_YEAR = -305;

function drawName(world: WorldPack, random: () => number, year: number): string {
  const pools = world.character?.identity?.namePools;
  const all = pools ? [...pools[random() < 0.5 ? "male" : "female"]] : [];
  const names = all.filter(name => year < FOUNDING_YEAR ? EGYPTIAN_NAMES.has(name) : year < KINGSHIP_YEAR ? !DYNASTIC_NAMES.has(name) : true);
  const usable = names.length ? names : all;
  return usable.length ? usable[Math.floor(random() * usable.length)] : "A neighbour";
}

/** Records the person met and returns the journal text and the effects for the engine to apply. */
export function meetPractitioner(world: WorldPack, life: LifeState, field: FieldId, band: MeetingBand): Meeting {
  const paths = life.paths!, definition = world.paths!.fields[field];
  const district = world.paths!.districts[paths.district];
  const random = derivedStream(life, `meet:${life.age}:${field}:${paths.practitioners.length}`);
  const tier = drawTier(paths.people[field], random);
  if (!tier) return { text: `No ${definition.practitioner} lives in ${district.title} for you to meet.`, effects: [] };
  const name = drawName(world, random, life.year);
  const title = TIER_TITLE[tier] === "a" && /^[aeiou]/i.test(definition.practitioner) ? "an" : TIER_TITLE[tier];
  const who = `${name}, ${title} ${definition.practitioner}`;
  paths.practitioners = [...paths.practitioners, { id: `practitioner-${life.age}-${field}-${paths.practitioners.length}`, name, field, tier, district: paths.district, metAge: life.age }];
  const pull = PULL[tier];
  if (pull.introduce && !paths.introductions.includes(field)) paths.introductions = [...paths.introductions, field];
  const effects: Effect[] = [{ type: "affinity", field, delta: pull.affinity, source: who }];
  if (pull.skill > 0) effects.push({ type: "skill", skill: definition.skills[0], delta: pull.skill });
  const flag = `met-renowned-${field}`;
  if (tier === "renowned" && Object.hasOwn(world.flags, flag)) effects.push({ type: "flag", flag, value: true });
  return { text: `${BAND_TEXT[band].replace("{who}", who)}`, effects };
}

function stageOf(world: WorldPack, age: number): string | undefined {
  return lifeStageAt(world, age)?.id;
}

/** Moves the player only; the household, its plot and stores stay at home. Once per life stage. */
export function moveDistrict(world: WorldPack, life: LifeState, target: string, reason: string): string {
  const paths = life.paths!;
  const to = target === "home" ? paths.home : target;
  const stage = stageOf(world, life.age);
  if (paths.moves.some(move => stageOf(world, move.age) === stage)) {
    return `You stay in ${world.paths!.districts[paths.district].title}; you have already moved once at this time of life.`;
  }
  if (to === paths.district) return `You stay in ${world.paths!.districts[to].title}.`;
  const random = derivedStream(life, `people:${life.age}`);
  const vary = (count: number): number => count === 0 ? 0 : Math.max(0, count + Math.floor(random() * 3) - 1);
  const profile = world.paths!.districts[to].profile;
  paths.people = Object.fromEntries(Object.entries(profile).map(([field, entry]) =>
    [field, entry.people.map(vary) as TierCounts])) as PathsState["people"];
  paths.moves = [...paths.moves, { age: life.age, from: paths.district, to }];
  paths.district = to;
  refreshNeeds(world, life);
  const home = to === paths.home ? " The family plot is home again." : " Your household stays where it is.";
  return `You move to ${world.paths!.districts[to].title}: ${reason}.${home}`;
}
