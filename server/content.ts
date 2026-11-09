import type { WorldPack } from "../src/types.ts";
import { validateWorld } from "../src/validate.ts";
import { contentFingerprint } from "../src/random.ts";
import alexandria from "../worlds/alexandria-sample.json" with { type: "json" };
import legacyAlexandria from "../worlds/alexandria-0.3.0.json" with { type: "json" };
import previousAlexandria from "../worlds/alexandria-0.4.1.json" with { type: "json" };
import specialistAlexandria from "../worlds/alexandria-0.5.0.json" with { type: "json" };
import namedCausesAlexandria from "../worlds/alexandria-0.5.1.json" with { type: "json" };
import originRangesAlexandria from "../worlds/alexandria-0.6.0.json" with { type: "json" };
import longerLivesAlexandria from "../worlds/alexandria-0.6.1.json" with { type: "json" };
import peopleAlexandria from "../worlds/alexandria-0.7.0.json" with { type: "json" };
import skillTreeAlexandria from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import moneyAlexandria from "../worlds/alexandria-0.9.0.json" with { type: "json" };
import variedAlexandria from "../worlds/alexandria-0.10.0.json" with { type: "json" };
import birthAlexandria from "../worlds/alexandria-0.11.0.json" with { type: "json" };
import coherentAlexandria from "../worlds/alexandria-0.12.0.json" with { type: "json" };
import workTimelineAlexandria from "../worlds/alexandria-0.13.0.json" with { type: "json" };
import interestCareersAlexandria from "../worlds/alexandria-0.14.0.json" with { type: "json" };
import causalHealthAlexandria from "../worlds/alexandria-0.15.0.json" with { type: "json" };
import statDecayAlexandria from "../worlds/alexandria-0.16.0.json" with { type: "json" };
import specificCraftAlexandria from "../worlds/alexandria-0.17.0.json" with { type: "json" };
import strictProgressionAlexandria from "../worlds/alexandria-0.18.0.json" with { type: "json" };
import careerOpeningsAlexandria from "../worlds/alexandria-0.19.0.json" with { type: "json" };
import adultMortalityAlexandria from "../worlds/alexandria-0.20.0.json" with { type: "json" };
import moneylenderAlexandria from "../worlds/alexandria-0.21.0.json" with { type: "json" };
import eventVarietyAlexandria from "../worlds/alexandria-0.22.0.json" with { type: "json" };
import rareEncountersAlexandria from "../worlds/alexandria-0.23.0.json" with { type: "json" };
import masteryOpeningsAlexandria from "../worlds/alexandria-0.24.0.json" with { type: "json" };
import { MOTION_IDS, SCENE_IDS } from "../client/scene-model.ts";
import type { EventVisuals, MotionId, SceneId } from "../client/scene-model.ts";

export interface WorldRoute {
  id: string;
  title: string;
  description: string;
  flag: string;
  enabled: boolean;
}

export interface ManagedWorld {
  id: string;
  enabled: boolean;
  pack: WorldPack;
  routes: WorldRoute[];
  disabledEventIds: string[];
  /** Presentation metadata is kept outside replayed simulation packs. */
  eventVisuals?: EventVisuals;
}

export interface AdminCatalog {
  revision: number;
  worlds: ManagedWorld[];
  publishedRevision?: number | null;
  publishedAt?: string | null;
}

export interface PublishedWorld {
  id: string;
  revisionId: string;
  pack: WorldPack;
  routes: WorldRoute[];
  eventVisuals?: EventVisuals;
}

export interface WorldSummary {
  id: string;
  title: string;
  version: string;
  description: string;
  routes: WorldRoute[];
}

export interface PublishedCatalog {
  revision: number;
  publicationId: string;
  publishedAt: string | null;
  worlds: WorldSummary[];
}

// D1 limits each string and row to 2 MB. Leave room for row metadata and
// publication wrappers while keeping editor imports and request bodies bounded.
export const MAX_CATALOG_BYTES = 1_500_000;
const BAD_IDS = new Set(["constructor", "prototype", "__proto__"]);
const ID = /^[a-z][a-z0-9-]{0,99}$/;

