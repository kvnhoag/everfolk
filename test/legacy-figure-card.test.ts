import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { yearAtAge } from "../src/calendar.ts";
import { legacyFigureCard } from "../client/models/legacy-figure-card.ts";
import type { LegacyEntry } from "../client/storage/legacy-store.ts";
import type { AccomplishmentRecord, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LegacyGallery } = await import("../client/components/LegacyGallery.tsx");
hooks.deregister();

function fixture(id = "aristotle", tradition = false) {
  const world = structuredClone(current) as unknown as WorldPack;
  const path = world.figurePaths!.find(path => path.id === id)!;
  const life = { worldId: world.id, worldVersion: world.version, worldFingerprint: "fixture", seed: "collection", age: 90,
    birthYear: world.startYear, year: yearAtAge(world.startYear, 90), phase: "ready", stats: {}, flags: {},
    character: { skills: {} }, accomplishments: [] } as unknown as LifeState;
  const start = Math.max(18, (tradition ? path.tradition!.fromYear : path.encounter.fromYear) - world.startYear);
  function add(achievementId: string, sourceId: string, age: number, outcomeId?: string) {
    const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
    const activity = world.character!.activities.find(item => item.id === sourceId)!;
    const record: AccomplishmentRecord = { id: achievementId + ":" + age, achievementId, routeId: definition.routeId,
      title: definition.title, description: definition.description, name: definition.nameTemplate, kind: definition.kind,
      people: [], age, year: yearAtAge(world.startYear, age), sourceId,
      outcomeId: outcomeId ?? activity.outcomes.find(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!.id };
    life.accomplishments!.push(record); return record;
  }
  const contact = tradition ? path.tradition! : path.encounter;
  add(contact.achievementId, contact.activityId, start);
  const stages = path.stages.map((stage, index) => add(stage.achievementId, stage.activityId, start + index + 1));
  const capstone = () => add(path.capstone.achievementId, path.capstone.activityId, start + 5);
  const entry = (record: AccomplishmentRecord): LegacyEntry => ({ key: record.id, lifeKey: "fixture-life", worldId: life.worldId,
    worldVersion: life.worldVersion, worldFingerprint: life.worldFingerprint, seed: life.seed, characterName: "Dion", worldTitle: world.title,
    accomplishment: structuredClone(record) });
  return { world, life, path, start, add, stages, capstone, entry };
}

test("saved contribution cards retain the actual grade and direct or tradition title", () => {
  for (const tradition of [false, true]) {
    const f = fixture("aristotle", tradition);
    for (let index = 0; index < 3; index++) {
      const card = legacyFigureCard(f.entry(f.stages[index]), f.world, f.life)!;
      assert.equal(card.rank, ["Uncommon", "Rare", "Epic"][index]);
      assert.equal(card.mode, "contribution");
      assert.equal(card.title, tradition ? f.path.stages[index].traditionTitle : f.path.stages[index].title);
    }
  }
});

test("labels, prestige kinds and attached NFTs cannot assign rarity", () => {
  const f = fixture(), entry = f.entry(f.stages[0]);
  entry.accomplishment.title = "Legendary"; entry.accomplishment.kind = "ultimate";
  entry.nft = { tokenId: "999", explorerUrl: "https://example.org/token/999" };
  const before = JSON.stringify(entry), card = legacyFigureCard(entry, f.world, f.life)!;
  assert.equal(card.rank, "Uncommon"); assert.equal(card.title, f.path.stages[0].title);
  assert.equal(JSON.stringify(entry), before);
});

test("a later promotion leaves the original capstone card Epic and earns its separate Legendary card", () => {
  for (const id of ["demetrius", "ptolemy", "zeno"]) {
    const f = fixture(id), capstone = f.capstone(), promotion = f.path.promotion!;
    const success = f.add(promotion.achievementId, promotion.activityId, Math.max(f.start + 6, 46));
    assert.equal(legacyFigureCard(f.entry(capstone), f.world, f.life)!.rank, "Epic");
    const card = legacyFigureCard(f.entry(success), f.world, f.life)!;
    assert.equal(card.rank, "Legendary"); assert.equal(card.title, promotion.title);
  }
});

test("attempts, failed promotions and an incomplete predecessor chain produce no rarity card", () => {
  const f = fixture("demetrius"), promotion = f.path.promotion!; f.capstone();
  const failed = f.add(promotion.achievementId, promotion.activityId, 46, promotion.activityId + "-failed");
  assert.equal(legacyFigureCard(f.entry(failed), f.world, f.life), undefined);
  const attempt = f.add(promotion.attemptAchievementId!, promotion.activityId, 46, promotion.activityId + "-failed");
  assert.equal(legacyFigureCard(f.entry(attempt), f.world, f.life), undefined);
  f.life.accomplishments = f.life.accomplishments!.filter(record => record.achievementId !== f.path.stages[0].achievementId);
  assert.equal(legacyFigureCard(f.entry(f.stages[2]), f.world, f.life), undefined);
});

test("unknown worlds and unrelated or mismatched records keep the ordinary achievement presentation", () => {
  const f = fixture(), entry = f.entry(f.stages[1]);
  assert.equal(legacyFigureCard(entry), undefined);
  for (const change of [{ worldVersion: "older" }, { worldFingerprint: "other" }, { seed: "other" }]) {
    assert.equal(legacyFigureCard({ ...entry, ...change }, f.world, f.life), undefined);
  }
  for (const change of [{ sourceId: "other" }, { outcomeId: "failed" }, { age: 1 }, { routeId: "figure-pytheas" }]) {
    assert.equal(legacyFigureCard({ ...entry, accomplishment: { ...entry.accomplishment, ...change } }, f.world, f.life), undefined);
  }
});

test("collection renders earned cards and inspect controls only for validated figure records", () => {
  const f = fixture(), record = f.entry(f.stages[1]);
  const html = renderToStaticMarkup(createElement(LegacyGallery, { entries: [record], world: f.world, life: f.life }));
  assert.match(html, /data-figure-card="aristotle"/); assert.match(html, /data-rarity="rare"/);
  assert.match(html, /Inspect Aristotle: Rare contribution card/);
  assert.ok(html.includes(f.path.stages[1].title));
  const withoutWorld = renderToStaticMarkup(createElement(LegacyGallery, { entries: [record] }));
  assert.doesNotMatch(withoutWorld, /data-figure-card/); assert.match(withoutWorld, /legacy-card-art/);
});
