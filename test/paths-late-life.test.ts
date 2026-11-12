import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/index.ts";
import { matchesCondition } from "../src/conditions.ts";
import { auditEvents } from "../src/paths/audit.ts";
import { recordStage } from "../src/paths/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { Condition, Effect, LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import lives3 from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const byId = new Map(world.events.map(event => [event.id, event]));
const PREFIXES = ["FC", "FR", "AT", "AC", "AS", "PS", "PP", "T", "M"] as const;
const KINDS = ["commission", "students", "office", "successor"] as const;
const ERA = ["era-museum-scholar", "era-museum-steward", "era-library-copyists", "era-cleruch-serving", "era-cleruch-veteran",
  "era-royal-land-lease", "era-royal-rent-due", "era-temple-land-lease", "era-royal-linen", "era-royal-oil", "era-pharos-stone", "era-royal-licence-trade"];
const LATE = PREFIXES.flatMap(prefix => KINDS.map(kind => `late-${kind}-${prefix.toLowerCase()}`));
const ALL = [...LATE, ...ERA];

const effectsOf = (event: LifeEvent): Effect[] => event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects));
const flatten = (condition: Condition | undefined): Condition[] => !condition ? [] :
  condition.type === "all" || condition.type === "any" ? [condition, ...condition.conditions.flatMap(flatten)] :
  condition.type === "not" ? [condition, ...flatten(condition.condition)] : [condition];
const payments = (event: LifeEvent) => effectsOf(event).filter((effect): effect is Extract<Effect, { type: "account-pay" }> => effect.type === "account-pay");

/** An adult in the home district: given nodes learned, in a year, at a moment when the event could happen. */
function master(nodes: string[], year: number, seed = "late-life"): LifeState {
  const life = structuredClone(engine.start(seed)) as LifeState;
  life.age = 50;
  life.year = year;
  for (const node of nodes) life.capabilities!.learned[node] = { age: 45, year: year - 5 };
  return life;
}
const money = (life: LifeState): number => life.economy!.cash + life.vocations!.accounts.workshop + life.vocations!.accounts.merchant +
  life.vocations!.accounts.school + life.vocations!.accounts.council + life.demo!.town.army.purse;
const choose = (life: LifeState, id: string, choice: string): LifeState => {
  const next = structuredClone(life) as LifeState;
  next.phase = "choice"; next.pendingEventId = id;
  return engine.choose(next, `${id}-${choice}`);
};
const unlocks = (event: LifeEvent): string[] => flatten(event.when).filter(item => item.type === "capability").map(item => item.type === "capability" ? item.node : "");

test("every late-life and era event exists, tagged with its fields and stages", () => {
  for (const id of ALL) {
    const event = byId.get(id);
    assert.ok(event, id);
    assert.ok(event.fields?.length, `${id} has fields`);
    assert.ok(event.stages?.length && event.stages.every(stage => ["adulthood", "later-life"].includes(stage)), `${id} stages`);
    assert.ok(event.when, `${id} has a cause`);
  }
});

test("late-life events are absent from retained worlds", () => {
  const retained = new Set((lives3 as unknown as WorldPack).events.map(event => event.id));
  for (const id of ALL) assert.ok(!retained.has(id), id);
});

test("the events pass audit rules 2 to 5 and never repeat absurdly", () => {
  const ids = new Set(ALL);
  assert.deepEqual(auditEvents(world).filter(item => ids.has(item.eventId)), []);
  for (const id of ALL) {
    const event = byId.get(id)!;
    if (event.trigger.type === "age") continue;
    assert.ok((event.maxOccurrences ?? 1) <= 4, `${id} max`);
    if ((event.maxOccurrences ?? 1) > 1) assert.ok((event.cooldownYears ?? 1) >= 3, `${id} cooldown`);
  }
});

test("a master's work is offered only after depth 10 of its specialization", () => {
  for (const prefix of PREFIXES) for (const kind of KINDS) {
    const event = byId.get(`late-${kind}-${prefix.toLowerCase()}`)!;
    assert.ok(unlocks(event).includes(`${prefix}10`), `${event.id} is gated by ${prefix}10`);
  }
});

