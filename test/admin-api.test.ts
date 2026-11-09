import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleApi } from "../server/api.ts";
import { MAX_CATALOG_BYTES, compileWorld, getBuiltinCatalog, getBuiltinWorld, getLegacyWorld, validateCatalog } from "../server/content.ts";
import type { ContentDatabase, D1Statement, StatementResult } from "../server/store.ts";
import type { ApiEnvironment } from "../server/api.ts";
import { createEngine } from "../src/index.ts";
import type { Condition, LifeEvent, WorldPack } from "../src/types.ts";
import namedCausesPack from "../worlds/alexandria-0.5.1.json" with { type: "json" };
import originRangesPack from "../worlds/alexandria-0.6.0.json" with { type: "json" };
import longerLivesPack from "../worlds/alexandria-0.6.1.json" with { type: "json" };
import pooledPeoplePack from "../worlds/alexandria-0.7.0.json" with { type: "json" };
import skillTreePack from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import economyPack from "../worlds/alexandria-0.9.0.json" with { type: "json" };
import variedPack from "../worlds/alexandria-0.10.0.json" with { type: "json" };
import birthPack from "../worlds/alexandria-0.11.0.json" with { type: "json" };
import { contentFingerprint } from "../src/random.ts";

const OWNER = "owner@example.test";
const ORIGIN = "https://game.example.test";

