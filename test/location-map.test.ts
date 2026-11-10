import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { buildLocationMap, supportsLocationMap } from "../client/location-map.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.31.0.json" with { type: "json" };

const world = current as WorldPack;
const engine = createEngine(world);
const initial = engine.start("location-map-display");

// Explicit display fixtures test year boundaries without advancing or changing a save.
const at = (year: number, life: LifeState = initial): LifeState => ({ ...life, year });

test("the home coast becomes Alexandria at the authored foundation year", () => {
  const before = buildLocationMap(world, at(-332));
  assert.equal(before.placeName, "Rhakotis coast");
  assert.equal(before.founded, false);
  assert.equal(before.cityPlaces.some(place => place.id === "eastern-harbour"), false);
  assert.match(before.cityPlaces.find(place => place.id === "home")!.description, /not yet been founded.*331 BCE/);
  const founded = buildLocationMap(world, at(-331));
  assert.equal(founded.placeName, "Alexandria");
  assert.equal(founded.founded, true);
  assert.equal(founded.cityPlaces.some(place => place.id === "eastern-harbour"), true);
  assert.equal(founded.yearLabel, "331 BCE");
});

test("the island appears before the lighthouse, which arrives at the authored milestone", () => {
  const before = buildLocationMap(world, at(-281));
  assert.equal(before.lighthouseBuilt, false);
  assert.equal(before.cityPlaces.find(place => place.id === "pharos")!.label, "Pharos island");
  const after = buildLocationMap(world, at(-280));
  assert.equal(after.lighthouseBuilt, true);
  assert.equal(after.cityPlaces.find(place => place.id === "pharos")!.label, "Pharos lighthouse");
  assert.match(after.cityPlaces.find(place => place.id === "pharos")!.description, /approximate/);
});

test("retained lives without classical events use the historical era fallbacks", () => {
  const oldWorld = retained as WorldPack;
  assert.equal(oldWorld.events.some(event => event.id === "classical-alexandria-founded" || event.id === "classical-pharos-completed"), false);
  const oldLife = createEngine(oldWorld).start("retained-location-map");
  assert.equal(supportsLocationMap(oldWorld), true);
  const model = buildLocationMap(oldWorld, oldLife);
  assert.equal(model.placeName, "Alexandria");
  assert.equal(model.founded, true);
  assert.equal(model.lighthouseBuilt, true);
  assert.equal(buildLocationMap(oldWorld, at(-350, oldLife)).placeName, "Rhakotis coast");
  assert.equal(buildLocationMap(oldWorld, at(-332, oldLife)).founded, false);
  assert.equal(buildLocationMap(oldWorld, at(-331, oldLife)).founded, true);
  assert.equal(buildLocationMap(oldWorld, at(-281, oldLife)).lighthouseBuilt, false);
  assert.equal(buildLocationMap(oldWorld, at(-280, oldLife)).lighthouseBuilt, true);
});

test("edited milestone years take precedence over historical display fallbacks", () => {
  const revised = structuredClone(world);
  revised.events.find(event => event.id === "classical-alexandria-founded")!.trigger = { type: "year", at: -320 };
  revised.events.find(event => event.id === "classical-pharos-completed")!.trigger = { type: "year", at: -260 };
  assert.equal(buildLocationMap(revised, at(-321)).founded, false);
  assert.equal(buildLocationMap(revised, at(-321)).placeName, "Rhakotis coast");
  assert.equal(buildLocationMap(revised, at(-320)).placeName, "Alexandria");
  assert.equal(buildLocationMap(revised, at(-261)).lighthouseBuilt, false);
  assert.equal(buildLocationMap(revised, at(-260)).lighthouseBuilt, true);
});

test("jobs, origins and permanent journey flags never masquerade as current travel", () => {
  const home = buildLocationMap(world, at(-325));
  const travelled: LifeState = { ...at(-325), originId: "delta-newcomers", flags: { ...initial.flags, sailed: true, "heard-aristotle": true },
    character: { ...initial.character!, jobId: "sailor" } };
  const result = buildLocationMap(world, travelled);
  assert.deepEqual(result, home);
  assert.match(result.homeNote, /home area.*particular house/);
});

test("viewing a frozen life leaves its RNG, commands and world unchanged", () => {
  const beforeWorld = structuredClone(world), beforeLife = structuredClone(initial);
  assert.ok(Object.isFrozen(initial));
  const first = buildLocationMap(world, initial);
  assert.deepEqual(buildLocationMap(world, initial), first);
  assert.equal(initial.rngState, beforeLife.rngState);
  assert.deepEqual(initial.commands, beforeLife.commands);
  assert.deepEqual(initial, beforeLife);
  assert.deepEqual(world, beforeWorld);
});

test("unrelated worlds do not receive an invented Alexandria map", () => {
  assert.equal(supportsLocationMap(world), true);
  assert.equal(supportsLocationMap({ ...world, id: "unrelated-world", events: [] }), false);
  assert.equal(supportsLocationMap({ ...world, id: "alexandrian-fiction", events: [] }), false);
  assert.equal(supportsLocationMap({ ...world, id: "renamed-classical-world" }), true);
});

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: WorldMap } = await import("../client/WorldMap.tsx");
hooks.deregister();

test("the early home map labels both scales and omits the later city and lighthouse", () => {
  const beforeLife = structuredClone(initial), beforeWorld = structuredClone(world);
  const html = renderToStaticMarkup(createElement(WorldMap, { life: initial, world }));
  assert.match(html, /aria-label="Your location in Egypt"/);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>Alexandria area<\/button>/);
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*>Egypt<\/button>/);
  assert.match(html, /YOUR HOME AREA/);
  assert.match(html, /Rhakotis coast/);
  assert.match(html, /Schematic, not to scale/);
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby=/);
  assert.match(html, /Map references/);
  assert.doesNotMatch(html, /location-map-city-blocks|location-map-lighthouse/);
  assert.deepEqual(initial, beforeLife);
  assert.deepEqual(world, beforeWorld);
});

test("later maps show era-appropriate city and lighthouse landmarks without moving the home pin", () => {
  const founded = renderToStaticMarkup(createElement(WorldMap, { life: at(-331), world }));
  assert.match(founded, /location-map-city-blocks/);
  assert.doesNotMatch(founded, /location-map-lighthouse/);
  const lighthouse = renderToStaticMarkup(createElement(WorldMap, { life: at(-280), world }));
  assert.match(lighthouse, /location-map-city-blocks/);
  assert.match(lighthouse, /location-map-lighthouse/);
  assert.match(lighthouse, /Pharos lighthouse/);
  assert.match(lighthouse, /Your home area is marked at Alexandria/);
  assert.deepEqual(buildLocationMap(world, at(-350)).cityMarker, buildLocationMap(world, at(-280)).cityMarker);
});