test("every payment names an account the offer's own condition checks, so an unfunded offer does not appear", () => {
  let paying = 0;
  for (const id of ALL) {
    const event = byId.get(id)!;
    for (const pay of payments(event)) {
      paying += 1;
      const guard = flatten(event.when).find(item => item.type === "account" && item.account === pay.account);
      assert.ok(guard && guard.type === "account" && ["gte", "gt"].includes(guard.op) && guard.value >= pay.amount, `${id} checks ${pay.account} >= ${pay.amount}`);
    }
    assert.ok(!effectsOf(event).some(effect => effect.type === "cash" && effect.delta > 0), `${id} creates no cash`);
  }
  assert.ok(paying >= 20, `${paying} paying outcomes`);
});

test("a commission pays from its account and conserves money; an empty account hides the offer", () => {
  const event = byId.get("late-commission-ac")!;
  const pay = payments(event)[0];
  const life = master(["AC10"], -300);
  life.vocations!.accounts[pay.account as "workshop"] = 5000;
  assert.equal(matchesCondition(event.when, life), true);
  const before = money(life), cash = life.economy!.cash, account = life.vocations!.accounts.workshop;
  const after = choose(life, event.id, event.choices[0].id.slice(event.id.length + 1));
  assert.equal(after.economy!.cash, cash + pay.amount);
  assert.equal(after.vocations!.accounts.workshop, account - pay.amount);
  assert.equal(money(after), before);
  life.vocations!.accounts.workshop = pay.amount - 1;
  assert.equal(matchesCondition(event.when, life), false, "unfunded");
  assert.equal(matchesCondition(event.when, master([], -300)), false, "without depth 10");
});

test("an account drained between offer and answer pays nothing and creates nothing", () => {
  const event = byId.get("late-commission-ac")!;
  const life = master(["AC10"], -300);
  life.vocations!.accounts.workshop = 3;
  const before = money(life);
  const after = choose(life, event.id, event.choices[0].id.slice(event.id.length + 1));
  assert.equal(money(after), before);
  assert.equal(after.vocations!.accounts.workshop, 3);
});

test("a soldier's commission is paid from the army purse", () => {
  const event = byId.get("late-commission-m")!;
  assert.equal(payments(event)[0].account, "army");
  const life = master(["M10"], -300);
  const purse = life.demo!.town.army.purse, pay = payments(event)[0].amount;
  assert.equal(matchesCondition(event.when, life), true);
  const before = money(life);
  const after = choose(life, event.id, event.choices[0].id.slice(event.id.length + 1));
  assert.equal(after.demo!.town.army.purse, purse - pay);
  assert.equal(money(after), before);
});

test("the Museum and Library era events open about 290 BCE and close by 275 BCE", () => {
  const scholar = byId.get("era-museum-scholar")!, steward = byId.get("era-museum-steward")!, copyists = byId.get("era-library-copyists")!;
  const at = (event: LifeEvent, nodes: string[], year: number): boolean => matchesCondition(event.when, master(nodes, year));
  for (const [event, nodes] of [[scholar, ["PS8"]], [steward, ["PP8"]], [copyists, ["PS5"]]] as const) {
    assert.equal(at(event, [...nodes], -310), false, `${event.id} before the founding`);
    assert.equal(at(event, [...nodes], -295), false, `${event.id} 295`);
    assert.equal(at(event, [...nodes], -283), true, `${event.id} 283`);
    assert.equal(at(event, [...nodes], -240), false, `${event.id} long after`);
    assert.equal(at(event, [], -283), false, `${event.id} without the work behind it`);
  }
  assert.ok(effectsOf(scholar).some(effect => effect.type === "account-pay" && effect.account === "council"), "paid from the council account");
});

test("the scholar recognition no longer names Alexandria's learned house before it exists", () => {
  const text = byId.get("milestone-ps10")!.text;
  assert.doesNotMatch(text, /Museum|Library|Alexandria/);
  for (const prefix of PREFIXES) assert.doesNotMatch(byId.get(`milestone-${prefix.toLowerCase()}10`)!.text, /Museum|Library/);
});

