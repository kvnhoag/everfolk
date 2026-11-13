import assert from "node:assert/strict";
import test from "node:test";
import { FIGURE_ROSTER, figureRosterEntry } from "../chain/catalog/figure-roster.ts";
import { buildFigureCardRequirements, changedRequirementIds } from "../client/models/figure-card-requirements.ts";
import { getFigureCardProgress } from "../src/figures/card-progress.ts";
import { createEngine } from "../src/engine.ts";
import type { FigureCardRank } from "../chain/catalog/figure-roster.ts";
import type { AccomplishmentRecord, WorldPack } from "../src/types.ts";
import { yearAtAge } from "../src/calendar.ts";
import current from "../worlds/demo/alexandria-lives-7-wsl-contributions.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
const world = current as unknown as WorldPack;
const figure = (id: string) => figureRosterEntry(id)!;
const principal = (id: string, rank: FigureCardRank, pack = world) => buildFigureCardRequirements({ figure: figure(id), rank, mode: "principal", world: pack });
const text = (rows: ReturnType<typeof principal>) => rows.map(row => `${row.label} ${row.detail ?? ""}`).join("\n");

test("every principal variant has a distinct figure-specific unlock line and full capstone conditions", () => {
  const summary = new Set<string>();
  for (const entry of FIGURE_ROSTER) {
    for (const variant of entry.variants) {
      const rows = principal(entry.id, variant.rank);
      assert.equal(rows[0].id, "unlock");
      assert.match(rows[0].label, /Complete the contribution ladder/);
      assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
      assert.ok(rows.some(row => row.id.startsWith("work:")), entry.id);
      assert.ok(rows.some(row => row.id === "capstone:accepted"), entry.id);
      assert.doesNotMatch(text(rows), /Meet the authored/);
    }
    summary.add(principal(entry.id, entry.baseRank)[0].label);
  }
  assert.equal(summary.size, FIGURE_ROSTER.length);
});

test("Ptolemy Legendary spells out dynasty founding, funded work, dates, direct contact and successful one-shot outcome", () => {
  const rows = principal("ptolemy", "Legendary"), content = text(rows);
  assert.equal(rows.find(row => row.id === "promotion:milestone")?.label, "Found the Ptolemaic dynasty");
  assert.match(content, /independent hereditary government and a working succession settlement/);
  assert.match(content, /Reckoning at least 72/);
  assert.match(content, /Oratory at least 56/);
  assert.match(content, /Complete 1 qualifying work year/);
  assert.match(content, /120 dr fee; consumes 4 papyrus, 3 ink/);
  assert.match(content, /305 BCE or later/);
  assert.match(content, /304 BCE or earlier/);
  assert.ok(rows.some(row => row.id === "achievement:fig-ptolemy-encounter"));
  assert.ok(!rows.some(row => row.id.startsWith("any:") && row.id.includes("fig-ptolemy-encounter") && !principal("ptolemy", "Epic").some(base => base.id === row.id)), "promotion must not offer later tradition as an alternative to direct contact");
  assert.match(content, /No previous attempt: Dynastic founding resolved/);
  assert.match(content, /Record the successful Legendary outcome/);
});

test("conditional figures keep base requirements shared and mark only additional Legendary requirements", () => {
  for (const id of ["demetrius", "ptolemy", "zeno"]) {
    const base = principal(id, "Epic"), higher = principal(id, "Legendary");
    const changed = changedRequirementIds(base, higher);
    assert.ok(changed.includes("promotion:milestone"));
    assert.ok(changed.includes("promotion:accepted"));
    for (const row of base) {
      const selected = higher.find(item => item.id === row.id)!;
      assert.equal(changed.includes(row.id), selected.label !== row.label || selected.detail !== row.detail);
    }
    if (id === "zeno") assert.ok(changed.includes("skill:philosophy:gte"));
    else assert.deepEqual(changedRequirementIds(higher, base), []);
  }
  assert.match(text(principal("demetrius", "Legendary")), /alternate-history capture must succeed/);
  const zeno = text(principal("zeno", "Legendary"));
  assert.match(zeno, /Complete 3 qualifying work years/);
  assert.match(zeno, /Philosophy at least 80/);
  assert.match(zeno, /Oratory at least 64/);
  assert.match(zeno, /working Legendary criterion/);
});

