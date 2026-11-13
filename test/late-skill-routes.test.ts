import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEngine, validateWorld } from "../src/index.ts";
import { getLegacyRoutes } from "../src/legacy.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { buildLateSkillRoutes, routeRequirements } from "../client/models/late-skill-routes.ts";
import { collectLegacyEntries, persistLegacyEntries, readLegacyEntries } from "../client/storage/legacy-store.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.33.0.json" with { type: "json" };
import vocational from "../worlds/demo/alexandria-lives-1.json" with { type: "json" };
import figures from "../research/late-route-figures.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LateSkillRoutes } = await import("../client/components/LateSkillRoutes.tsx");
hooks.deregister();
const world = current as WorldPack, engine = createEngine(world);

test("advanced paths project real work gates without changing a life, world or RNG", () => {
  const life = engine.start("late-tree-projection"), activities = engine.getActivities(life);
  const before = JSON.stringify({ life, world, activities });
  const routes = buildLateSkillRoutes(world, life, activities);
  assert.equal(routes.length, 7);
  assert.ok(routes.every(route => !route.discovered && route.stages.length === 3));
  assert.equal(routes.flatMap(route => route.stages.flatMap(stage => stage.nodes)).length, 28);
  const math = routes.find(route => route.id === "astronomy-calendar")!;
  assert.equal(math.entries.length, 2);
  assert.ok(math.entries.some(node => node.activity?.id === "complete-measured-plan"));
  assert.ok(routes[0].stages[1].nodes[0].requirements.some(item => item.text.includes("2+ years ago")));
  assert.equal(JSON.stringify({ life, world, activities }), before);
});

test("wiki shows both later branches, final assessment terms and cited figures without action buttons", () => {
  const life = engine.start("late-tree-wiki");
  const careers = world.legacy!.routes.filter(route => retained.legacy.routes.some(previous => previous.id === route.id));
  assert.equal(careers.length, 7);
  for (const route of careers) {
    const scoped = { ...world, legacy: { ...world.legacy!, routes: [route] } };
    const html = renderToStaticMarkup(createElement(LateSkillRoutes, { world: scoped, life, activities: engine.getActivities(life), readOnly: true, onActivity() { assert.fail("Read-only rendering acted"); } }));
    for (const stage of route.stages!) for (const id of stage.achievementIds) assert.ok(html.includes(world.legacy!.achievements.find(item => item.id === id)!.title.replaceAll("&", "&amp;").replaceAll("'", "&#x27;")), id);
    assert.match(html, /Complete either path to continue/);
    assert.match(html, /One final assessment for this career, whether it succeeds or fails/);
    assert.doesNotMatch(html, /late-route-action|\{name\}/);
    for (const figure of figures.filter(figure => figure.routeId === route.id)) {
      assert.ok(html.includes(figure.name), figure.name);
      assert.ok(html.includes(figure.url.replaceAll("&", "&amp;")), figure.url);
    }
  }
  assert.equal(figures.length, 21);
});

test("failed final reviews close the tree and next-goal display while earned titles survive gallery storage", () => {
  const life = structuredClone(engine.start("late-tree-final"));
  life.character!.skills.sculpture = 100;
  const route = world.legacy!.routes[0];
  const add = (id: string) => {
    const definition = world.legacy!.achievements.find(item => item.id === id)!;
    life.accomplishments!.push({ id: `${id}:30`, achievementId: id, routeId: route.id, title: definition.title, description: definition.description, kind: definition.kind, name: definition.nameTemplate.replaceAll("{name}", "Damon"), age: 30, year: -320, sourceId: "fixture", outcomeId: "fixture", people: [...definition.people] });
  };
  add("sculpture-first-work"); add("sculpture-monumental-work"); add("sculpture-signature-work");
  life.character!.lastActivityAges["undertake-sculpture-ultimate-title"] = 36;
  life.flags["late-sculpture-assessed"] = true;
  const projected = buildLateSkillRoutes(world, life, engine.getActivities(life))[0];
  assert.equal(projected.stages[2].nodes[0].state, "assessed");
  assert.equal(getLegacyRoutes(world, life)[0].next, undefined);
  const html = renderToStaticMarkup(createElement(LateSkillRoutes, { world, life, activities: engine.getActivities(life), onActivity() {} }));
  assert.match(html, /Assessment complete/);
  assert.doesNotMatch(html, /Submit final assessment/);
  add("sculpture-ultimate-title");
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  persistLegacyEntries(storage, collectLegacyEntries(world, life, []));
  assert.equal(readLegacyEntries(storage).at(-1)!.accomplishment.kind, "ultimate");
});

test("stage metadata rejects crossed, repeated and missing achievements", () => {
  for (const ids of [["philosophy-signature-work"], ["sculpture-monumental-work", "sculpture-monumental-work"], ["unknown-work"]]) {
    const invalid = structuredClone(world);
    invalid.legacy!.routes[0].stages![0].achievementIds = ids;
    assert.throws(() => validateWorld(invalid), /achievement|reference/);
  }
});

test("retained 0.33 lives continue with their original tree and deterministic replay", () => {
  const old = createEngine(retained as WorldPack);
  let life: LifeState = old.start("late-tree-archive");
  for (let i = 0; i < 3; i++) life = life.phase === "choice" ? old.choose(life, old.getChoices(life)[0].id) : old.advance(life);
  const loaded = loadAnyLife(old.save(life));
  assert.equal(engineForLife(loaded).fingerprint, old.fingerprint);
  assert.deepEqual(engineForLife(loaded).replay(loaded.seed, loaded.commands), loaded);
  assert.deepEqual(buildLateSkillRoutes(old.world, loaded, old.getActivities(loaded)), []);
});


test("completed-work requirements describe the authored activity and use its recorded count", () => {
  const vocationalWorld = vocational as unknown as WorldPack;
  const life = structuredClone(createEngine(vocationalWorld).start("completed-work-requirement"));
  const condition = { type: "vocation" as const, action: "measure-observations", count: 2 };
  const activity = vocationalWorld.character!.activities.find(activity => activity.id === "v-measure-observations")!;
  life.vocations!.completed[condition.action] = 1;
  assert.deepEqual(routeRequirements(condition, vocationalWorld, life), [
    { text: `${activity.text} · completed 2+ times`, met: false },
  ]);
  life.vocations!.completed[condition.action] = 2;
  assert.equal(routeRequirements(condition, vocationalWorld, life)[0].met, true);
  assert.deepEqual(routeRequirements(condition, vocationalWorld, engine.start("retained-no-work-ledger")), [
    { text: `${activity.text} · completed 2+ times`, met: false },
  ]);
});
