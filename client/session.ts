import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { contentFingerprint } from "../src/random.ts";
import { readEverfolkStorage } from "./brand-storage.ts";
import sampleWorld from "../worlds/alexandria-sample.json" with { type: "json" };
import legacyWorld from "../worlds/alexandria-0.3.0.json" with { type: "json" };
import characterPreviewWorld from "../worlds/alexandria-0.4.0.json" with { type: "json" };
import previousWorld from "../worlds/alexandria-0.4.1.json" with { type: "json" };
import specialistWorld from "../worlds/alexandria-0.5.0.json" with { type: "json" };
import namedCausesWorld from "../worlds/alexandria-0.5.1.json" with { type: "json" };
import originRangesWorld from "../worlds/alexandria-0.6.0.json" with { type: "json" };
import longerLivesWorld from "../worlds/alexandria-0.6.1.json" with { type: "json" };
import peopleWorld from "../worlds/alexandria-0.7.0.json" with { type: "json" };
import skillTreeWorld from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import economyWorld from "../worlds/alexandria-0.9.0.json" with { type: "json" };
import variedWorld from "../worlds/alexandria-0.10.0.json" with { type: "json" };
import birthWorld from "../worlds/alexandria-0.11.0.json" with { type: "json" };
import coherentWorld from "../worlds/alexandria-0.12.0.json" with { type: "json" };
import workTimelineWorld from "../worlds/alexandria-0.13.0.json" with { type: "json" };
import interestCareersWorld from "../worlds/alexandria-0.14.0.json" with { type: "json" };
import causalHealthWorld from "../worlds/alexandria-0.15.0.json" with { type: "json" };
import statDecayWorld from "../worlds/alexandria-0.16.0.json" with { type: "json" };
import specificCraftWorld from "../worlds/alexandria-0.17.0.json" with { type: "json" };
import strictProgressionWorld from "../worlds/alexandria-0.18.0.json" with { type: "json" };
import careerOpeningsWorld from "../worlds/alexandria-0.19.0.json" with { type: "json" };
import adultMortalityWorld from "../worlds/alexandria-0.20.0.json" with { type: "json" };
import moneylenderWorld from "../worlds/alexandria-0.21.0.json" with { type: "json" };
import eventVarietyWorld from "../worlds/alexandria-0.22.0.json" with { type: "json" };
import rareEncountersWorld from "../worlds/alexandria-0.23.0.json" with { type: "json" };
import masteryOpeningsWorld from "../worlds/alexandria-0.24.0.json" with { type: "json" };
import legacyRoutesWorld from "../worlds/alexandria-0.25.0.json" with { type: "json" };
import childhoodRoutesWorld from "../worlds/alexandria-0.26.0.json" with { type: "json" };
import creditOpportunitiesWorld from "../worlds/alexandria-0.27.0.json" with { type: "json" };
import skillCeilingWorld from "../worlds/alexandria-0.28.0.json" with { type: "json" };
import proceduralPeopleWorld from "../worlds/alexandria-0.29.0.json" with { type: "json" };
import socialRolesWorld from "../worlds/alexandria-0.30.0.json" with { type: "json" };
import narrativeWorld from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import classicalWorld from "../worlds/alexandria-0.32.0.json" with { type: "json" };
import householdWorld from "../worlds/alexandria-0.33.0.json" with { type: "json" };

