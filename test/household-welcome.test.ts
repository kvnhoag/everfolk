import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { getHouseholdWelcome } from "../client/models/household-welcome.ts";
import { createRoyaltyTestSession } from "../client/models/royalty-test.ts";
import { formatMoney } from "../client/models/wealth.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import beforeManagement from "../worlds/alexandria-0.43.0.json" with { type: "json" };
import firstRoyalCouncil from "../worlds/alexandria-0.44.0.json" with { type: "json" };
import firstEstateCouncil from "../worlds/alexandria-0.45.0.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: HouseholdWelcome } = await import("../client/components/HouseholdWelcome.tsx");
hooks.deregister();

const engine = createEngine(current);
const classes = [
  { kind: "royal", origin: "royal-household", preset: "comfortable", council: "Royal council", tutor: "royal-study-statecraft",
    titles: ["Ambassador of the House", "Guardian of the House", "Unifier of the House"] },
  { kind: "aristocrat", origin: "estate-household", preset: "aristocrat-comfortable", council: "Estate council", tutor: "aristocrat-study-estates",
    titles: ["Restorer of the Estate", "Trusted Patron", "Keeper of the Family Lands"] },
] as const;

function birthFor(engine: LifeEngine, origin: string): LifeState {
  for (let index = 0; index < 2048; index++) {
    const life = engine.start(`household-welcome-${origin}-${index}`);
    if (life.originId === origin) return life;
  }
  assert.fail(`Expected an ordinary seeded birth into ${origin}.`);
}

function render(life: LifeState, world: WorldPack, open = true) {
  let callbacks = 0;
  const html = renderToStaticMarkup(createElement(HouseholdWelcome, {
    open, life, world, onClose: () => { callbacks++; }, onOpenCouncil: () => { callbacks++; },
  }));
  assert.equal(callbacks, 0, "Reading or rendering an introduction must never perform a council action.");
  return html;
}

test("household introductions follow each actual class, its current treasury and its three earned title paths", () => {
  for (const household of classes) {
    const life = birthFor(engine, household.origin), world = engine.world;
    const before = JSON.stringify({ world, life });
    const introduction = getHouseholdWelcome(world, life)!;
    const rules = household.kind === "royal" ? world.royalty! : world.aristocracy!;
    const values = household.kind === "royal" ? life.royalty! : life.aristocracy!;
    assert.equal(introduction.kind, household.kind);
    assert.equal(introduction.councilTitle, household.council);
    assert.equal(introduction.treasury, values.treasury);
    assert.equal(introduction.minAge, rules.minAge);
    assert.deepEqual(introduction.titleNames, household.titles);
    assert.deepEqual(introduction.metrics.map(metric => [metric.id, metric.label, metric.value]),
      Object.entries(values).filter(([id]) => id !== "treasury").map(([id, value]) => [id, rules.metrics[id as keyof typeof rules.metrics].label, value]));
    assert.match(introduction.title, /Congratulations.*born into/i);
    const treasuryStep = introduction.steps.find(step => step.id === "treasury")!;
    assert.ok(treasuryStep.detail.includes(formatMoney(values.treasury, world)));
    const priorities = introduction.steps.find(step => step.id === "decisions")!;
    assert.match(priorities.detail, /one major activity each year/i);
    const tutor = world.character!.activities.find(activity => activity.id === household.tutor)!;
    assert.ok(priorities.detail.includes(`age ${tutor.minAge}`), "The guide uses the actual tutor's starting age.");
    assert.equal(JSON.stringify({ world, life }), before, "An introduction must leave simulation state and authored content unchanged.");
  }
});

test("newborn guidance explains later responsibility while adult test houses can explore their current council", () => {
  for (const household of classes) {
    const newborn = birthFor(engine, household.origin);
    const newbornGuide = getHouseholdWelcome(engine.world, newborn)!;
    assert.equal(newborn.age, 0);
    assert.match(newbornGuide.childhoodNote, /relatives.*care.*now/i);
    assert.ok(newbornGuide.childhoodNote.includes(`age ${newbornGuide.minAge}`));
    assert.match(newbornGuide.steps.find(step => step.id === "decisions")!.detail, /relatives manage.*while you grow/i);

    const adult = createRoyaltyTestSession(household.preset);
    const adultGuide = getHouseholdWelcome(adult.engine.world, adult.life)!;
    assert.equal(adultGuide.treasury, household.kind === "royal" ? adult.life.royalty!.treasury : adult.life.aristocracy!.treasury);
    assert.doesNotMatch(adultGuide.childhoodNote, /relatives.*care.*now|while you grow/i);
    assert.doesNotMatch(adultGuide.steps.find(step => step.id === "decisions")!.detail, /relatives manage.*while you grow/i);
    assert.ok(adultGuide.steps.find(step => step.id === "decisions")!.detail.includes(`from age ${adultGuide.minAge}`));
  }
});

test("common households and retained origins without management rules receive no privileged introduction", () => {
  const commonOrigin = engine.world.origins.find(origin => !classes.some(household => household.origin === origin.id))!.id;
  const common = birthFor(engine, commonOrigin);
  assert.equal(getHouseholdWelcome(engine.world, common), undefined);
  assert.equal(render(common, engine.world), "");
  const retained = createEngine(beforeManagement);
  for (const household of classes) {
    const life = birthFor(retained, household.origin);
    assert.equal(getHouseholdWelcome(retained.world, life), undefined, "A matching origin name cannot opt an older life into newer management.");
    assert.equal(render(life, retained.world), "");
  }
});

test("earlier council worlds describe only the lessons and distinctions those worlds actually support", () => {
  for (const [pack, origin] of [[firstRoyalCouncil, "royal-household"], [firstEstateCouncil, "estate-household"]] as const) {
    const retained = createEngine(pack), life = birthFor(retained, origin);
    const introduction = getHouseholdWelcome(retained.world, life)!;
    assert.ok(introduction);
    assert.deepEqual(introduction.titleNames, []);
    const learning = introduction.steps.find(step => step.id === "titles")!;
    assert.doesNotMatch(`${learning.title} ${learning.description} ${learning.detail}`, /Historical titles|Service & titles|lessons funded by your household/i,
      "Retained packs must not promise features introduced by a later world revision.");
    assert.match(render(life, retained.world), /Show me around/);
  }
});

test("welcome markup offers a labelled, skippable introduction without accessing storage or acting on the life", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let storageAccesses = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { storageAccesses++; throw new Error("The guide is presentation only."); },
    get sessionStorage() { storageAccesses++; throw new Error("The guide is presentation only."); },
  } });
  try {
    for (const household of classes) {
      const session = createRoyaltyTestSession(household.preset), before = JSON.stringify(session.life);
      assert.equal(render(session.life, session.engine.world, false), "", "A dismissed guide must render nothing.");
      const html = render(session.life, session.engine.world);
      assert.match(html, /<dialog[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby="[^"]+"/);
      assert.match(html, /<h2[^>]*tabindex="-1"[^>]*>Congratulations/);
      assert.doesNotMatch(html, /aria-label="Close household introduction"/);
      assert.match(html, /<button[^>]*>Skip tour<\/button>/);
      assert.match(html, /Show me around/);
      assert.ok(html.includes(household.council));
      assert.equal(JSON.stringify(session.life), before);
    }
    assert.equal(storageAccesses, 0, "Preview guides must stay independent of personal saves and preferences.");
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