test("every authored contribution grade includes its exact project and prerequisites, including retained worlds", () => {
  for (const pack of [world, retained as unknown as WorldPack]) {
    for (const path of pack.figurePaths!) {
      for (const stage of [...path.stages, ...(path.legendaryContribution ? [path.legendaryContribution] : [])]) {
        const rows = buildFigureCardRequirements({ figure: figure(path.id), mode: "contribution", rank: stage.rank, world: pack });
        assert.ok(rows[0].label.includes(stage.title));
        assert.equal(rows[0].detail, stage.description);
        assert.ok(rows.some(row => row.id === "contribution:accepted"));
        if ("workYears" in stage) assert.match(text(rows), new RegExp(`Complete ${stage.workYears} qualifying work year`));
        assert.doesNotMatch(text(rows), /Meet the authored/);
      }
    }
  }
});

test("requirements do not disappear merely because skills are met or a card is recorded", () => {
  const life = structuredClone(createEngine(world).start("requirement-stability"));
  const before = buildFigureCardRequirements({ figure: figure("ptolemy"), mode: "principal", rank: "Legendary", world, progress: getFigureCardProgress(world, life, "ptolemy") });
  for (const skill of Object.keys(life.character!.skills)) life.character!.skills[skill] = 100;
  const after = buildFigureCardRequirements({ figure: figure("ptolemy"), mode: "principal", rank: "Legendary", world, progress: getFigureCardProgress(world, life, "ptolemy") });
  assert.deepEqual(after, before);
  assert.deepEqual(changedRequirementIds(before, after), []);
});

test("comparison identifies changed thresholds and added requirements without depending on row order", () => {
  const before = [{ id: "skill", label: "Oratory at least 24" }, { id: "shared", label: "Age at least 18", detail: "Unchanged" }];
  const after = [{ id: "shared", label: "Age at least 18", detail: "Unchanged" }, { id: "skill", label: "Oratory at least 48" }, { id: "work", label: "Complete two years" }];
  assert.deepEqual(changedRequirementIds(before, after), ["skill", "work"]);
  assert.deepEqual(changedRequirementIds(after, [{ id: "shared", label: "Age at least 18", detail: "Revised" }]), ["shared"]);
});

test("catalogue fallbacks give every legal principal and ordinary contribution grade an unlock line", () => {
  for (const entry of FIGURE_ROSTER) {
    for (const variant of entry.variants) {
      const rows = buildFigureCardRequirements({ figure: entry, mode: "principal", rank: variant.rank });
      assert.ok(rows[0].label.length > 35);
      if (variant.requiredMilestone) assert.ok(rows.some(row => row.id === "promotion:milestone"));
    }
    for (const rank of entry.baseRank === "Epic" ? ["Common", "Uncommon", "Rare"] as const : ["Common", "Uncommon", "Rare", "Epic"] as const) {
      assert.equal(buildFigureCardRequirements({ figure: entry, mode: "contribution", rank })[0].id, "unlock");
    }
  }
});

// A work activity can be less demanding than the accepted title; the stricter gate survives.
test("semantic comparison preserves the strongest repeated skill gate across work and promotion", () => {
  const pack = structuredClone(world);
  const path = pack.figurePaths!.find(item => item.id === "zeno")!;
  const work = pack.character!.activities.find(item => item.id === "v-fig-zeno-capstone-work")!;
  work.when = { type: "all", conditions: [{ type: "skill", skill: "philosophy", op: "gte", value: 12 }] };
  const rows = principal("zeno", "Legendary", pack);
  assert.equal(rows.filter(row => row.id === "skill:philosophy:gte").length, 1);
  assert.equal(rows.find(row => row.id === "skill:philosophy:gte")?.label, "Philosophy at least 80");
  const epic = principal("zeno", "Epic", pack);
  assert.equal(epic.find(row => row.id === "skill:philosophy:gte")?.label, "Philosophy at least 72");
  assert.ok(changedRequirementIds(epic, rows).includes("skill:philosophy:gte"));
  assert.ok(path.promotion);
});


