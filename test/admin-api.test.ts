import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleApi } from "../server/api.ts";
import { MAX_CATALOG_BYTES, compileWorld, getBuiltinCatalog, getBuiltinWorld, validateCatalog } from "../server/content.ts";
import type { ContentDatabase, D1Statement, StatementResult } from "../server/store.ts";
import type { ApiEnvironment } from "../server/api.ts";

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

test("a draft save racing publication cannot publish a stale snapshot or orphan a revision", async t => {
  const { db, call } = setup(t);
  const saved = await (await call("/api/admin/catalog", "PUT", getBuiltinCatalog())).json();
  db.beforeBatch = () => { db.sqlite.exec("UPDATE content_catalog SET revision = revision + 1 WHERE id = 1"); };
  assert.equal((await call("/api/admin/publish", "POST", { revision: saved.revision })).status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_publications").get()!.count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM content_world_revisions").get()!.count, 1, "only the preexisting builtin revision remains");
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
    (draft: ReturnType<typeof getBuiltinCatalog>) => { draft.worlds[0].routes.forEach(route => { route.enabled = false; }); },
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