class TestStatement implements D1Statement {
  values: unknown[] = [];
  readonly database: DatabaseSync;
  readonly sql: string;
  constructor(database: DatabaseSync, sql: string) { this.database = database; this.sql = sql; }
  bind(...values: unknown[]): D1Statement { this.values = values; return this; }
  async first<T>(): Promise<T | null> { return this.database.prepare(this.sql).get(...this.values as never[]) as T ?? null; }
  async run(): Promise<StatementResult> {
    const result = this.database.prepare(this.sql).run(...this.values as never[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class TestDatabase implements ContentDatabase {
  readonly sqlite = new DatabaseSync(":memory:");
  beforeBatch?: () => void;
  constructor() {
    for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(file => file.endsWith(".sql")).sort()) {
      this.sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
    }
  }
  prepare(sql: string): D1Statement { return new TestStatement(this.sqlite, sql); }
  async batch(statements: D1Statement[]): Promise<StatementResult[]> {
    this.beforeBatch?.();
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
  close() { this.sqlite.close(); }
}

function request(path: string, method = "GET", value?: unknown, email: string | null = OWNER, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (email) { headers["oai-authenticated-user-id"] = "test-user"; headers["oai-authenticated-user-email"] = email; }
  if (method !== "GET") { headers.Origin ??= ORIGIN; headers["Content-Type"] ??= "application/json"; }
  return new Request(`${ORIGIN}${path}`, { method, headers, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}

function setup(t: { after(fn: () => void): void }) {
  const db = new TestDatabase();
  t.after(() => db.close());
  const env: ApiEnvironment = { DB: db, ADMIN_EMAIL: OWNER };
  return { db, env, call: (path: string, method = "GET", value?: unknown) => handleApi(request(path, method, value), env) };
}

/** Synthetic one-origin fixtures must also prune conditional odds for removed households. */
function pruneRemovedOriginModifiers(world: WorldPack): void {
  const retained = new Set(world.origins.map(origin => origin.id));
  const hasRemovedOrigin = (condition: Condition): boolean => {
    if (condition.type === "origin") return !retained.has(condition.origin);
    if (condition.type === "all" || condition.type === "any") return condition.conditions.some(hasRemovedOrigin);
    return condition.type === "not" && hasRemovedOrigin(condition.condition);
  };
  for (const choice of [...world.events.flatMap(event => event.choices), ...(world.character?.activities ?? [])]) {
    for (const outcome of choice.outcomes) {
      if (!outcome.weightModifiers) continue;
      outcome.weightModifiers = outcome.weightModifiers.filter(modifier => !hasRemovedOrigin(modifier.when));
      if (!outcome.weightModifiers.length) delete outcome.weightModifiers;
    }
  }
}

test("admin APIs deny anonymous users and invited players, even when they know the URLs", async t => {
  const { env } = setup(t);
  for (const email of [null, "friend@example.test"]) {
    const session = await handleApi(request("/api/session", "GET", undefined, email), env);
    assert.deepEqual(await session.json(), { authenticated: email !== null, isAdmin: false });
    const draft = await handleApi(request("/api/admin/catalog", "GET", undefined, email), env);
    assert.equal(draft.status, email ? 403 : 401);
    const publish = await handleApi(request("/api/admin/publish", "POST", { revision: 0 }, email), env);
    assert.equal(publish.status, email ? 403 : 401);
  }
});

test("admin authorization requires both trusted identity headers and a configured owner", async t => {
  const { env } = setup(t);
  const missingId = request("/api/admin/catalog");
  missingId.headers.delete("oai-authenticated-user-id");
  assert.equal((await handleApi(missingId, env)).status, 401);
  assert.equal((await handleApi(request("/api/admin/catalog"), { DB: env.DB })).status, 403);
  assert.deepEqual(await (await handleApi(request("/api/session"), env)).json(), { authenticated: true, isAdmin: true });
});

test("explicit additional admins can edit while ordinary invited players remain viewers", async t => {
  const { env } = setup(t);
  const configured = { ...env, ADMIN_EMAILS: "  Invited-Admin@example.test ; second-admin@example.test\n" };
  for (const email of [OWNER, "invited-admin@example.test", "SECOND-ADMIN@example.test"]) {
    assert.deepEqual(await (await handleApi(request("/api/session", "GET", undefined, email), configured)).json(), { authenticated: true, isAdmin: true });
    assert.equal((await handleApi(request("/api/admin/catalog", "GET", undefined, email), configured)).status, 200);
  }
  assert.equal((await handleApi(request("/api/admin/catalog", "PUT", getBuiltinCatalog(), "invited-admin@example.test"), configured)).status, 200);
  for (const email of ["friend@example.test", "invited-admin@example.test.evil", "not-invited-admin@example.test"]) {
    assert.equal((await handleApi(request("/api/admin/catalog", "GET", undefined, email), configured)).status, 403);
  }
  const missingIdentity = request("/api/admin/catalog", "GET", undefined, "invited-admin@example.test");
  missingIdentity.headers.delete("oai-authenticated-user-id");
  assert.equal((await handleApi(missingIdentity, configured)).status, 401);
});

test("cross-site, missing-origin and non-JSON mutations fail without changing the draft", async t => {
  const { env, call } = setup(t);
  const catalog = getBuiltinCatalog();
  for (const headers of [{ Origin: "https://evil.example" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await handleApi(request("/api/admin/catalog", "PUT", catalog, OWNER, headers), env)).status, 403);
  }
  const noOrigin = request("/api/admin/catalog", "PUT", catalog);
  noOrigin.headers.delete("Origin");
  assert.equal((await handleApi(noOrigin, env)).status, 403);
  assert.equal((await handleApi(request("/api/admin/catalog", "PUT", catalog, OWNER, { "Content-Type": "text/plain" }), env)).status, 415);
  assert.equal((await (await call("/api/admin/catalog")).json()).revision, 0);
});

test("the initial public world uses the exact shipped pack and stable revision", async t => {
  const { call } = setup(t);
  const builtin = getBuiltinWorld();
  const world = await (await call(`/api/worlds/${builtin.id}`)).json();
  assert.deepEqual(world, builtin);
  assert.deepEqual(await (await call(`/api/revisions/${builtin.revisionId}`)).json(), builtin);
  assert.equal((await call("/api/worlds/unknown-world")).status, 404);
});

test("only an untouched factory draft receives new bundled content, and legacy revisions remain readable", async t => {
  const { call, db } = setup(t);
  const legacy = getLegacyWorld();
  const baseline = getBuiltinCatalog(legacy.pack);
  db.sqlite.prepare("INSERT INTO content_catalog (id, revision, draft_json) VALUES (1, 0, ?)").run(JSON.stringify(baseline.worlds));
  const upgraded = await (await call("/api/admin/catalog")).json();
  assert.equal(upgraded.worlds[0].pack.version, getBuiltinWorld().pack.version);
  assert.deepEqual(await (await call(`/api/revisions/${legacy.revisionId}`)).json(), legacy);
  baseline.worlds[0].pack.title = "An owner-authored title";
  db.sqlite.prepare("UPDATE content_catalog SET draft_json = ? WHERE id = 1").run(JSON.stringify(baseline.worlds));
  const preserved = await (await call("/api/admin/catalog")).json();
  assert.equal(preserved.worlds[0].pack.title, "An owner-authored title");
  assert.equal(preserved.worlds[0].pack.version, legacy.pack.version);
});

test("event visual metadata validates its references, scenes, motions and captions before persistence", async t => {
  const { call, db } = setup(t);
  for (const visuals of [
    { "unknown-event": { scene: "rest", motion: "rest" } },
    { "an-unwell-week": { scene: "not-an-asset", motion: "rest" } },
    { "an-unwell-week": { scene: "rest", motion: "not-a-loop" } },
    { "an-unwell-week": { scene: "rest", motion: "rest", caption: "x".repeat(2001) } },
    { "an-unwell-week": { scene: "rest", motion: "rest", extra: true } },
  ]) {
    const draft = getBuiltinCatalog();
    (draft.worlds[0] as unknown as { eventVisuals: unknown }).eventVisuals = visuals;
    assert.equal((await call("/api/admin/catalog", "PUT", draft)).status, 422);
  }
  assert.equal((db.sqlite.prepare("SELECT count(*) AS count FROM content_catalog").get() as { count: number }).count, 0);
});

test("published visual edits are immutable sidecars and do not change simulation save fingerprints", async t => {
  const { call } = setup(t);
  const draft = getBuiltinCatalog();
  draft.worlds[0].eventVisuals = {
    "an-unwell-week": { scene: "rest", motion: "rest", caption: "Care and quiet in the household." },
    "child-found-treasure": { scene: "childhood", motion: "play" },
  };
  draft.worlds[0].disabledEventIds = ["child-found-treasure"];
  let saved = await (await call("/api/admin/catalog", "PUT", draft)).json();
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 200);
  const first = await (await call("/api/worlds/alexandria-sample")).json();
  assert.equal(first.eventVisuals["an-unwell-week"].scene, "rest");
  assert.equal(first.eventVisuals["child-found-treasure"], undefined, "a disabled event's sidecar does not leak into its compiled publication");
  const fingerprint = createEngine(first.pack).fingerprint;
  saved.worlds[0].eventVisuals["an-unwell-week"] = { scene: "history-city", motion: "still", caption: "An alternative authored context." };
  saved = await (await call("/api/admin/catalog", "PUT", saved)).json();
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 200);
  const second = await (await call("/api/worlds/alexandria-sample")).json();
  assert.notEqual(second.revisionId, first.revisionId);
  assert.deepEqual(second.pack, first.pack);
  assert.equal(createEngine(second.pack).fingerprint, fingerprint);
  assert.deepEqual(await (await call(`/api/revisions/${first.revisionId}`)).json(), first);
  assert.equal(second.eventVisuals["an-unwell-week"].scene, "history-city");
});

test("saving drafts is durable but cannot change the published game", async t => {
  const { call, env } = setup(t);
  const draft = getBuiltinCatalog();
  draft.worlds[0].pack.title = "A draft title";
  const response = await call("/api/admin/catalog", "PUT", draft);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.revision, 1);
  const reread = await (await handleApi(request("/api/admin/catalog"), { ...env })).json();
  assert.equal(reread.worlds[0].pack.title, "A draft title");
  assert.equal((await (await call("/api/worlds/alexandria-sample")).json()).pack.title, getBuiltinWorld().pack.title);
  assert.equal((await call("/api/admin/catalog", "PUT", draft)).status, 409);
});

test("origin stat ranges survive draft persistence and publication and determine new life stats", async t => {
  const { call } = setup(t);
  const draft = getBuiltinCatalog();
  const pack = draft.worlds[0].pack;
  pack.stats.knowledge.initialRange = { min: 3, max: 4 };
  pack.stats.bonds.initialRange = { min: 51, max: 52 };
  pack.origins = [{ ...pack.origins[0], statRanges: { health: { min: 41, max: 43 }, wealth: { min: 10, max: 12 } }, effects: [] }];
  // This isolated one-origin fixture excludes the other households' stories.
  pack.events = pack.events.filter(event => !event.id.startsWith("background-"));
  pruneRemovedOriginModifiers(pack);
  const response = await call("/api/admin/catalog", "PUT", draft);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.deepEqual((await (await call("/api/admin/catalog")).json()).worlds[0].pack.origins, pack.origins);
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 200);
  const published = await (await call("/api/worlds/alexandria-sample")).json();
  assert.deepEqual(published.pack.origins, pack.origins);
  assert.deepEqual(published.pack.stats, pack.stats);
  const engine = createEngine(published.pack);
  const births = Array.from({ length: 40 }, (_, index) => engine.start(`published-origin-ranges-${index}`));
  for (const life of births) {
    assert.equal(life.originId, pack.origins[0].id);
    for (const [stat, min, max] of [["health", 41, 43], ["wealth", 10, 12], ["knowledge", 3, 4], ["bonds", 51, 52]] as const) {
      assert.ok(Number.isInteger(life.stats[stat]) && life.stats[stat] >= min && life.stats[stat] <= max, `${stat} must follow its published origin override or world fallback`);
    }
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.ok(new Set(births.map(life => JSON.stringify(life.stats))).size > 1);
});

test("health, relationships and their event rules survive admin draft and publication", async t => {
  const { call } = setup(t);
  const draft = getBuiltinCatalog();
  const pack = draft.worlds[0].pack;
  pack.health!.conditions[0].recoveryChance = 0.82;
  pack.health!.supportRecoveryBonus = 0.14;
  pack.relationships!.initialCloseness = 53;
  const person = pack.character!.partners[0].id;
  const condition = pack.health!.conditions[0].id;
  const event: LifeEvent = {
    id: "admin-care-check", title: "Help at home", text: "Someone you know helps while you recover.",
    trigger: { type: "random", weight: 1 }, mode: "automatic", choices: [], maxOccurrences: 1, cooldownYears: 1,
    when: { type: "all", conditions: [{ type: "has-condition", condition }, { type: "closeness", partner: person, op: "gte", value: 40 }] },
    effects: [{ type: "condition", condition }, { type: "care", amount: 0.65 }, { type: "closeness", target: "partner", partner: person, delta: 4 }],
  };
  pack.events.push(structuredClone(event));
  const response = await call("/api/admin/catalog", "PUT", draft);
  assert.equal(response.status, 200);
  const saved = await response.json();
  const reread = (await (await call("/api/admin/catalog")).json()).worlds[0].pack;
  assert.deepEqual(reread.health, pack.health);
  assert.deepEqual(reread.relationships, pack.relationships);
  assert.deepEqual(reread.events.find((item: { id: string }) => item.id === event.id), event);
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 200);
  const published = (await (await call("/api/worlds/alexandria-sample")).json()).pack;
  assert.deepEqual(published.health, pack.health);
  assert.deepEqual(published.relationships, pack.relationships);
  assert.deepEqual(published.events.find((item: { id: string }) => item.id === event.id), event);
});

test("invalid health and relationship edits cannot overwrite the admin draft", async t => {
  const { call } = setup(t);
  const original = await (await call("/api/admin/catalog")).json();
  for (const mutate of [
    (pack: WorldPack) => { pack.health!.conditions[0].recoveryChance = 1.1; },
    (pack: WorldPack) => { pack.health!.declineBands.pop(); },
    (pack: WorldPack) => { pack.relationships!.initialCloseness = 101; },
    (pack: WorldPack) => { pack.events[0].when = { type: "has-condition", condition: "missing-condition" }; },
  ]) {
    const draft = getBuiltinCatalog();
    mutate(draft.worlds[0].pack);
    assert.equal((await call("/api/admin/catalog", "PUT", draft)).status, 422);
    assert.deepEqual(await (await call("/api/admin/catalog")).json(), original);
  }
});

test("invalid starting ranges are rejected before any admin draft write", async t => {
  const { call } = setup(t);
  const original = await (await call("/api/admin/catalog")).json();
  for (const mutate of [
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].pack.stats.health.initialRange = { min: 80, max: 70 }; },
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].pack.origins[0].statRanges = { health: { min: 0, max: 101 } }; },
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].pack.origins[0].statRanges = { missing: { min: 0, max: 1 } }; },
  ]) {
    const draft = getBuiltinCatalog();
    mutate(draft);
    assert.equal((await call("/api/admin/catalog", "PUT", draft)).status, 422);
    assert.deepEqual(await (await call("/api/admin/catalog")).json(), original);
  }
});

