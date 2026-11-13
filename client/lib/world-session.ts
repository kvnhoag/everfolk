import { createEngine } from "../../src/index.ts";
import { buildNpcWorld } from "../../chain/npc-world.ts";
import type { LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import { readEverfolkStorage } from "./brand-storage.ts";
import sampleWorld from "../../worlds/alexandria-sample.json" with { type: "json" };
import legacyWorld from "../../worlds/alexandria-0.3.0.json" with { type: "json" };
import characterPreviewWorld from "../../worlds/alexandria-0.4.0.json" with { type: "json" };
import previousWorld from "../../worlds/alexandria-0.4.1.json" with { type: "json" };
import specialistWorld from "../../worlds/alexandria-0.5.0.json" with { type: "json" };
import namedCausesWorld from "../../worlds/alexandria-0.5.1.json" with { type: "json" };
import originRangesWorld from "../../worlds/alexandria-0.6.0.json" with { type: "json" };
import longerLivesWorld from "../../worlds/alexandria-0.6.1.json" with { type: "json" };
import peopleWorld from "../../worlds/alexandria-0.7.0.json" with { type: "json" };
import skillTreeWorld from "../../worlds/alexandria-0.8.0.json" with { type: "json" };
import economyWorld from "../../worlds/alexandria-0.9.0.json" with { type: "json" };
import variedWorld from "../../worlds/alexandria-0.10.0.json" with { type: "json" };
import birthWorld from "../../worlds/alexandria-0.11.0.json" with { type: "json" };
import coherentWorld from "../../worlds/alexandria-0.12.0.json" with { type: "json" };
import workTimelineWorld from "../../worlds/alexandria-0.13.0.json" with { type: "json" };
import interestCareersWorld from "../../worlds/alexandria-0.14.0.json" with { type: "json" };
import causalHealthWorld from "../../worlds/alexandria-0.15.0.json" with { type: "json" };
import statDecayWorld from "../../worlds/alexandria-0.16.0.json" with { type: "json" };
import specificCraftWorld from "../../worlds/alexandria-0.17.0.json" with { type: "json" };
import strictProgressionWorld from "../../worlds/alexandria-0.18.0.json" with { type: "json" };
import careerOpeningsWorld from "../../worlds/alexandria-0.19.0.json" with { type: "json" };
import adultMortalityWorld from "../../worlds/alexandria-0.20.0.json" with { type: "json" };
import moneylenderWorld from "../../worlds/alexandria-0.21.0.json" with { type: "json" };
import eventVarietyWorld from "../../worlds/alexandria-0.22.0.json" with { type: "json" };
import rareEncountersWorld from "../../worlds/alexandria-0.23.0.json" with { type: "json" };
import masteryOpeningsWorld from "../../worlds/alexandria-0.24.0.json" with { type: "json" };
import legacyRoutesWorld from "../../worlds/alexandria-0.25.0.json" with { type: "json" };
import childhoodRoutesWorld from "../../worlds/alexandria-0.26.0.json" with { type: "json" };
import creditOpportunitiesWorld from "../../worlds/alexandria-0.27.0.json" with { type: "json" };
import skillCeilingWorld from "../../worlds/alexandria-0.28.0.json" with { type: "json" };
import proceduralPeopleWorld from "../../worlds/alexandria-0.29.0.json" with { type: "json" };
import socialRolesWorld from "../../worlds/alexandria-0.30.0.json" with { type: "json" };
import narrativeWorld from "../../worlds/alexandria-0.31.0.json" with { type: "json" };
import classicalWorld from "../../worlds/alexandria-0.32.0.json" with { type: "json" };
import householdWorld from "../../worlds/alexandria-0.33.0.json" with { type: "json" };
import lateRoutesWorld from "../../worlds/alexandria-0.34.0.json" with { type: "json" };
import startingResourcesWorld from "../../worlds/alexandria-0.35.0.json" with { type: "json" };
import leanResourcesWorld from "../../worlds/alexandria-0.36.0.json" with { type: "json" };
import cashReservesWorld from "../../worlds/alexandria-0.37.0.json" with { type: "json" };
import livelihoodsWorld from "../../worlds/alexandria-0.38.0.json" with { type: "json" };
import resourceVarietyWorld from "../../worlds/alexandria-0.39.0.json" with { type: "json" };
import marketRolesWorld from "../../worlds/alexandria-0.40.0.json" with { type: "json" };
import marketCapacityWorld from "../../worlds/alexandria-0.41.0.json" with { type: "json" };
import demo1World from "../../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import demo2World from "../../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import lives1World from "../../worlds/demo/alexandria-lives-1.json" with { type: "json" };
import lives2World from "../../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import lives3World from "../../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import lives4World from "../../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import lives5World from "../../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import lives6World from "../../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import deepWorld from "../../worlds/demo/alexandria-deep-1.json" with { type: "json" };
import figureWorld from "../../worlds/demo/alexandria-figures-1.json" with { type: "json" };
import familyRecordsWorld from "../../worlds/alexandria-0.42.0.json" with { type: "json" };
import grandparentRarityWorld from "../../worlds/alexandria-0.43.0.json" with { type: "json" };
import royalCouncilWorld from "../../worlds/alexandria-0.44.0.json" with { type: "json" };
import aristocraticEstatesWorld from "../../worlds/alexandria-0.45.0.json" with { type: "json" };
import historicalTitlesWorld from "../../worlds/alexandria-0.46.0.json" with { type: "json" };
import resourceAdjustedWorld from "../../worlds/alexandria-0.47.0.json" with { type: "json" };
import lives7World from "../../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import lives8World from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };

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
const lateRoutesEngine = createEngine(lateRoutesWorld);
const startingResourcesEngine = createEngine(startingResourcesWorld);
const leanResourcesEngine = createEngine(leanResourcesWorld);
const cashReservesEngine = createEngine(cashReservesWorld);
const livelihoodsEngine = createEngine(livelihoodsWorld);
const resourceVarietyEngine = createEngine(resourceVarietyWorld);
const marketRolesEngine = createEngine(marketRolesWorld);
const marketCapacityEngine = createEngine(marketCapacityWorld);
const demo1Engine = createEngine(demo1World as unknown as WorldPack);
const demo2Engine = createEngine(demo2World as unknown as WorldPack);
const lives1Engine = createEngine(lives1World as unknown as WorldPack);
const lives2Engine = createEngine(lives2World as unknown as WorldPack);
const lives3Engine = createEngine(lives3World as unknown as WorldPack);
const lives4Engine = createEngine(lives4World as unknown as WorldPack);
const lives5Engine = createEngine(lives5World as unknown as WorldPack);
const lives6Engine = createEngine(lives6World as unknown as WorldPack);
const deepEngine = createEngine(deepWorld as unknown as WorldPack);
const figureEngine = createEngine(figureWorld as unknown as WorldPack);
const familyRecordsEngine = createEngine(familyRecordsWorld);
const grandparentRarityEngine = createEngine(grandparentRarityWorld);
const royalCouncilEngine = createEngine(royalCouncilWorld);
const aristocraticEstatesEngine = createEngine(aristocraticEstatesWorld);
const historicalTitlesEngine = createEngine(historicalTitlesWorld);
const resourceAdjustedEngine = createEngine(resourceAdjustedWorld);
const lives7Engine = createEngine(lives7World as unknown as WorldPack);
const lives8Engine = createEngine(lives8World as unknown as WorldPack);
const npcRankedEngine = createEngine(buildNpcWorld(lives8World as unknown as WorldPack));
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
engines.set(lateRoutesEngine.fingerprint, lateRoutesEngine);
engines.set(startingResourcesEngine.fingerprint, startingResourcesEngine);
engines.set(leanResourcesEngine.fingerprint, leanResourcesEngine);
engines.set(cashReservesEngine.fingerprint, cashReservesEngine);
engines.set(livelihoodsEngine.fingerprint, livelihoodsEngine);
engines.set(resourceVarietyEngine.fingerprint, resourceVarietyEngine);
engines.set(marketRolesEngine.fingerprint, marketRolesEngine);
engines.set(marketCapacityEngine.fingerprint, marketCapacityEngine);
engines.set(demo1Engine.fingerprint, demo1Engine);
engines.set(demo2Engine.fingerprint, demo2Engine);
engines.set(lives1Engine.fingerprint, lives1Engine);
engines.set(lives2Engine.fingerprint, lives2Engine);
engines.set(lives3Engine.fingerprint, lives3Engine);
engines.set(lives4Engine.fingerprint, lives4Engine);
engines.set(lives5Engine.fingerprint, lives5Engine);
engines.set(lives6Engine.fingerprint, lives6Engine);
engines.set(deepEngine.fingerprint, deepEngine);
engines.set(figureEngine.fingerprint, figureEngine);
engines.set(familyRecordsEngine.fingerprint, familyRecordsEngine);
engines.set(grandparentRarityEngine.fingerprint, grandparentRarityEngine);
engines.set(royalCouncilEngine.fingerprint, royalCouncilEngine);
engines.set(aristocraticEstatesEngine.fingerprint, aristocraticEstatesEngine);
engines.set(historicalTitlesEngine.fingerprint, historicalTitlesEngine);
engines.set(resourceAdjustedEngine.fingerprint, resourceAdjustedEngine);
engines.set(lives7Engine.fingerprint, lives7Engine);
engines.set(lives8Engine.fingerprint, lives8Engine);
engines.set(npcRankedEngine.fingerprint, npcRankedEngine);
const PACK_CACHE_PREFIX = "everfolk:world-pack:";
// Earlier content revisions remain untouched under their original v1/v2 keys.
export let SAVE_KEY = saveKeyFor(builtinEngine);
export const ARCHIVE_KEY = "everfolk:alexandria-lives:v3";
export const WEALTH_OBSERVATIONS_KEY = "everfolk:wealth-observations:v1";
export let PRESENTATION_KEY = presentationKeyFor(builtinEngine);
export const ARCHIVE_LIMIT = 10;
export function saveKeyFor(engine: LifeEngine): string { return engine.fingerprint === legacyEngine.fingerprint ? "everfolk:alexandria-sample:v3" : `everfolk:active:${engine.world.id}:${engine.fingerprint}`; }
export function presentationKeyFor(engine: LifeEngine): string { return engine.fingerprint === legacyEngine.fingerprint ? "everfolk:alexandria-presentation:v3" : `${saveKeyFor(engine)}:presentation`; }

/** Make an isolated life resolvable without selecting a world or writing a save. */
export function registerLifeEngine(engine: LifeEngine): void {
  engines.set(engine.fingerprint, engine);
}

/** Pin a life to its own immutable world revision; publishing never rewrites it. */
export function selectWorldPack(pack: WorldPack): void {
  const engine = createEngine(pack);
  engines.set(engine.fingerprint, engine);
  sampleEngine = engine;
  SAVE_KEY = saveKeyFor(engine);
  PRESENTATION_KEY = presentationKeyFor(engine);
  try { window.localStorage.setItem(`${PACK_CACHE_PREFIX}${engine.fingerprint}`, JSON.stringify(pack)); } catch { /* Session play remains available without storage. */ }
}

/** Register an exact pack without changing free-play bindings or its save slot. */
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

export function exportLife(life: LifeState): string {
  return engineForLife(life).save(life);
}
