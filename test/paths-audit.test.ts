import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { auditEvents } from "../src/paths/audit.ts";
import type { LifeEvent, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };

const world = shipped as unknown as WorldPack;

const decision = (id: string, extra: Partial<LifeEvent>, effects: LifeEvent["choices"][number]["outcomes"][number]["effects"] = []): LifeEvent => ({
  id, title: id, text: "Something happens.", trigger: { type: "random", weight: 1 }, stages: ["adulthood"],
  choices: [{ id: `${id}-a`, text: "Do it", outcomes: [{ id: `${id}-a-done`, text: "Done.", weight: 1, effects }] }], ...extra,
});

function rules(events: LifeEvent[]): Array<[number, string]> {
  return auditEvents({ ...world, events }).map(item => [item.rule, item.eventId]);
}

test("rule 2: spending shared goods is a household decision, with a household answer for the young", () => {
  const spend = decision("spend", { when: { type: "job", job: "farmhand" } }, [{ type: "cash", delta: -20 }]);
  assert.deepEqual(rules([spend]).filter(([rule]) => rule === 2), [[2, "spend"]]);
  assert.deepEqual(rules([{ ...spend, scope: "household" }]).filter(([rule]) => rule === 2), []);
  const young = { ...spend, scope: "household" as const, stages: ["youth", "adulthood"] };
  assert.deepEqual(rules([young]).filter(([rule]) => rule === 2), [[2, "spend"]]);
  const pocket = decision("pocket", { when: { type: "job", job: "farmhand" } }, [{ type: "cash", delta: -3 }]);
  assert.deepEqual(rules([pocket]).filter(([rule]) => rule === 2), []);
  const grain = decision("grain", { when: { type: "job", job: "farmhand" } }, [{ type: "demo", effect: { kind: "grain", delta: -10, cause: "x" } }]);
  assert.deepEqual(rules([grain]).filter(([rule]) => rule === 2), [[2, "grain"]]);
});

test("rule 3: events that teach a field's skills are tagged with the field", () => {
  const teach = decision("teach", { when: { type: "job", job: "farmhand" } }, [{ type: "skill", skill: "pottery", delta: 2 }]);
  assert.deepEqual(rules([teach]).filter(([rule]) => rule === 3), [[3, "teach"]]);
  assert.deepEqual(rules([{ ...teach, fields: ["ceramics"] }]).filter(([rule]) => rule === 3), []);
});

test("rule 4: adult decisions need a cause beyond age", () => {
  const causeless = decision("causeless", { when: { type: "age", op: "gte", value: 20 } });
  assert.deepEqual(rules([causeless]).filter(([rule]) => rule === 4), [[4, "causeless"]]);
  assert.deepEqual(rules([decision("bare", {})]).filter(([rule]) => rule === 4), [[4, "bare"]]);
  assert.deepEqual(rules([{ ...causeless, when: { type: "all", conditions: [{ type: "age", op: "gte", value: 20 }, { type: "job", job: "farmhand" }] } }]).filter(([rule]) => rule === 4), []);
  assert.deepEqual(rules([{ ...causeless, stages: ["childhood"] }]).filter(([rule]) => rule === 4), [], "only adult decisions");
});

test("rule 5: text that names a spouse needs a relationship condition", () => {
  const wife = { ...decision("wife", { when: { type: "job", job: "farmhand" } }), text: "Your wife asks you to stay home." };
  assert.deepEqual(rules([wife]).filter(([rule]) => rule === 5), [[5, "wife"]]);
  assert.deepEqual(rules([{ ...wife, when: { type: "relationship", status: "married" } }]).filter(([rule]) => rule === 5), []);
});

test("the free-play world has no rule 2 or rule 4 problems left", () => {
  const remaining = auditEvents(world).filter(item => item.rule === 2 || item.rule === 4);
  assert.deepEqual(remaining.map(item => `${item.rule} ${item.eventId}`), []);
});

test("the audit script reports counts and exits cleanly", () => {
  const output = execFileSync("node", ["scripts/events/audit.mjs"], { encoding: "utf8" });
  assert.match(output, /rule 2: 0/);
  assert.match(output, /rule 4: 0/);
  assert.match(output, /rule 3: \d+/);
});