test("the pre-randomization 0.5.1 factory revision remains retrievable with its original replay", async t => {
  const { call } = setup(t);
  const revisionId = `pack-${contentFingerprint(namedCausesPack)}`;
  const response = await call(`/api/revisions/${revisionId}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, namedCausesPack);
  const original = createEngine(namedCausesPack);
  const restored = createEngine(archived.pack);
  const life = original.choose(original.start("pinned-0.5.1-api"), "family-care");
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.advance(life), original.advance(life));
});

test("the 0.6.0 factory revision retains its earlier mortality curve for pinned lives", async t => {
  const { call } = setup(t);
  const revisionId = `pack-${contentFingerprint(originRangesPack)}`;
  const response = await call(`/api/revisions/${revisionId}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, originRangesPack);
  const original = createEngine(originRangesPack);
  const restored = createEngine(archived.pack);
  const life = original.choose(original.start("pinned-0.6.0-api"), "family-care");
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.advance(life), original.advance(life));
});

test("publication is explicit, immutable and safe for existing pinned lives", async t => {
  const { call } = setup(t);
  const draft = getBuiltinCatalog();
  draft.worlds[0].pack.title = "First release";
  let saved = await (await call("/api/admin/catalog", "PUT", draft)).json();
  let published = await call("/api/admin/publish", "POST", { revision: saved.revision });
  assert.equal(published.status, 200);
  const firstPublication = await published.json();
  const firstWorld = await (await call("/api/worlds/alexandria-sample")).json();
  assert.equal(firstWorld.pack.title, "First release");
  assert.deepEqual(await (await call(`/api/revisions/${firstWorld.revisionId}`)).json(), firstWorld);
  assert.deepEqual(await (await call("/api/admin/publish", "POST", { revision: saved.revision })).json(), firstPublication, "repeating publication is idempotent");
  saved.worlds[0].pack.title = "Second release";
  saved = await (await call("/api/admin/catalog", "PUT", saved)).json();
  assert.equal((await call("/api/admin/publish", "POST", { revision: 1 })).status, 409);
  published = await call("/api/admin/publish", "POST", { revision: saved.revision });
  assert.equal(published.status, 200);
  const secondWorld = await (await call("/api/worlds/alexandria-sample")).json();
  assert.equal(secondWorld.pack.title, "Second release");
  assert.notEqual(secondWorld.revisionId, firstWorld.revisionId);
  assert.deepEqual(await (await call(`/api/revisions/${firstWorld.revisionId}`)).json(), firstWorld);
  assert.deepEqual(await (await call(`/api/revisions/${getBuiltinWorld().revisionId}`)).json(), getBuiltinWorld());
});

