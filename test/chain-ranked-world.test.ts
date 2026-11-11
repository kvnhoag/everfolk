import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import base from "../worlds/alexandria-0.33.0.json" with { type: "json" };
import keyDecisions from "../chain/catalog/key-decisions.json" with { type: "json" };
import { FIGURES, INFLUENCES, KEY_DECISIONS, keyDecisionCategory } from "../chain/catalog/index.ts";
import { CATEGORIES, FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS, RANKED_WORLD_VERSION } from "../chain/ids.ts";
import { buildContractCatalog, buildRankedWorld } from "../chain/ranked-world.ts";
import { figureMediaUrl } from "../chain/figure-media.ts";
import { rankedWorldVersion } from "../chain/validate-ranked.ts";
import { createEngine } from "../src/engine.ts";
import { canonicalJson } from "../src/random.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";

const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const ranked = readJson("../worlds/ranked/alexandria-ranked-1.json") as WorldPack;
const contractCatalog = readJson("../chain/catalog/contract-catalog.json") as {
  figures: { figure_id: string; title: string; media: string; supply_cap: number; action_ids: string[] }[];
  npc_actions: { action_id: string; career_group: string; category: string }[];
};

test("every key decision id is a choice event in the ranked world", () => {
  const entries = Object.entries(keyDecisions);
  assert.ok(entries.length >= 20 && entries.length <= 64, `${entries.length} key decisions`);
  const influenceEvents = new Set(INFLUENCES.flatMap(entry => entry.event ? [entry.event.id] : []));
  const events = new Map(ranked.events.map(event => [event.id, event]));
  for (const [id, category] of entries) {
    const event = events.get(id);
    assert.ok(event, `${id} is an event of the ranked world`);
    assert.notEqual(event.mode, "automatic", `${id} is a decision`);
    assert.ok(event.choices.length >= 2, `${id} offers a choice`);
    assert.ok(!influenceEvents.has(id), `${id} is a pack event, not an influence event`);
    assert.ok((CATEGORIES as readonly string[]).includes(category), `${id}: unknown category ${category}`);
    assert.equal(keyDecisionCategory(id), category);
  }
  assert.deepEqual(KEY_DECISIONS, keyDecisions);
  assert.equal(keyDecisionCategory("the-small-pleasures"), null);
  assert.ok(Object.isFrozen(KEY_DECISIONS));
});

test("every category has at least 3 key decisions", () => {
  for (const category of CATEGORIES) {
    const count = Object.values(keyDecisions).filter(value => value === category).length;
    assert.ok(count >= 3, `${category} has ${count} key decisions`);
  }
});


test("exclusive alternatives of a key decision draw the same category", () => {
  const groups = new Map<string, string[]>();
  for (const event of ranked.events) {
    if (!event.exclusiveGroup) continue;
    const members = groups.get(event.exclusiveGroup) ?? [];
    members.push(event.id);
    groups.set(event.exclusiveGroup, members);
  }
  for (const [group, members] of groups) {
    const marked = members.filter(id => Object.hasOwn(keyDecisions, id));
    if (marked.length === 0) continue;
    const category = keyDecisions[marked[0] as keyof typeof keyDecisions];
    for (const id of members) {
      assert.equal(keyDecisions[id as keyof typeof keyDecisions], category, `${group} leaves ${id} out of ${category}`);
    }
  }
});
test("ranked world validates and its fingerprint is stable across builds", () => {
  assert.doesNotThrow(() => validateWorld(structuredClone(ranked)));
  assert.equal(ranked.id, "alexandria");
  assert.equal(ranked.version, "ranked-1");
  assert.equal(rankedWorldVersion({ worldId: ranked.id, worldVersion: ranked.version }), RANKED_WORLD_VERSION);
  assert.equal(canonicalJson(ranked.influences), canonicalJson(INFLUENCES));

  const first = buildRankedWorld(structuredClone(base) as unknown as WorldPack);
  const second = buildRankedWorld(structuredClone(base) as unknown as WorldPack);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(canonicalJson(first), canonicalJson(ranked), "the committed ranked world is the current build (run pnpm ranked:world)");
  const fingerprint = createEngine(ranked).fingerprint;
  assert.equal(createEngine(first).fingerprint, fingerprint);
  assert.notEqual(fingerprint, createEngine(base as unknown as WorldPack).fingerprint);

  const { influences: _influences, id: _id, version: _version, ...rest } = ranked;
  const { id: _baseId, version: _baseVersion, ...baseRest } = base as unknown as WorldPack;
  assert.equal(canonicalJson(rest), canonicalJson(baseRest), "only id, version and influences differ from the base pack");
});

test("contract catalog lists every figure and NPC action", () => {
  assert.equal(canonicalJson(contractCatalog), canonicalJson(buildContractCatalog()), "the committed catalog is the current build");
  assert.deepEqual(contractCatalog.figures.map(figure => figure.figure_id), [...FIGURE_IDS]);
  for (const figure of contractCatalog.figures) {
    const requirement = FIGURES.find(item => item.figure === figure.figure_id)!;
    assert.equal(figure.title, requirement.title);
    assert.equal(figure.supply_cap, requirement.supplyCap);
    assert.equal(figure.media, figureMediaUrl(figure.figure_id as typeof FIGURE_IDS[number]));
    const png = readFileSync(new URL(`../public${figure.media}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 480);
    assert.equal(png.readUInt32BE(20), 640);
    assert.deepEqual(figure.action_ids, [...FIGURE_ACTIONS[figure.figure_id as keyof typeof FIGURE_ACTIONS]]);
  }
  const expected = Object.entries(NPC_ACTIONS).flatMap(([group, { category, actions }]) =>
    actions.map(action_id => ({ action_id, career_group: group, category })));
  assert.deepEqual(contractCatalog.npc_actions, expected);
});

// Marketplace metadata needs a public absolute URL when the catalog is published.
test("figure catalog accepts a public media base and rejects invalid URLs", () => {
  const published = buildContractCatalog("https://everfolk.example/demo/");
  for (const figure of published.figures) {
    assert.equal(figure.media, `https://everfolk.example/demo/assets/figures/${figure.figure_id}.png`);
  }
  for (const base of ["/relative", "javascript:alert(1)", "https://example.com/?x=1", "https://user:password@example.com"]) {
    assert.throws(() => buildContractCatalog(base), /FIGURE_MEDIA_BASE_URL/);
  }
});
