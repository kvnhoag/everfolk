import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEngine } from "../src/index.ts";
import type { JournalEntry, WorldPack } from "../src/types.ts";
import ranked from "../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };
import sample from "../worlds/alexandria-sample.json" with { type: "json" };
import { FIGURE_ACTIONS, NPC_ACTIONS } from "../chain/ids.ts";
import { influenceActionId, influenceMarker } from "../client/influence-marker.ts";
import { buildLifeEvents } from "../client/life-events.ts";

const rankedWorld = ranked as unknown as WorldPack;
const SOURCE = { contractId: "everfolk-lives.testnet", tokenId: "7" };
const entry = (type: JournalEntry["type"], id: string, source?: JournalEntry["source"]): JournalEntry =>
  ({ type, id, text: "A recorded fact.", age: 20, year: -330, ...(source ? { source } : {}) });

test("entries without a source never get a marker", () => {
  for (const type of ["event", "outcome", "activity", "influence", "choice"] as const) {
    assert.equal(influenceMarker(entry(type, "letters.teach"), rankedWorld), null);
  }
});

test("people of the city are faience, famous figures are gold, each with the action menu label", () => {
  const npc = influenceMarker(entry("influence", "letters.teach", SOURCE), rankedWorld)!;
  assert.deepEqual(npc, {
    kind: "npc", material: "faience", actionId: "letters.teach", figureId: null,
    who: "a scholar", actionLabel: "Teach the young", text: "Shaped by a scholar: Teach the young", tokenId: "7",
  });
  const levyEvent = rankedWorld.influences!.find(item => item.id === "alexander.levy")!.event!.id;
  const figure = influenceMarker(entry("event", levyEvent, { ...SOURCE, tokenId: "1" }), rankedWorld)!;
  assert.equal(figure.kind, "figure");
  assert.equal(figure.material, "gold");
  assert.equal(figure.figureId, "alexander");
  assert.equal(figure.who, "Alexander");
  assert.equal(figure.actionLabel, "Levy the city");
  assert.equal(figure.tokenId, "1");
});

test("every catalog action resolves to its own figure or career group", () => {
  for (const [figureId, actions] of Object.entries(FIGURE_ACTIONS)) for (const actionId of actions) {
    const marker = influenceMarker(entry("influence", actionId, SOURCE), rankedWorld)!;
    assert.equal(marker.figureId, figureId);
    assert.equal(marker.material, "gold");
    const event = rankedWorld.influences!.find(item => item.id === actionId)?.event;
    if (event) assert.equal(influenceActionId({ type: "event", id: event.id }, rankedWorld), actionId);
  }
  for (const { actions } of Object.values(NPC_ACTIONS)) for (const actionId of actions) {
    const marker = influenceMarker(entry("influence", actionId, SOURCE), rankedWorld)!;
    assert.equal(marker.kind, "npc");
    assert.equal(marker.material, "faience");
    assert.notEqual(marker.actionLabel, "An unknown deed");
  }
});

test("an unknown action keeps a neutral marker instead of failing", () => {
  const marker = influenceMarker(entry("influence", "unknown.deed", SOURCE), rankedWorld)!;
  assert.equal(marker.kind, "npc");
  assert.equal(marker.who, "someone in the city");
  assert.equal(marker.actionLabel, "An unknown deed");
  assert.equal(influenceActionId(entry("outcome", "letters.teach", SOURCE), rankedWorld), null);
});

test("a ranked life's applied influence appears in the life record with its marker; free play is unchanged", () => {
  const engine = createEngine(rankedWorld);
  let life = engine.start("marker-life");
  life = engine.influence(life, { type: "influence", source: SOURCE, entry: "letters.teach", power: 1, mode: "apply" });
  const rows = buildLifeEvents(life, rankedWorld).flatMap(year => year.events);
  const shaped = rows.filter(row => row.marker);
  assert.equal(shaped.length, 1);
  assert.equal(shaped[0].kind, "influence");
  assert.equal(shaped[0].marker!.text, "Shaped by a scholar: Teach the young");

  const free = createEngine(sample as unknown as WorldPack);
  let freeLife = free.start("marker-free");
  for (let i = 0; i < 12 && freeLife.phase === "ready"; i++) freeLife = free.advance(freeLife);
  for (const row of buildLifeEvents(freeLife, sample as unknown as WorldPack).flatMap(year => year.events)) {
    assert.equal("marker" in row, false);
    assert.notEqual(row.kind, "influence");
  }
});

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export {};" };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname }).outputText };
  return next(url, context);
} });
const { default: LifeEventFeed } = await import("../client/LifeEventFeed.tsx");
hooks.deregister();

test("the feed renders the marker with text and shape, not colour alone", () => {
  const engine = createEngine(rankedWorld);
  const life = engine.influence(engine.start("marker-feed"), { type: "influence", source: SOURCE, entry: "commerce.credit", power: 1, mode: "apply" });
  const html = renderToStaticMarkup(createElement(LifeEventFeed, { life, world: rankedWorld }));
  assert.match(html, /class="influence-marker is-faience"/);
  assert.match(html, /Shaped by <strong>a trader<\/strong>/);
  assert.match(html, /Extend credit/);
  assert.match(html, /<path d="M6 1 11 6 6 11 1 6Z"/);
});
