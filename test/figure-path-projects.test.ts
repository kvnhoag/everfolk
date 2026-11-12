import assert from "node:assert/strict";
import test from "node:test";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import { deepInventory } from "../src/deep-capabilities/actions.ts";

test("Aristotle's route meets him before 322 BCE and earns a later body-of-inquiry title through real research", () => {
  const run = figureFixture("aristotle-actual-title");
  run.researchFoundation(); assert.equal(run.life.age, 17);
  const path = run.path("aristotle");
  run.advanceTo(18); run.yearly(path.encounter.activityId);
  assert.equal(run.progress("aristotle").encounterMode, "direct");
  const entry = run.progress("aristotle").encounterRecord!;
  assert.ok(entry.year <= -322);
  assert.equal(run.progress("aristotle").specialTitle, null);
  run.researchMastery();
  run.contribute(path);
  assert.equal(run.progress("aristotle").associationRank, "Epic");
  assert.equal(run.progress("aristotle").specialTitle, null, "Disciple status is not the figure-defining capstone.");
  run.completeCapstone(path);
  const progress = run.progress("aristotle");
  assert.equal(progress.specialTitle?.rank, "Legendary");
  assert.equal(progress.specialTitle?.title, path.capstone.title);
  assert.ok(progress.specialTitle!.record.year > -322);
  assert.ok(run.life.deepCapabilities!.evidence.some(receipt => receipt.action === "assess-PS10"));
  run.durable();
});

test("Euclid's route begins with the mature geometrical teaching circle and earns its own demonstration project", () => {
  const run = figureFixture("euclid-actual-title");
  run.researchMastery();
  const path = run.path("euclid");
  const before = JSON.stringify(run.life);
  assert.throws(() => run.act(path.encounter.activityId), /available|require|condition|year|age/i);
  assert.equal(JSON.stringify(run.life), before);
  run.advanceTo(50); run.yearly(path.encounter.activityId);
  assert.equal(run.progress("euclid").encounterMode, "circle");
  assert.ok(run.progress("euclid").encounterRecord!.year >= -300);
  run.contribute(path);
  run.completeCapstone(path);
  const progress = run.progress("euclid");
  assert.equal(progress.specialTitle?.rank, "Legendary");
  assert.equal(progress.associationRank, "Epic");
  assert.ok(progress.specialTitle!.record.age >= 50);
  assert.ok(!/personally met|personal meeting|Euclid welcomes/i.test(path.summary));
  run.durable();
});

test("Lysippos requires a real sculptural mastery and consumes bronze rather than substituting a stone monument", () => {
  const run = figureFixture("lysippos-actual-bronze-title");
  run.sculptureFoundation();
  const path = run.path("lysippos");
  run.advanceTo(Math.max(18, path.encounter.fromYear - run.world.startYear)); run.yearly(path.encounter.activityId);
  assert.equal(run.progress("lysippos").encounterMode, "direct");
  assert.ok(run.progress("lysippos").encounterRecord!.year <= -310);
  run.sculptureMastery();
  assert.ok(run.life.deepCapabilities!.learned.AS10);
  assert.equal(run.progress("lysippos").specialTitle, null);
  assert.ok((deepInventory(run.life).monument ?? 0) > 0, "A completed stone monument exists but cannot replace a bronze commission.");
  const first = path.stages[0];
  run.completeWork(first.workActionId, first.workYears); run.act(first.activityId);
  run.next();
  const beforeMissingBronze = JSON.stringify(run.life);
  assert.throws(() => run.act(run.workActivity(path.stages[1].workActionId).id), /bronze|material|input/i);
  assert.equal(JSON.stringify(run.life), beforeMissingBronze);
  const bronzeStockBefore = run.life.vocations!.stock.bronze;
  const bronzeOwnedBefore = deepInventory(run.life).bronze ?? 0;
  assert.ok(Number.isFinite(bronzeStockBefore), "A finite bronze supplier must be authored.");
  run.contribute(path);
  run.completeCapstone(path);
  const purchased = bronzeStockBefore - run.life.vocations!.stock.bronze;
  const bronzeUsed = bronzeOwnedBefore + purchased - (deepInventory(run.life).bronze ?? 0);
  const required = [
    ...path.stages.map(stage => ({ action: stage.workActionId, count: stage.workYears })),
    ...run.requiredWork(path.capstone.requires),
  ].reduce((total, requirement) => {
    const action = run.world.vocations!.actions[requirement.action] as { inputs?: Record<string, number> };
    return total + (action.inputs?.bronze ?? 0) * requirement.count;
  }, 0);
  assert.ok(required > 0, "Lysippos needs authored bronze work beyond stone capability proofs.");
  assert.equal(bronzeUsed, required);
  assert.equal(run.progress("lysippos").specialTitle?.rank, "Legendary");
  assert.equal(run.progress("lysippos").associationRank, "Epic");
  run.durable();
});

test("Theophrastus requires actual plant-investigation work and remains Epic after his capstone", () => {
  const run = figureFixture("theophrastus-actual-plant-title");
  run.researchFoundation(); run.advanceTo(18);
  const path = run.path("theophrastus");
  run.yearly(path.encounter.activityId);
  run.researchMastery();
  const plantWork = path.stages.map(stage => run.workActivity(stage.workActionId));
  assert.ok(plantWork.some(activity => /plant|botan|leaf|leaves|root|seed/i.test(activity.text)), "The route needs explicit botanical work.");
  run.contribute(path);
  for (const stage of path.stages) assert.equal(run.life.vocations!.completed[stage.workActionId], stage.workYears);
  run.completeCapstone(path);
  const progress = run.progress("theophrastus");
  assert.equal(progress.associationRank, "Epic");
  assert.equal(progress.principalRank, "Epic");
  assert.equal(progress.specialTitle?.rank, "Epic");
  assert.equal(progress.promoted, false);
  run.durable();
});
