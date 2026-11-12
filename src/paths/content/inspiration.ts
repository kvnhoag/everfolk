/** Inspiration: meeting someone who does the work, at every stage of life, for every field. */
import type { Choice, Effect, LifeEvent } from "../../types.ts";
import { FIELD_IDS } from "../types.ts";
import type { FieldId } from "../types.ts";
import type { MeetingBand } from "../practitioners.ts";

const SCENES: Record<FieldId, { title: string; text: string }> = {
  farming: { title: "Out along the canal", text: "Farmers lift water from the canal with a swing-beam and turn the wet soil for sowing." },
  clothing: { title: "A loom in a doorway", text: "A weaver works a loom in an open doorway, the shuttle clicking back and forth across the warp." },
  ceramics: { title: "At the wheel", text: "A potter draws up a jar on a wheel while the kiln behind the workshop cools." },
  sculpture: { title: "Chips of stone", text: "A carver taps at a block of limestone in a yard white with chips and dust." },
  research: { title: "Questions under the colonnade", text: "A scholar argues with students under a colonnade, a scroll open on the step beside them." },
  civic: { title: "A decree read aloud", text: "An official reads a new decree aloud at the record office while scribes copy it for the notice board." },
  trade: { title: "Prices called across the market", text: "A trader weighs goods on a hanging balance and calls prices across the market." },
  soldiering: { title: "The drill yard", text: "Soldiers drill in a dusty yard while an officer calls the step." },
};

const BANDS: Record<MeetingBand, { stages: string[]; maxOccurrences: number; cooldownYears: number }> = {
  child: { stages: ["early-childhood", "childhood"], maxOccurrences: 2, cooldownYears: 4 },
  young: { stages: ["adolescence", "youth"], maxOccurrences: 2, cooldownYears: 3 },
  adult: { stages: ["adulthood"], maxOccurrences: 3, cooldownYears: 6 },
  elder: { stages: ["later-life"], maxOccurrences: 1, cooldownYears: 10 },
};

/** Meeting people who do the work is common; three times an ordinary story. */
const INSPIRATION_WEIGHT = 3;

const meet = (field: FieldId, band: MeetingBand): Effect => ({ type: "meet-practitioner", field, band });
const extra = (field: FieldId, source: string): Effect => ({ type: "affinity", field, delta: 5, source });

function choicesFor(field: FieldId, band: MeetingBand): Choice[] {
  const id = `inspire-${field}-${band}`;
  const outcome = (suffix: string, text: string, effects: Effect[]) => ({ id: `${id}-${suffix}`, text, weight: 1, effects });
  if (band === "young") return [
    { id: `${id}-help`, text: "Ask to help for the day", outcomes: [outcome("helped", "You are handed the simplest job and you do it carefully.", [meet(field, band), extra(field, "asking to help")])] },
    { id: `${id}-watch`, text: "Watch for a while, then go on your way", outcomes: [outcome("watched", "You watch long enough to see how it is done.", [meet(field, band)])] },
  ];
  return [
    { id: `${id}-talk`, text: "Talk about the work", outcomes: [outcome("talked", "You talk about the work, its prices and its troubles.", [meet(field, band)])] },
    { id: `${id}-learn`, text: "Ask what it would take to learn it properly", outcomes: [outcome("asked", "You are told plainly what it takes and who might teach you.", [meet(field, band), extra(field, "asking how to learn the work")])] },
  ];
}

function inspiration(field: FieldId, band: MeetingBand): LifeEvent {
  const scene = SCENES[field], rules = BANDS[band];
  const base: LifeEvent = {
    id: `inspire-${field}-${band}`, title: scene.title, text: scene.text, trigger: { type: "random", weight: INSPIRATION_WEIGHT },
    when: { type: "field-people", field, op: "gte", value: 1 }, stages: rules.stages, fields: [field],
    maxOccurrences: rules.maxOccurrences, cooldownYears: rules.cooldownYears, evidence: "fictional", choices: [],
  };
  if (band === "child" || band === "elder") return { ...base, mode: "automatic", effects: [meet(field, band)] };
  return { ...base, scope: band === "young" ? "personal" : "work", choices: choicesFor(field, band) };
}

export function inspirationEvents(): LifeEvent[] {
  return FIELD_IDS.flatMap(field => (["child", "young", "adult", "elder"] as const).map(band => inspiration(field, band)));
}