test("catalogue checklists have no claimed completion state", () => {
  for (const entry of FIGURE_ROSTER) {
    for (const variant of entry.variants) assert.ok(principal(entry.id, variant.rank).every(row => row.met === undefined));
  }
});

test("checkboxes track the strongest live gates while score and flag changes cannot check accepted outcomes", () => {
  const life = structuredClone(createEngine(world).start("requirement-checkbox-gates"));
  life.age = 90; life.year = yearAtAge(life.birthYear ?? world.startYear, life.age);
  life.character!.skills.philosophy = 79;
  life.flags["stoic-school-established"] = true;
  const build = () => buildFigureCardRequirements({ figure: figure("zeno"), mode: "principal", rank: "Legendary", world, life });
  const before = build();
  assert.equal(before.find(row => row.id === "skill:philosophy:gte")?.met, false);
  assert.equal(before.find(row => row.id === "age")?.met, true);
  assert.equal(before.find(row => row.id === "work:fig-zeno-capstone-work")?.met, false);
  for (const id of ["unlock", "capstone:accepted", "promotion:milestone", "promotion:accepted"]) assert.equal(before.find(row => row.id === id)?.met, false);
  life.character!.skills.philosophy = 80;
  const after = build();
  assert.equal(after.find(row => row.id === "skill:philosophy:gte")?.met, true);
  assert.equal(after.find(row => row.id === "promotion:milestone")?.met, false);
  assert.deepEqual(changedRequirementIds(before, after), [], "completion changes never masquerade as rarity requirement changes");
});

test("accepted outcome checkboxes require the figure's verified chronological records", () => {
  const life = structuredClone(createEngine(world).start("requirement-checkbox-records"));
  life.birthYear = world.startYear; life.age = 90; life.year = yearAtAge(world.startYear, 90); life.phase = "ready"; life.accomplishments = [];
  const path = world.figurePaths!.find(item => item.id === "ptolemy")!;
  function award(achievementId: string, sourceId: string, age: number) {
    const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
    const activity = world.character!.activities.find(item => item.id === sourceId)!;
    const outcome = activity.outcomes.find(item => item.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!;
    const record: AccomplishmentRecord = { id: `${achievementId}:${age}`, achievementId, routeId: definition.routeId, title: definition.title, description: definition.description, name: definition.nameTemplate, kind: definition.kind, people: [], age, year: yearAtAge(world.startYear, age), sourceId, outcomeId: outcome.id };
    life.accomplishments!.push(record);
    return record;
  }
  const build = () => buildFigureCardRequirements({ figure: figure("ptolemy"), mode: "principal", rank: "Legendary", world, life });
  award(path.encounter.achievementId, path.encounter.activityId, 27);
  for (const [index, stage] of path.stages.entries()) award(stage.achievementId, stage.activityId, [28, 30, 33][index]);
  award(path.capstone.achievementId, path.capstone.activityId, 35);
  let rows = build();
  assert.equal(rows.find(row => row.id === "unlock")?.met, true);
  assert.equal(rows.find(row => row.id === "capstone:accepted")?.met, true);
  assert.equal(rows.find(row => row.id === "promotion:milestone")?.met, false);
  const record = award(path.promotion!.achievementId, path.promotion!.activityId, 46);
  rows = build();
  assert.equal(rows.find(row => row.id === "promotion:milestone")?.met, true);
  assert.equal(rows.find(row => row.id === "promotion:accepted")?.met, true);
  const contribution = buildFigureCardRequirements({ figure: figure("ptolemy"), mode: "contribution", rank: "Common", world, life });
  assert.equal(contribution.find(row => row.id === "unlock")?.met, true);
  assert.equal(contribution.find(row => row.id === "contribution:accepted")?.met, true);
  record.sourceId = "unrelated-activity";
  assert.equal(build().find(row => row.id === "promotion:milestone")?.met, false);
});