test("the 0.6.1 world remains available without retroactive names or introductions", async t => {
  const { call } = setup(t);
  const response = await call(`/api/revisions/pack-${contentFingerprint(longerLivesPack)}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, longerLivesPack);
  const original = createEngine(longerLivesPack);
  const life = original.choose(original.start("pre-discovery-api"), "family-care");
  assert.deepEqual(createEngine(archived.pack).load(original.save(life)), life);
});

test("the pinned 0.7.0 world retains its original skill definitions and exact continuation", async t => {
  const { call } = setup(t);
  const response = await call(`/api/revisions/pack-${contentFingerprint(pooledPeoplePack)}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, pooledPeoplePack);
  const original = createEngine(pooledPeoplePack), restored = createEngine(archived.pack);
  assert.equal(restored.world.character!.skills.pottery.prerequisites, undefined);
  const life = original.choose(original.start("pinned-0.7.0-api"), "family-care");
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.advance(life), original.advance(life));
});

test("a draft save racing publication cannot publish a stale snapshot or orphan a revision", async t => {
  const { db, call } = setup(t);
  const saved = await (await call("/api/admin/catalog", "PUT", getBuiltinCatalog())).json();
  db.beforeBatch = () => { db.sqlite.exec("UPDATE content_catalog SET revision = revision + 1 WHERE id = 1"); };
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_publications").get()!.count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_world_revisions").get()!.count, 1, "only the preexisting builtin revision remains");
});