test("a cleruch allotment is a household plot, only for serving or veteran soldiers, from 305 BCE", () => {
  const serving = byId.get("era-cleruch-serving")!, veteran = byId.get("era-cleruch-veteran")!;
  const soldier = (year: number): LifeState => { const life = master([], year); life.character!.jobId = "soldier"; return life; };
  assert.equal(matchesCondition(serving.when, soldier(-320)), false, "before cleruchs");
  assert.equal(matchesCondition(serving.when, soldier(-300)), true);
  assert.equal(matchesCondition(serving.when, master([], -300)), false, "not a soldier");
  const old = master([], -290); old.flags["army-service"] = true;
  assert.equal(matchesCondition(veteran.when, old), true, "a veteran");
  assert.equal(matchesCondition(veteran.when, master([], -290)), false, "never served");
  const life = soldier(-300), cash = life.economy!.cash, grain = life.demo!.household.grain, plots = life.demo!.household.plots;
  const after = choose(life, serving.id, serving.choices[0].id.slice(serving.id.length + 1));
  assert.equal(after.demo!.household.plots, plots + 1);
  assert.equal(after.economy!.cash, cash);
  assert.equal(after.demo!.household.grain, grain);
  assert.equal(matchesCondition(veteran.when, { ...after, character: { ...after.character!, jobId: null }, flags: { ...after.flags, "army-service": true } }), false, "one allotment per household");
  assert.ok(!effectsOf(serving).some(effect => effect.type === "cash" || effect.type === "account-pay"));
});

test("a royal lease adds a plot and its rent moves grain to the crown granary, never out of nowhere", () => {
  const lease = byId.get("era-royal-land-lease")!, due = byId.get("era-royal-rent-due")!;
  const life = master(["FC5"], -295); life.paths!.affinity.farming = 40; life.demo!.household.grain = 600; life.demo!.household.headSinceAge = 20;
  assert.equal(matchesCondition(lease.when, life), true);
  const early = structuredClone(life) as LifeState; early.year = -320;
  assert.equal(matchesCondition(lease.when, early), false, "before the lease system");
  const grain = (state: LifeState): number => state.demo!.household.grain + state.demo!.town.army.grain;
  const before = grain(life), plots = life.demo!.household.plots;
  const leased = choose(life, lease.id, lease.choices[0].id.slice(lease.id.length + 1));
  assert.equal(leased.demo!.household.plots, plots + 1);
  assert.equal(grain(leased), before);
  assert.ok(leased.demo!.town.army.grain > life.demo!.town.army.grain);
  assert.equal(matchesCondition(due.when, life), false, "no rent before a lease");
  assert.equal(matchesCondition(due.when, leased), true, "rent follows the lease");
  const paid = choose(leased, due.id, due.choices[0].id.slice(due.id.length + 1));
  assert.equal(grain(paid), grain(leased));
});

test("royal monopolies on linen and oil open under the second Ptolemy, about 285 BCE", () => {
  for (const [id, node] of [["era-royal-linen", "AT5"], ["era-royal-oil", "AC5"], ["era-royal-licence-trade", "T5"]] as const) {
    const event = byId.get(id)!;
    assert.equal(matchesCondition(event.when, master([node], -300)), false, `${id} before`);
    assert.equal(matchesCondition(event.when, master([node], -280)), true, `${id} after`);
    assert.equal(matchesCondition(event.when, master([], -280)), false, `${id} without the craft`);
  }
});

test("passing on the craft is recorded in the stage record, and only then", () => {
  const event = byId.get("late-successor-ac")!;
  const life = master(["AC10"], -300);
  life.character!.jobId = "master-potter";
  const plain = recordStage(world, life, "adulthood", 16, 50);
  assert.ok(!("successors" in plain), "the stage-record shape is unchanged without a successor");
  const taught = choose(life, event.id, "apprentice");
  assert.equal(taught.paths!.successors!.length, 1);
  assert.equal(taught.paths!.successors![0].field, "ceramics");
  assert.equal(taught.paths!.successors![0].relation, "apprentice");
  assert.ok(taught.flags["passed-on-ceramics"]);
  assert.match(taught.journal.find(entry => entry.id === "paths-successor-ceramics")?.text ?? "", /successor/i);
  const record = recordStage(world, taught, "adulthood", 16, 59);
  assert.equal(record.successors!.length, 1);
  assert.match(record.successors![0], /apprentice/);
  assert.equal(matchesCondition(event.when, taught), false, "offered no more once someone carries the craft on");
});

