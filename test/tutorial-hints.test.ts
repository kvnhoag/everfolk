import assert from "node:assert/strict";
import test from "node:test";
import { SECTION_HELP_HINTS, TUTORIAL_HINTS, isTutorialHintId, tutorialHint } from "../client/models/tutorial-hints.ts";

function sentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

test("hint ids are unique and lookups are safe", () => {
  const ids = TUTORIAL_HINTS.map(hint => hint.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(tutorialHint("time-bar")?.title, "The time bar");
  assert.equal(tutorialHint("no-such-hint"), undefined);
  assert.equal(isTutorialHintId("market"), true);
  assert.equal(isTutorialHintId("finish"), false, "the old linear tour's last step is gone");
  assert.equal(isTutorialHintId(42), false);
});

test("the tutorial covers every section of the game, the Character popup and the Weave screens", () => {
  for (const id of ["welcome", "roll", "time-bar", "rail", "resources", "scene", "focus", "wealth", "yearly-action", "command-deck", "market", "notifications", "decision", "life-record", "skills", "character", "ending", "weave", "nft-market", "figures", "mine"]) {
    assert.ok(tutorialHint(id), `${id} has a hint`);
  }
});

test("copy is short: a title, one to three sentences, and a one-line tooltip", () => {
  for (const hint of TUTORIAL_HINTS) {
    assert.ok(hint.title.length > 0 && hint.title.length <= 40, `${hint.id} title`);
    assert.ok(sentences(hint.body) >= 1 && sentences(hint.body) <= 3, `${hint.id} body has ${sentences(hint.body)} sentences`);
    if (hint.missingBody) assert.ok(sentences(hint.missingBody) <= 3, `${hint.id} missing body`);
    if (hint.help) assert.ok(hint.help.length <= 120 && sentences(hint.help) <= 2, `${hint.id} tooltip is short`);
  }
});

test("every section with a ? button has tooltip text", () => {
  assert.ok(SECTION_HELP_HINTS.length >= 16);
  for (const id of SECTION_HELP_HINTS) assert.ok(tutorialHint(id)?.help, `${id} explains itself in a tooltip`);
});

test("hints that point at something name a selector; the welcome card is centered", () => {
  assert.deepEqual(tutorialHint("welcome")?.targets, []);
  for (const hint of TUTORIAL_HINTS) if (hint.id !== "welcome" && hint.id !== "about") assert.ok(hint.targets.length > 0, `${hint.id} has a target`);
  assert.match(tutorialHint("welcome")!.body, /\?/, "the welcome explains the ? buttons");
});

test("copy matches the game's labels and never asks the player to spend", () => {
  const text = TUTORIAL_HINTS.map(hint => `${hint.title} ${hint.body} ${hint.missingBody ?? ""} ${hint.help ?? ""}`).join(" ");
  for (const label of ["Begin your life", "Begin life", "Next decision", "Auto mode", "Inventory & Granary", "This year's focus", "Market & Trade", "Farm & Granary", "Career & Army", "People & Town", "Works & Stewards", "Open decision", "Life record", "Skill learned", "Skill tree", "Open your pack", "NEAR testnet", "Tutorial button"]) {
    assert.ok(text.includes(label), `mentions ${label}`);
  }
  assert.match(text, /mints nothing/);
  assert.match(tutorialHint("time-bar")!.body, /clock waits while a tip/i, "tips say the clock waits while they are open");
});