/** The sample scene owns its pack; the shared simulation stays setting-independent. */
export const builtinEngine = createEngine(sampleWorld);
export const legacyEngine = createEngine(legacyWorld);
const characterPreviewEngine = createEngine(characterPreviewWorld);
const previousEngine = createEngine(previousWorld);
const specialistEngine = createEngine(specialistWorld);
const namedCausesEngine = createEngine(namedCausesWorld);
const originRangesEngine = createEngine(originRangesWorld);
const longerLivesEngine = createEngine(longerLivesWorld);
const peopleEngine = createEngine(peopleWorld);
const skillTreeEngine = createEngine(skillTreeWorld);
const economyEngine = createEngine(economyWorld);
const variedEngine = createEngine(variedWorld);
const birthEngine = createEngine(birthWorld);
const coherentEngine = createEngine(coherentWorld);
const workTimelineEngine = createEngine(workTimelineWorld);
const interestCareersEngine = createEngine(interestCareersWorld);
const causalHealthEngine = createEngine(causalHealthWorld);
const statDecayEngine = createEngine(statDecayWorld);
const specificCraftEngine = createEngine(specificCraftWorld);
const strictProgressionEngine = createEngine(strictProgressionWorld);
const careerOpeningsEngine = createEngine(careerOpeningsWorld);
const adultMortalityEngine = createEngine(adultMortalityWorld);
const moneylenderEngine = createEngine(moneylenderWorld);
const eventVarietyEngine = createEngine(eventVarietyWorld);
const rareEncountersEngine = createEngine(rareEncountersWorld);
const masteryOpeningsEngine = createEngine(masteryOpeningsWorld);
const legacyRoutesEngine = createEngine(legacyRoutesWorld);
const childhoodRoutesEngine = createEngine(childhoodRoutesWorld);
const creditOpportunitiesEngine = createEngine(creditOpportunitiesWorld);
const skillCeilingEngine = createEngine(skillCeilingWorld);
const proceduralPeopleEngine = createEngine(proceduralPeopleWorld);
const socialRolesEngine = createEngine(socialRolesWorld);
const narrativeEngine = createEngine(narrativeWorld);
const classicalEngine = createEngine(classicalWorld);
const householdEngine = createEngine(householdWorld);
export let sampleEngine = builtinEngine;
const engines = new Map<string, LifeEngine>([[builtinEngine.fingerprint, builtinEngine], [legacyEngine.fingerprint, legacyEngine], [characterPreviewEngine.fingerprint, characterPreviewEngine], [previousEngine.fingerprint, previousEngine], [specialistEngine.fingerprint, specialistEngine], [namedCausesEngine.fingerprint, namedCausesEngine], [originRangesEngine.fingerprint, originRangesEngine], [longerLivesEngine.fingerprint, longerLivesEngine], [peopleEngine.fingerprint, peopleEngine], [skillTreeEngine.fingerprint, skillTreeEngine], [economyEngine.fingerprint, economyEngine], [variedEngine.fingerprint, variedEngine]]);
engines.set(birthEngine.fingerprint, birthEngine);
engines.set(coherentEngine.fingerprint, coherentEngine);
engines.set(workTimelineEngine.fingerprint, workTimelineEngine);
engines.set(interestCareersEngine.fingerprint, interestCareersEngine);
engines.set(causalHealthEngine.fingerprint, causalHealthEngine);
engines.set(statDecayEngine.fingerprint, statDecayEngine);
engines.set(specificCraftEngine.fingerprint, specificCraftEngine);
engines.set(strictProgressionEngine.fingerprint, strictProgressionEngine);
engines.set(careerOpeningsEngine.fingerprint, careerOpeningsEngine);
engines.set(adultMortalityEngine.fingerprint, adultMortalityEngine);
engines.set(moneylenderEngine.fingerprint, moneylenderEngine);
engines.set(eventVarietyEngine.fingerprint, eventVarietyEngine);
engines.set(rareEncountersEngine.fingerprint, rareEncountersEngine);
engines.set(masteryOpeningsEngine.fingerprint, masteryOpeningsEngine);
engines.set(legacyRoutesEngine.fingerprint, legacyRoutesEngine);
engines.set(childhoodRoutesEngine.fingerprint, childhoodRoutesEngine);
engines.set(creditOpportunitiesEngine.fingerprint, creditOpportunitiesEngine);
engines.set(skillCeilingEngine.fingerprint, skillCeilingEngine);
engines.set(proceduralPeopleEngine.fingerprint, proceduralPeopleEngine);
engines.set(socialRolesEngine.fingerprint, socialRolesEngine);
engines.set(narrativeEngine.fingerprint, narrativeEngine);
engines.set(classicalEngine.fingerprint, classicalEngine);
engines.set(householdEngine.fingerprint, householdEngine);
const PACK_CACHE_PREFIX = "everfolk:world-pack:";
// Earlier content revisions remain untouched under their original v1/v2 keys.
export let SAVE_KEY = saveKeyFor(builtinEngine);
export const ARCHIVE_KEY = "everfolk:alexandria-lives:v3";
export let PRESENTATION_KEY = presentationKeyFor(builtinEngine);
const ARCHIVE_LIMIT = 10;
function saveKeyFor(engine: LifeEngine): string { return engine.fingerprint === legacyEngine.fingerprint ? "everfolk:alexandria-sample:v3" : `everfolk:active:${engine.world.id}:${engine.fingerprint}`; }
function presentationKeyFor(engine: LifeEngine): string { return engine.fingerprint === legacyEngine.fingerprint ? "everfolk:alexandria-presentation:v3" : `${saveKeyFor(engine)}:presentation`; }