test("a child can be trained as successor, by name, only when there is a child of the right age", () => {
  const event = byId.get("late-successor-pp")!;
  const life = master(["PP10"], -300);
  const child = event.choices.find(choice => choice.id.endsWith("-child"))!;
  assert.ok(child.when, "the child choice needs a child");
  assert.equal(matchesCondition(child.when, life), false);
  life.character!.children.push({ id: "child-1", name: "Eudoros", birthAge: 30, otherParentId: "x" });
  assert.equal(matchesCondition(child.when, life), true);
  const taught = choose(life, event.id, "child");
  assert.match(taught.paths!.successors![0].name, /Eudoros/);
  assert.equal(taught.paths!.successors![0].relation, "child");
});

test("the successor record is plain data that survives a JSON round trip", () => {
  const life = choose(master(["AC10"], -300), "late-successor-ac", "apprentice");
  assert.deepEqual(JSON.parse(JSON.stringify(life.paths)), life.paths);
  assert.deepEqual(JSON.parse(JSON.stringify(recordStage(world, life, "adulthood", 16, 59))), recordStage(world, life, "adulthood", 16, 59));
});

test("the validator rejects malformed late-life rules", () => {
  const bad = (change: (event: LifeEvent) => void): void => {
    const copy = structuredClone(world) as WorldPack;
    change(copy.events.find(event => event.id === "late-commission-ac")!);
    assert.throws(() => validateWorld(copy));
  };
  bad(event => { event.choices[0].outcomes[0].effects.push({ type: "account-pay", account: "treasury", amount: 5, cause: "x" } as unknown as Effect); });
  bad(event => { event.choices[0].outcomes[0].effects.push({ type: "account-pay", account: "workshop", amount: 0, cause: "x" } as unknown as Effect); });
  bad(event => { event.choices[0].outcomes[0].effects.push({ type: "successor", field: "farming", relation: "cousin", cause: "x" } as unknown as Effect); });
  bad(event => { event.when = { type: "account", account: "workshop", op: "gte", value: -1 } as Condition; });
  assert.doesNotThrow(() => validateWorld(structuredClone(world) as WorldPack));
});

/** Plays on from a master's life (first choice each time), noting each late-life or era decision as it is offered. */
function lateOffers(life: LifeState, years: number): Array<{ id: string; age: number }> {
  const seen: Array<{ id: string; age: number }> = [], until = life.age + years;
  for (let guard = 0; life.phase !== "ended" && life.age < until && guard < 400; guard++) {
    if (life.phase === "choice") {
      if (/^(late|era)-/.test(life.pendingEventId!)) seen.push({ id: life.pendingEventId!, age: life.age });
      const decline = engine.getChoices(life).find(choice => choice.id.endsWith("-decline") || choice.id.endsWith("-keep")) ?? engine.getChoices(life)[0];
      life = engine.choose(life, decline.id);
    } else life = engine.advance(life);
  }
  return seen;
}

test("in play a master is offered funded work soon after depth 10, and again only after the cooldown", () => {
  let offered = 0;
  for (let i = 0; i < 8; i++) {
    const life = master(["PS10"], -304, `play-${i}`);
    life.age = 46; life.stats.health = 95;
    const commissions = lateOffers(life, 14).filter(offer => offer.id === "late-commission-ps");
    if (commissions.length) offered += 1;
    assert.ok(commissions.length <= 4, "never more than four");
    commissions.slice(1).forEach((offer, index) => assert.ok(offer.age - commissions[index].age >= 3, `cooldown between ${commissions[index].age} and ${offer.age}`));
    if (commissions.length) assert.ok(commissions[0].age <= 50, `first offer at ${commissions[0].age}`);
  }
  assert.ok(offered >= 5, `${offered} of 8 masters were offered work`);
});

test("in play a funded offer never appears while its account is empty", () => {
  const life = master(["PS10"], -304, "play-empty");
  life.age = 46; life.stats.health = 95; life.vocations!.accounts.school = 0;
  assert.deepEqual(lateOffers(life, 14).filter(offer => offer.id === "late-commission-ps" || offer.id === "late-students-ps"), []);
});