function record(value: unknown, path: string, fields: string[], required = fields): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new Error(`${path}: expected a plain object.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !fields.includes(key) || BAD_IDS.has(key)) throw new Error(`${path}: unknown field.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !descriptor.enumerable) throw new Error(`${path}: expected plain JSON fields.`);
  }
  for (const key of required) if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key}: required field is missing.`);
  return value as Record<string, unknown>;
}

function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) {
    throw new Error(`${path}: expected an array with at most ${max} items.`);
  }
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor)) throw new Error(`${path}: sparse arrays and accessors are not allowed.`);
  }
  return value;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new Error(`${path}: enter text of 1–${max} characters.`);
  }
  return value;
}

function id(value: unknown, path: string): string {
  const result = text(value, path, 100);
  if (!ID.test(result) || BAD_IDS.has(result)) throw new Error(`${path}: use a lowercase ID containing letters, numbers and hyphens.`);
  return result;
}

function enabled(value: unknown, path: string): void {
  if (typeof value !== "boolean") throw new Error(`${path}: expected true or false.`);
}

function boundedJson(value: unknown, path: string): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_CATALOG_BYTES) {
    throw new Error(`${path}: serialized content exceeds the 1,500,000-byte limit. Reduce the catalog before saving or publishing.`);
  }
}

/** Pure validation shared by the editor and server; authoritative checks run server-side. */
export function validateCatalog(input: unknown): asserts input is AdminCatalog {
  const catalog = record(input, "catalog", ["revision", "worlds", "publishedRevision", "publishedAt"], ["revision", "worlds"]);
  if (!Number.isSafeInteger(catalog.revision) || (catalog.revision as number) < 0) throw new Error("catalog.revision: expected a nonnegative integer.");
  const worlds = list(catalog.worlds, "catalog.worlds", 20);
  if (worlds.length === 0) throw new Error("Keep at least one world in the catalog.");
  const worldIds = new Set<string>();
  const publicationWorlds: PublishedWorld[] = [];
  let playable = false;
  for (let i = 0; i < worlds.length; i++) {
    const path = `worlds[${i}]`;
    const world = record(worlds[i], path, ["id", "enabled", "pack", "routes", "disabledEventIds", "eventVisuals"], ["id", "enabled", "pack", "routes", "disabledEventIds"]);
    const worldId = id(world.id, `${path}.id`);
    if (worldIds.has(worldId)) throw new Error(`${path}.id: duplicate world ID.`);
    worldIds.add(worldId);
    enabled(world.enabled, `${path}.enabled`);
    playable ||= world.enabled === true;
    validateWorld(world.pack);
    if (world.pack.id !== worldId) throw new Error(`${path}: the world ID must match the pack ID.`);
    const eventIds = new Set(world.pack.events.map(event => event.id));
    if (Object.hasOwn(world, "eventVisuals")) {
      const assignments = record(world.eventVisuals, `${path}.eventVisuals`, [...eventIds], []);
      for (const [eventId, assignment] of Object.entries(assignments)) {
        const visualPath = `${path}.eventVisuals.${eventId}`;
        const visual = record(assignment, visualPath, ["scene", "motion", "caption"], ["scene", "motion"]);
        if (typeof visual.scene !== "string" || !SCENE_IDS.includes(visual.scene as SceneId)) throw new Error(`${visualPath}.scene: choose an available scene.`);
        if (typeof visual.motion !== "string" || !MOTION_IDS.includes(visual.motion as MotionId)) throw new Error(`${visualPath}.motion: choose an available animation.`);
        if (Object.hasOwn(visual, "caption")) text(visual.caption, `${visualPath}.caption`, 2_000);
      }
    }
    const disabledIds = list(world.disabledEventIds, `${path}.disabledEventIds`, 5_000);
    const seenDisabled = new Set<string>();
    for (const value of disabledIds) {
      const eventId = id(value, `${path}.disabledEventIds`);
      if (!eventIds.has(eventId)) throw new Error(`${path}: disabled event ${eventId} does not exist.`);
      if (seenDisabled.has(eventId)) throw new Error(`${path}: duplicate disabled event ${eventId}.`);
      seenDisabled.add(eventId);
    }
    const routes = list(world.routes, `${path}.routes`, 200);
    const routeIds = new Set<string>();
    const routeFlags = new Set<string>();
    for (let j = 0; j < routes.length; j++) {
      const routePath = `${path}.routes[${j}]`;
      const route = record(routes[j], routePath, ["id", "title", "description", "flag", "enabled"]);
      const routeId = id(route.id, `${routePath}.id`);
      const routeFlag = id(route.flag, `${routePath}.flag`);
      if (routeIds.has(routeId) || routeFlags.has(routeFlag)) throw new Error(`${routePath}: route IDs and flags must be unique within a world.`);
      routeIds.add(routeId);
      routeFlags.add(routeFlag);
      text(route.title, `${routePath}.title`, 200);
      text(route.description, `${routePath}.description`, 2_000);
      enabled(route.enabled, `${routePath}.enabled`);
      if (!Object.hasOwn(world.pack.flags, routeFlag)) throw new Error(`${routePath}: flag ${routeFlag} is not declared by the pack.`);
    }
    // Compile after metadata validation: disabled routes/events must leave a valid pack.
    const published = compilePublishedWorld(worlds[i] as ManagedWorld);
    if (world.enabled) {
      boundedJson(published, `${path}.published`);
      publicationWorlds.push(published);
    }
  }
  if (!playable) throw new Error("Keep at least one enabled world available to players.");
  // Serialize only structurally validated draft fields, never optional metadata.
  boundedJson({ revision: catalog.revision, worlds }, "catalog");
  boundedJson(publicationWorlds, "published catalog");
}

/** Route switches remove entry choices; existing lives remain pinned to their old pack. */
export function compileWorld(world: ManagedWorld): WorldPack {
  validateWorld(world.pack);
  const pack = structuredClone(world.pack);
  const disabledEvents = new Set(world.disabledEventIds);
  const disabledFlags = new Set(world.routes.filter(route => !route.enabled).map(route => route.flag));
  for (const flag of disabledFlags) {
    const nonChoiceEffects = [
      ...pack.origins.flatMap(origin => origin.effects), ...pack.yearlyEffects,
      ...(pack.yearlyRules ?? []).flatMap(rule => rule.effects),
      ...pack.events.filter(event => event.mode === "automatic" && !disabledEvents.has(event.id)).flatMap(event => event.effects ?? []),
    ];
    if (pack.flags[flag]?.initial || nonChoiceEffects.some(effect => effect.type === "flag" && effect.flag === flag && effect.value)) {
      throw new Error(`Route ${flag} also starts outside a player choice; remove that activation before disabling this route.`);
    }
  }
  pack.events = pack.events.filter(event => !disabledEvents.has(event.id)).map(event => {
    if (event.mode === "automatic") return event;
    const choices = event.choices.filter(choice => !choice.outcomes.some(outcome =>
      outcome.effects.some(effect => effect.type === "flag" && effect.value && disabledFlags.has(effect.flag))));
    if (choices.length === 0) throw new Error(`Disabling routes leaves event “${event.title}” without a choice. Enable a route or disable that event.`);
    return { ...event, choices };
  });
  if (pack.character && disabledFlags.size) pack.character.activities = pack.character.activities.filter(activity =>
    !activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "flag" && effect.value && disabledFlags.has(effect.flag))));
  validateWorld(pack);
  return pack;
}

/** A visual edit creates a new presentation revision without changing save compatibility. */
export function compilePublishedWorld(world: ManagedWorld): PublishedWorld {
  const pack = compileWorld(world);
  const routes = structuredClone(world.routes);
  const enabledEvents = new Set(pack.events.map(event => event.id));
  const presentation = world.eventVisuals === undefined ? {} : {
    eventVisuals: structuredClone(Object.fromEntries(Object.entries(world.eventVisuals).filter(([eventId]) => enabledEvents.has(eventId)))),
  };
  return { id: world.id, revisionId: `pack-${contentFingerprint({ pack, routes, ...presentation })}`, pack, routes, ...presentation };
}

export function getBuiltinCatalog(pack: unknown = alexandria): AdminCatalog {
  validateWorld(pack);
  return { revision: 0, publishedRevision: 0, publishedAt: null, worlds: [{
    id: pack.id, enabled: true, pack: structuredClone(pack), disabledEventIds: [], routes: [
      { id: "home", title: "Life in the city", description: "Build a life close to home and the people who know you.", flag: "stayed", enabled: true },
      { id: "sea", title: "Life at sea", description: "Work aboard a merchant ship and discover other shores.", flag: "sailed", enabled: true },
      { id: "study", title: "The written word", description: "Learn letters and join a copyist's workshop.", flag: "studied", enabled: true },
      ...[
        { id: "court-access", title: "Court recommendation", description: "Prepare a petition and seek a recommendation for royal service.", flag: "court-recommendation", enabled: true },
        { id: "officer-access", title: "Officer recommendation", description: "Organise unit supplies and apply for a commission.", flag: "officer-recommendation", enabled: true },
        { id: "scholar-access", title: "A scholarly patron", description: "Demonstrate your calculations and seek paid work for a learned household.", flag: "scholar-recommendation", enabled: true },
        { id: "workshop-access", title: "Workshop leadership", description: "Show a finished piece and earn a chance to lead a workshop.", flag: "workshop-recommendation", enabled: true },
      ].filter(route => Object.hasOwn(pack.flags, route.flag)),
    ],
  }] };
}

export function getBuiltinWorld(): PublishedWorld {
  const world = getBuiltinCatalog().worlds[0];
  return { id: world.id, revisionId: `pack-${contentFingerprint(world.pack)}`, pack: world.pack, routes: world.routes };
}

/** The original full-life pack remains available for saves made before 0.4. */
export function getLegacyWorld(): PublishedWorld {
  const world = getBuiltinCatalog(legacyAlexandria).worlds[0];
  return { id: world.id, revisionId: `pack-${contentFingerprint(world.pack)}`, pack: world.pack, routes: world.routes };
}

export function getPreviousWorld(): PublishedWorld {
  const world = getBuiltinCatalog(previousAlexandria).worlds[0];
  return { id: world.id, revisionId: `pack-${contentFingerprint(world.pack)}`, pack: world.pack, routes: world.routes };
}

/** Bundled factory revisions are retained even if they were never saved in D1. */
export function getArchivedBuiltinWorld(id: string): PublishedWorld | undefined {
  for (const pack of [legacyAlexandria, previousAlexandria, specialistAlexandria, namedCausesAlexandria, originRangesAlexandria, longerLivesAlexandria, peopleAlexandria, skillTreeAlexandria, moneyAlexandria, variedAlexandria, birthAlexandria, coherentAlexandria, workTimelineAlexandria, interestCareersAlexandria, causalHealthAlexandria, statDecayAlexandria, specificCraftAlexandria, strictProgressionAlexandria, careerOpeningsAlexandria, adultMortalityAlexandria, moneylenderAlexandria, eventVarietyAlexandria, rareEncountersAlexandria, masteryOpeningsAlexandria]) {
    const world = getBuiltinCatalog(pack).worlds[0];
    const revisionId = `pack-${contentFingerprint(world.pack)}`;
    if (id === revisionId) return { id: world.id, revisionId, pack: world.pack, routes: world.routes };
  }
}

/** Upgrade only the untouched factory draft; edited and published content stays exact. */
export function isLegacyFactoryDraft(worlds: unknown): boolean {
  return [legacyAlexandria, previousAlexandria, specialistAlexandria, namedCausesAlexandria, originRangesAlexandria, longerLivesAlexandria, peopleAlexandria, skillTreeAlexandria, moneyAlexandria, variedAlexandria, birthAlexandria, coherentAlexandria, workTimelineAlexandria, interestCareersAlexandria, causalHealthAlexandria, statDecayAlexandria, specificCraftAlexandria, strictProgressionAlexandria, careerOpeningsAlexandria, adultMortalityAlexandria, moneylenderAlexandria, eventVarietyAlexandria, rareEncountersAlexandria, masteryOpeningsAlexandria].some(pack => JSON.stringify(worlds) === JSON.stringify(getBuiltinCatalog(pack).worlds));
}

export function worldSummary(world: PublishedWorld): WorldSummary {
  return { id: world.id, title: world.pack.title, version: world.pack.version, description: world.pack.description, routes: world.routes };
}