/** Pin a life to its own immutable world revision; publishing never rewrites it. */
export function selectWorldPack(pack: WorldPack): void {
  const engine = createEngine(pack);
  engines.set(engine.fingerprint, engine);
  sampleEngine = engine;
  SAVE_KEY = saveKeyFor(engine);
  PRESENTATION_KEY = presentationKeyFor(engine);
  try { window.localStorage.setItem(`${PACK_CACHE_PREFIX}${engine.fingerprint}`, JSON.stringify(pack)); } catch { /* Session play remains available without storage. */ }
}

/** Makes a pack's engine available to engineForLife without changing the free-play world or its save slot. */
export function registerWorldPack(pack: WorldPack): LifeEngine {
  const engine = createEngine(pack);
  engines.set(engine.fingerprint, engine);
  return engine;
}

export function engineForLife(life: Pick<LifeState, "worldFingerprint">): LifeEngine {
  const known = engines.get(life.worldFingerprint);
  if (known) return known;
  try {
    const raw = readEverfolkStorage(window.localStorage, `${PACK_CACHE_PREFIX}${life.worldFingerprint}`);
    if (raw) {
      const engine = createEngine(JSON.parse(raw));
      if (engine.fingerprint === life.worldFingerprint) {
        engines.set(engine.fingerprint, engine);
        return engine;
      }
    }
  } catch { /* Report a missing revision below without altering the stored save. */ }
  throw new Error("This life's original world revision is not available on this device.");
}