test("the pinned 0.8.0 world retains its skill tree and abstract Resources without a money ledger", async t => {
  const { call } = setup(t);
  const response = await call(`/api/revisions/pack-${contentFingerprint(skillTreePack)}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, skillTreePack);
  const original = createEngine(skillTreePack), restored = createEngine(archived.pack);
  assert.equal(restored.world.economy, undefined);
  assert.deepEqual(restored.world.character!.skills.sculpture.prerequisites, { carving: 20, pottery: 10 });
  const life = original.choose(original.start("pinned-0.8.0-api"), "family-care");
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.advance(life), original.advance(life));
});

test("the pinned 0.9.0 world retains its original names, origins and exact money continuation", async t => {
  const { call } = setup(t);
  const response = await call(`/api/revisions/pack-${contentFingerprint(economyPack)}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, economyPack);
  const original = createEngine(economyPack), restored = createEngine(archived.pack);
  assert.equal(restored.world.origins.length, 3);
  assert.equal(restored.world.character!.playerNames!.length, 16);
  const life = original.choose(original.start("pinned-0.9.0-api"), "family-care");
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.advance(life), original.advance(life));
});

test("the pinned 0.10.0 world preserves the original birth choice and exact continuation", async t => {
  const { call } = setup(t);
  const response = await call(`/api/revisions/pack-${contentFingerprint(variedPack)}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, variedPack);
  const original = createEngine(variedPack), restored = createEngine(archived.pack);
  const born = original.start("pinned-0.10.0-api");
  assert.equal(born.phase, "choice");
  assert.equal(born.pendingEventId, "the-first-household");
  const life = original.choose(born, "family-care");
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.advance(life), original.advance(life));
});

test("the pinned 0.11.0 world retains automatic birth and exact continuation after the consistency update", async t => {
  const { call } = setup(t);
  const response = await call(`/api/revisions/pack-${contentFingerprint(birthPack)}`);
  assert.equal(response.status, 200);
  const archived = await response.json();
  assert.deepEqual(archived.pack, birthPack);
  const original = createEngine(birthPack), restored = createEngine(archived.pack);
  const life = original.advance(original.start("pinned-0.11.0-api"));
  assert.equal(original.world.character!.exclusiveCourtship, undefined);
  assert.deepEqual(restored.load(original.save(life)), life);
  assert.deepEqual(restored.replay(life.seed, life.commands), life);
});

test("disabled routes and events affect only the next published pack", async t => {
  const { call } = setup(t);
  const draft = getBuiltinCatalog();
  draft.worlds[0].routes.find(route => route.flag === "sailed")!.enabled = false;
  draft.worlds[0].disabledEventIds.push("first-steps");
  const saved = await (await call("/api/admin/catalog", "PUT", draft)).json();
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 200);
  const world = await (await call("/api/worlds/alexandria-sample")).json();
  assert.equal(world.pack.events.some((event: { id: string }) => event.id === "first-steps"), false);
  assert.equal(world.pack.events.find((event: { id: string }) => event.id === "a-place-on-the-manifest").choices.some((choice: { id: string }) => choice.id === "sail"), false);
  assert.equal(getBuiltinWorld().pack.events.some(event => event.id === "first-steps"), true);
});

test("disabled worlds leave the public catalog while their old revisions remain readable", async t => {
  const { call } = setup(t);
  const draft = getBuiltinCatalog();
  const second = structuredClone(draft.worlds[0]);
  second.id = second.pack.id = "another-world";
  second.pack.title = "Another world";
  draft.worlds.push(second);
  let saved = await (await call("/api/admin/catalog", "PUT", draft)).json();
  await call("/api/admin/publish", "POST", { revision: saved.revision });
  const oldWorld = await (await call("/api/worlds/another-world")).json();
  saved.worlds[1].enabled = false;
  saved = await (await call("/api/admin/catalog", "PUT", saved)).json();
  await call("/api/admin/publish", "POST", { revision: saved.revision });
  assert.equal((await (await call("/api/worlds")).json()).worlds.length, 1);
  assert.equal((await call("/api/worlds/another-world")).status, 404);
  assert.equal((await call(`/api/revisions/${oldWorld.revisionId}`)).status, 200);
});

test("invalid catalogs, references and empty route outcomes are rejected before persistence", async t => {
  const { call } = setup(t);
  for (const mutate of [
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].disabledEventIds = ["missing"]; },
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].enabled = false; },
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].pack.id = "mismatch"; },
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].routes[0].flag = "missing"; },
    (draft: ReturnType<typeof getBuiltinCatalog>) => {
      draft.worlds[0].routes.forEach(route => { route.enabled = false; });
      // Isolate the three route entries: specialist offers and keeping the
      // current job are independent choices in the full authored event.
      const event = draft.worlds[0].pack.events.find(event => event.id === "a-place-on-the-manifest")!;
      event.choices = event.choices.filter(choice => ["stay", "sail", "study"].includes(choice.id));
    },
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].pack.events[0].sourceIds = ["missing"]; },
  ]) {
    const draft = getBuiltinCatalog();
    mutate(draft);
    assert.equal((await call("/api/admin/catalog", "PUT", draft)).status, 422);
  }
  assert.equal((await (await call("/api/admin/catalog")).json()).revision, 0);
});

test("route compilation does not mutate the editor draft and cannot bypass non-choice activation", () => {
  const world = getBuiltinCatalog().worlds[0];
  const copy = structuredClone(world);
  world.routes[0].enabled = false;
  const compiled = compileWorld(world);
  assert.equal(compiled.events.find(event => event.id === "a-place-on-the-manifest")!.choices.some(choice => choice.id === "stay"), false);
  assert.deepEqual(world.pack, copy.pack);
  world.pack.origins[0].effects.push({ type: "flag", flag: "stayed", value: true });
  assert.throws(() => compileWorld(world), /outside a player choice/);
});

test("catalog validation refuses duplicate IDs, unsafe fields and missing metadata", () => {
  const duplicate = getBuiltinCatalog();
  duplicate.worlds.push(structuredClone(duplicate.worlds[0]));
  assert.throws(() => validateCatalog(duplicate), /duplicate world/);
  const route = getBuiltinCatalog();
  route.worlds[0].routes.push(structuredClone(route.worlds[0].routes[0]));
  assert.throws(() => validateCatalog(route), /unique/);
  const invalid = getBuiltinCatalog();
  Object.defineProperty(invalid, "worlds", { get() { throw new Error("Getter executed"); }, enumerable: true });
  assert.throws(() => validateCatalog(invalid), /plain JSON/);
});

test("malformed or oversized JSON, invalid publish requests and missing storage fail safely", async t => {
  const { env, call } = setup(t);
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/admin/catalog`, { method: "PUT", headers: request("/", "PUT").headers, body: "broken" }), env)).status, 400);
  const huge = request("/api/admin/catalog", "PUT", getBuiltinCatalog(), OWNER, { "Content-Length": "5000001" });
  assert.equal((await handleApi(huge, env)).status, 413);
  for (const value of [{ revision: -1 }, { revision: 0, injected: true }, { revision: 0.5 }]) assert.equal((await call("/api/admin/publish", "POST", value)).status, 422);
  assert.equal((await handleApi(request("/api/admin/catalog"), { ADMIN_EMAIL: OWNER })).status, 503);
});

test("UTF-8 catalog limits reject otherwise valid large imports before any database write", async t => {
  const { db, call } = setup(t);
  const draft = getBuiltinCatalog();
  for (const event of draft.worlds[0].pack.events) event.text = "界".repeat(6_000);
  const serialized = JSON.stringify(draft);
  assert.ok(serialized.length < MAX_CATALOG_BYTES, "character count alone would accept this import");
  assert.ok(new TextEncoder().encode(serialized).byteLength > MAX_CATALOG_BYTES);
  assert.throws(() => validateCatalog(draft), /1,500,000-byte limit/);
  const response = await call("/api/admin/catalog", "PUT", draft);
  assert.equal(response.status, 413);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_catalog").get()!.count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_world_revisions").get()!.count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_publications").get()!.count, 0);
});
