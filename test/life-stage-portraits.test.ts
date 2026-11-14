import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { resolveLifeBanner } from "../client/models/banner-state.ts";
import { lifeRoadmap } from "../client/models/life-roadmap.ts";
import { LIFE_PHASES } from "../client/models/life-phases.ts";
import { resolvePortraitState } from "../client/models/portrait-state.ts";
import type { AvatarSex } from "../client/models/life-background.ts";
import lives11Pack from "../worlds/demo/alexandria-lives-11.json" with { type: "json" };

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
          fileName: new URL(url).pathname,
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { LifePage } = await import("../client/components/HowToPlayPages.tsx");
hooks.deregister();

const world = lives11Pack as unknown as WorldPack;
const SEXES: readonly AvatarSex[] = ["female", "male"];
const VARIANTS = [0, 1, 2] as const;
const OLDEST_AGE = 100;
const stageStarts = LIFE_PHASES.map(phase => phase.fromAge);

const srcAt = (age: number, sex: AvatarSex, avatarVariant = 0) => resolvePortraitState({ age, sex, avatarVariant, seed: "stage-portraits" }).src;
const file = (src: string) => src.split("/").pop();

function roadPortraits(sex: AvatarSex): string[] {
  const html = renderToStaticMarkup(createElement(LifePage, {
    stages: lifeRoadmap(world, null),
    guides: [],
    selected: "early-years",
    onSelect() {},
    portrait: { seed: "how-to-play-stages", name: "Your character", sex, avatarVariant: 0 },
  }));
  return [...html.matchAll(/class="htp-stage-portrait"><img[^>]*? src="([^"]+)"/g)].map(match => match[1]);
}

test("How to Play shows a different portrait for every life stage, for both sexes", () => {
  for (const sex of SEXES) {
    const srcs = roadPortraits(sex);
    assert.equal(srcs.length, LIFE_PHASES.length, `${sex}: one portrait per stage`);
    assert.equal(new Set(srcs).size, LIFE_PHASES.length, `${sex}: no two stages share a portrait (${srcs.map(file).join(", ")})`);
  }
});

test("youth starts at 12, in step with the How to Play stages, not a year later", () => {
  const youth = LIFE_PHASES.find(phase => phase.id === "youth")!;
  assert.equal(youth.fromAge, 12);
  for (const sex of SEXES) {
    assert.notEqual(srcAt(11, sex), srcAt(12, sex), `${sex}: the portrait changes when youth begins`);
    assert.equal(resolvePortraitState({ age: 11, sex }).stage, "child");
    assert.equal(resolvePortraitState({ age: 12, sex }).stage, "youth");
  }
});

// The registry has no toddler art, so ages 3 to 5 (early years) and childhood share the child portrait.
const SHARES_ART_WITH_PREVIOUS_STAGE = new Set(["childhood"]);

test("each stage keeps one portrait across its whole age range, and it changes exactly where the next stage starts", () => {
  for (const sex of SEXES) for (const avatarVariant of VARIANTS) {
    for (const phase of LIFE_PHASES.filter(item => item.id !== "early-years")) {
      const last = phase.toAge ?? OLDEST_AGE;
      const portraits = new Set<string>();
      for (let age = phase.fromAge; age <= last; age++) portraits.add(srcAt(age, sex, avatarVariant));
      assert.equal(portraits.size, 1, `${sex} ${phase.title}: ages ${phase.fromAge}–${last} share one portrait`);
      if (SHARES_ART_WITH_PREVIOUS_STAGE.has(phase.id)) continue;
      assert.notEqual(srcAt(phase.fromAge - 1, sex, avatarVariant), srcAt(phase.fromAge, sex, avatarVariant), `${sex}: the portrait changes at age ${phase.fromAge}`);
    }
  }
});

test("early years show the infant, then the child as soon as the registry has child art", () => {
  for (const sex of SEXES) {
    assert.equal(file(srcAt(0, sex)), "infant-c1.png");
    assert.equal(file(srcAt(2, sex)), "infant-c1.png");
    assert.equal(srcAt(3, sex), srcAt(11, sex), "ages 3 to 5 have no toddler art of their own, so they share the child portrait");
  }
});

test("a job or household role still wins for adults, and a younger stage ignores a job it is too young for", () => {
  const scientistAdult = resolvePortraitState({ age: 30, sex: "male", jobId: "scientist" });
  assert.equal(scientistAdult.selectionReason, "job");
  assert.equal(file(scientistAdult.src), "scholar-clerk-m01.png");
  assert.equal(resolvePortraitState({ age: 30, sex: "male", role: "royalty" }).selectionReason, "royalty");
  assert.equal(resolvePortraitState({ age: 30, sex: "female", role: "aristocrat" }).selectionReason, "aristocrat");
  const youthWithAdultJob = resolvePortraitState({ age: 12, sex: "male", jobId: "scientist" });
  assert.equal(youthWithAdultJob.selectionReason, "age-default");
  assert.equal(youthWithAdultJob.stage, "youth");
});

test("NFT card portraits keep their earlier age bands", () => {
  for (const sex of SEXES) {
    assert.equal(resolvePortraitState({ age: 12, sex, portraitSet: "ordinary-v3" }).stage, "child");
    assert.equal(resolvePortraitState({ age: 13, sex, portraitSet: "ordinary-v3" }).stage, "youth");
  }
});

test("the life banner names the same stage the portrait shows", () => {
  const life: LifeState = structuredClone(createEngine(world).start("stage-banner"));
  for (const [age, label, stage] of [[11, "Childhood", "child"], [12, "Youth", "youth"], [17, "Youth", "youth"], [18, "Adulthood", "adult"]] as const) {
    const banner = resolveLifeBanner({ ...life, age, phase: "ready", pendingEventId: null }, world);
    assert.equal(banner.stage, stage, `age ${age}`);
    assert.equal(banner.stageLabel, label, `age ${age}`);
  }
  assert.deepEqual(stageStarts, [0, 6, 12, 18, 60], "the roadmap this test follows");
});