export function loadAnyLife(json: string): LifeState {
  const identity = JSON.parse(json) as { worldFingerprint: string };
  return engineForLife(identity).load(json);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ArchivedLife {
  id: string;
  age: number;
  year: number;
  birthYear: number;
  endingTitle: string;
  save: string;
}

export function newLifeSeed(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `alexandria-${crypto.randomUUID()}`
    : `alexandria-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Begin at birth. A presentation gate holds progression until the player starts. */
export function createSampleLife(seed = newLifeSeed()): LifeState {
  return sampleEngine.start(seed);
}

/** A deliberate new-life request looks for a fresh name and household.
 * Only seed selection changes: the chosen seed still reproduces the exact life.
 * A finite best-match fallback supports worlds with just one name or origin. */
export function createDifferentSampleLife(previous: LifeState, seedFactory: () => string = newLifeSeed): LifeState {
  let best: LifeState | undefined;
  let bestScore = -1;
  for (let attempt = 0; attempt < 16; attempt++) {
    const candidate = createSampleLife(seedFactory());
    const score = Number(candidate.character?.name !== previous.character?.name) + Number(candidate.originId !== previous.originId);
    if (score > bestScore) { best = candidate; bestScore = score; }
    if (score === 2) return candidate;
  }
  return best!;
}

/** Skip quiet years without making any decisions on the player's behalf. */
export function advanceToTurningPoint(life: LifeState): LifeState {
  const engine = engineForLife(life);
  let next = life;
  for (let years = 0; years <= engine.world.maxAge; years++) {
    if (next.phase !== "ready") return next;
    next = engine.advance(next);
  }
  throw new Error("This life could not reach its next turning point.");
}

export function exportLife(life: LifeState): string {
  return engineForLife(life).save(life);
}

export function readSavedLife(storage: StorageLike): LifeState | null {
  let saved: string | null;
  try {
    saved = readEverfolkStorage(storage, SAVE_KEY);
  } catch {
    throw new Error("Local saves are unavailable in this browser.");
  }
  if (saved === null) return null;
  try {
    return sampleEngine.load(saved);
  } catch {
    throw new Error("The previous save could not be opened with this version of the sample.");
  }
}

export function persistLife(storage: StorageLike, life: LifeState): void {
  const saved = exportLife(life);
  try {
    storage.setItem(saveKeyFor(engineForLife(life)), saved);
  } catch {
    throw new Error("This browser could not save the life. You can keep playing.");
  }
}

/** Remember the birth reveal separately; it is presentation, not a simulation command. */
export function hasLifeBegun(storage: StorageLike, life: LifeState): boolean {
  if (life.commands.some(command => command.type !== "avatar") || life.phase === "ended") return true;
  let engine: LifeEngine;
  try { engine = engineForLife(life); } catch { return false; }
  return readEverfolkStorage(storage, presentationKeyFor(engine)) === `${life.worldFingerprint}:${life.seed}`;
}

export function persistBirthPresentation(storage: StorageLike, life: LifeState, hasBegun: boolean): void {
  storage.setItem(presentationKeyFor(engineForLife(life)), hasBegun ? `${life.worldFingerprint}:${life.seed}` : "");
}

/** A stat reveal is presentation only; older lives that have begun need no replay. */
export function hasBirthStatsBeenRevealed(storage: StorageLike, life: LifeState): boolean {
  if (life.commands.some(command => command.type !== "avatar") || life.phase === "ended") return true;
  try {
    if (hasLifeBegun(storage, life)) return true;
    const key = `${presentationKeyFor(engineForLife(life))}:stats-revealed`;
    return readEverfolkStorage(storage, key) === `${life.worldFingerprint}:${life.seed}`;
  } catch {
    // A blocked storage read must not prevent revealing and playing in memory.
    return false;
  }
}

export function persistBirthStatsReveal(storage: StorageLike, life: LifeState, revealed: boolean): void {
  const key = `${presentationKeyFor(engineForLife(life))}:stats-revealed`;
  storage.setItem(key, revealed ? `${life.worldFingerprint}:${life.seed}` : "");
}

export function readArchivedLives(storage: StorageLike): ArchivedLife[] {
  let raw: string | null;
  try { raw = readEverfolkStorage(storage, ARCHIVE_KEY); }
  catch { throw new Error("The local past-lives archive is unavailable."); }
  if (raw === null) return [];
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > ARCHIVE_LIMIT) throw new Error("Invalid archive.");
    return entries.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid archived life.");
      const value = entry as ArchivedLife;
      if (typeof value.id !== "string" || value.id.length > 400 || !Number.isSafeInteger(value.age) || value.age < 0 ||
        !Number.isSafeInteger(value.year) || value.year === 0 || !Number.isSafeInteger(value.birthYear) || value.birthYear === 0 ||
        typeof value.endingTitle !== "string" || value.endingTitle.length > 500 ||
        typeof value.save !== "string" || value.save.length > 8_000_000) throw new Error("Invalid archived life.");
      return { id: value.id, age: value.age, year: value.year, birthYear: value.birthYear, endingTitle: value.endingTitle, save: value.save };
    });
  } catch { throw new Error("The past-lives archive could not be opened. Its stored data has been left unchanged."); }
}

export function archiveLife(storage: StorageLike, life: LifeState): ArchivedLife[] {
  if (life.phase !== "ended") throw new Error("Only completed lives can enter the archive.");
  const world = engineForLife(life).world;
  const ending = world.endings.find(item => item.id === life.endingId);
  const cause = world.character?.deathCauses.find(item => item.id === life.deathCauseId);
  const saved = exportLife(life);
  const item: ArchivedLife = {
    // Equal-length branches from the same seed are still different completed lives.
    id: `${life.seed}:${contentFingerprint(saved)}`,
    age: life.age,
    year: life.year,
    birthYear: world.startYear,
    endingTitle: cause?.title ?? ending?.title ?? "Life ended",
    save: saved,
  };
  const entries = [item, ...readArchivedLives(storage).filter(previous => previous.id !== item.id)].slice(0, ARCHIVE_LIMIT);
  try { storage.setItem(ARCHIVE_KEY, JSON.stringify(entries)); }
  catch { throw new Error("This life could not be added to the local archive. You can still download it."); }
  return entries;
}
