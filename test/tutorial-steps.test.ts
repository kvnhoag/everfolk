import assert from "node:assert/strict";
import test from "node:test";
import { TUTORIAL_STAGES, TUTORIAL_STEPS, type TutorialStep } from "../client/models/tutorial-steps.ts";
import { parseChainRoute } from "../client/chain/chain-route.ts";
import { CHARACTER_SECTIONS } from "../client/models/character-panel-model.ts";

const ids = TUTORIAL_STEPS.map(step => step.id);

function sentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

test("the tour visits every stage in order: home, new life, game, Web3, finish", () => {
  const stages = TUTORIAL_STEPS.map(step => step.stage).filter((stage, index, all) => stage !== all[index - 1]);
  assert.deepEqual(stages, ["home", "new-life", "game", "web3", "finish"]);
  assert.deepEqual(TUTORIAL_STAGES, ["home", "new-life", "game", "web3", "finish"]);
});

test("the tour covers each listed feature in the listed order", () => {
  assert.deepEqual(ids, [
    "welcome", "begin", "weave-cta", "header",
    "roll", "begin-life",
    "time-bar", "rail", "resources", "character", "focus", "wealth", "yearly-action", "command-deck", "notifications", "decision", "life-record", "skills", "character-tabs", "ending",
    "weave", "market", "figures", "mine",
    "finish",
  ]);
  assert.equal(new Set(ids).size, ids.length, "step ids are unique");
});

test("steps navigate: chain steps use valid hash routes in the header's order", () => {
  const chain = TUTORIAL_STEPS.flatMap(step => step.screen.kind === "chain" ? [step.screen.hash] : []);
  assert.deepEqual(chain, ["#weave", "#market", "#figures", "#mine"]);
  for (const hash of chain) assert.ok(parseChainRoute(hash), `${hash} is a chain route`);
});

test("steps declare the screen they need, and Character steps open real sections", () => {
  const byId = (id: string) => TUTORIAL_STEPS.find(step => step.id === id) as TutorialStep;
  assert.equal(byId("welcome").screen.kind, "home");
  assert.equal(byId("roll").screen.kind, "new-life");
  assert.equal(byId("time-bar").screen.kind, "game");
  assert.deepEqual(byId("skills").screen, { kind: "character", section: "skills" });
  assert.equal(byId("finish").screen.kind, "game");
  const sections = new Set(CHARACTER_SECTIONS.map(section => section.id));
  for (const step of TUTORIAL_STEPS) if (step.screen.kind === "character") assert.ok(sections.has(step.screen.section), step.id);
});

test("copy is short: a title and one to three sentences per step", () => {
  for (const step of TUTORIAL_STEPS) {
    assert.ok(step.title.length > 0 && step.title.length <= 40, `${step.id} title`);
    assert.ok(sentences(step.body) >= 1 && sentences(step.body) <= 3, `${step.id} body has ${sentences(step.body)} sentences`);
    if (step.missingBody) assert.ok(sentences(step.missingBody) <= 3, `${step.id} missing body`);
  }
});

test("the welcome card is centered and features that come later explain themselves when absent", () => {
  assert.equal(TUTORIAL_STEPS[0].targets.length, 0);
  for (const id of ["roll", "begin-life", "focus", "yearly-action", "notifications", "ending"]) {
    const step = TUTORIAL_STEPS.find(item => item.id === id)!;
    assert.ok(step.targets.length > 0, `${id} points at a target when it exists`);
    assert.ok(step.missingBody, `${id} explains itself when its target is absent`);
  }
  assert.match(TUTORIAL_STEPS.find(step => step.id === "yearly-action")!.missingBody!, /age 6/);
  assert.match(TUTORIAL_STEPS.find(step => step.id === "command-deck")!.body, /age 10/);
});

test("copy matches the game's labels and never asks the player to spend", () => {
  const text = TUTORIAL_STEPS.map(step => `${step.title} ${step.body} ${step.missingBody ?? ""}`).join(" ");
  for (const label of ["Begin your life", "Continue your life", "Begin life", "Next decision", "Auto mode", "Inventory & Granary", "This year's focus", "Market & Trade", "Farm & Granary", "Career & Army", "People & Town", "Works & Stewards", "Open decision", "Life record", "Skill learned", "Open your pack", "You could have gotten", "NEAR testnet"]) {
    assert.ok(text.includes(label), `mentions ${label}`);
  }
  assert.match(TUTORIAL_STEPS.at(-1)!.title, /You're ready/);
  assert.match(text, /mints nothing/);
});
