import { test } from "node:test";
import assert from "node:assert/strict";
import { deathEndingFor } from "../src/life-stages/index.ts";
import type { WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const world = shipped as unknown as WorldPack, old = retained as unknown as WorldPack;

test("a death is named by the life stage it happens in", () => {
  assert.equal(deathEndingFor(world, 0), "death-in-infancy");
  assert.equal(deathEndingFor(world, 15), "death-in-childhood", "15 is youth, not adulthood");
  assert.equal(deathEndingFor(world, 16), "death-in-adulthood");
  assert.equal(deathEndingFor(world, 60), "death-in-later-life");
});

test("worlds without life stages keep their age thresholds", () => {
  assert.equal(deathEndingFor(old, 15), "death-in-adulthood");
  assert.equal(deathEndingFor(old, 14), "death-in-childhood");
});

test("newcomers born near Rhakotis live in the city quarter, not a Delta village", async () => {
  const { districtOf } = await import("../src/paths/index.ts");
  assert.equal(districtOf(world, "delta-newcomers"), "city-quarter");
  assert.equal(districtOf(world, "tenant-farming-household"), "delta-village");
});

test("a meeting uses the right article: an official, a weaver", async () => {
  const { meetPractitioner } = await import("../src/paths/index.ts");
  const { createEngine } = await import("../src/index.ts");
  const life = structuredClone(createEngine(world).start("articles"));
  life.age = 20;
  life.paths!.people = { ...life.paths!.people, civic: [0, 3, 0, 0], clothing: [0, 3, 0, 0] };
  assert.match(meetPractitioner(world, life, "civic", "adult").text, /, an official\b/);
  assert.match(meetPractitioner(world, life, "clothing", "adult").text, /, a weaver\b/);
});

test("cutting rations in a failed flood is offered only when the store is short, and says what it costs", () => {
  const choice = world.events.find(event => event.id === "flood-failure")!.choices.find(item => item.id === "flood-ration-keep-seed")!;
  assert.deepEqual(choice.when, { type: "demo", condition: { kind: "item", item: "grain", op: "lte", value: 1000 } });
  assert.match(choice.outcomes[0].text, /hungry/i);
  assert.doesNotMatch(choice.outcomes[0].text, /eats less/);
});

test("a flax harvest pays its rent in flax in the new world; older worlds keep grain-only rent", async () => {
  const { demoContext } = await import("../src/demo/state.ts");
  const { harvest, payRent } = await import("../src/demo/household.ts");
  const { createEngine } = await import("../src/index.ts");
  const rentFor = (pack: WorldPack) => {
    const life = structuredClone(createEngine(pack).start("flax-rent")) as any;
    life.age = 25; life.character.jobId = "tenant-farmer";
    life.demo.household.flaxPlots = life.demo.household.plots;
    life.vocations.inventory["flax-seed"] = 100;
    life.vocations.lots.push({ item: "flax-seed", quality: 1, quantity: 100 });
    life.demo.household.grain = 500;
    const lines: string[] = [];
    const ctx = demoContext(pack, life, () => {}, (_id: string, text: string) => lines.push(text));
    harvest(ctx);
    const flax = life.demo.household.flax;
    payRent(ctx);
    return { paid: flax - life.demo.household.flax, lines };
  };
  const fresh = rentFor(world);
  assert.ok(fresh.paid > 0, "flax rent is paid");
  assert.ok(fresh.lines.some(line => /bundles of flax to the landowner/.test(line)), fresh.lines.join(" | "));
  const without = structuredClone(world);
  delete (without.demo!.household as { rentOnFlax?: boolean }).rentOnFlax;
  assert.equal(rentFor(without).paid, 0, "without the rule, flax pays no rent (older worlds)");
});

test("people met carry names of their time: Egyptian before Alexandria, no Ptolemaic court names before 305 BCE", async () => {
  const { meetPractitioner } = await import("../src/paths/index.ts");
  const { createEngine } = await import("../src/index.ts");
  const pools = world.character!.identity!.namePools!;
  const egyptian = new Set(["Horus", "Imouthes", "Pachrates", "Panebchounis", "Petosiris", "Psenamounis", "Psais", "Tesenouphis", "Thermuthis", "Taesis", "Tanouphis", "Senamounis", "Taphis"]);
  const dynastic = /^(Ptolemaios|Soter|Berenike|Ptolemais|Sarapion|Kleopatra)\b/;
  const namesAt = (year: number) => {
    const life = structuredClone(createEngine(world).start("names"));
    life.year = year; life.age = 20;
    life.paths!.people = { ...life.paths!.people, farming: [0, 9, 0, 0] };
    return Array.from({ length: 40 }, () => meetPractitioner(world, life, "farming", "adult").text.split(",")[0].split(" ").at(-1)!);
  };
  for (const name of namesAt(-340)) assert.ok(egyptian.has(name), `${name} in 340 BCE`);
  for (const name of namesAt(-320)) assert.doesNotMatch(name, dynastic, `${name} in 320 BCE`);
  assert.ok(namesAt(-280).some(name => !egyptian.has(name)), "Greek names appear after the founding");
  assert.ok([...pools.male, ...pools.female].length > 0);
});

test("fading knowledge is mentioned every five years, not every year, in the new world", async () => {
  const { progressKnowledge } = await import("../src/knowledge.ts");
  const { createEngine } = await import("../src/index.ts");
  const lines = (pack: WorldPack) => {
    const life = structuredClone(createEngine(pack).start("knowledge-lines")) as any;
    const seen: string[] = [];
    for (let age = 40; age < 50; age++) { life.age = age; life.stats.knowledge = 60; progressKnowledge(pack, life, (id: string) => seen.push(id)); }
    return seen.filter(id => id.startsWith("knowledge-")).length;
  };
  assert.ok(lines(world) <= 2, `${lines(world)} lines in ten years`);
  assert.ok(lines(old) >= 8, "older worlds keep their yearly line");
});

test("meeting strangers on errands is an ordinary story, not a near-yearly prompt", () => {
  for (const event of world.events.filter(item => item.id.startsWith("meet-person-"))) {
    assert.equal(event.trigger.type === "random" ? event.trigger.weight : 0, 1, event.id);
  }
});
