import assert from "node:assert/strict";
import test from "node:test";
import type { AdminCatalog } from "../server/content.ts";
import { requestJson } from "../client/lib/http.ts";
import { publishCatalogDraft, saveCatalogDraft } from "../client/mutations/catalog.ts";
import { persistSelectedWorld } from "../client/mutations/worlds.ts";
import { readAdminCatalog, readAdminSession } from "../client/queries/admin.ts";
import { hasLegacyWorldSave, readSelectedWorld, readWorld, readWorldCatalog } from "../client/queries/worlds.ts";

test("world queries preserve URL encoding, fresh reads and the timed same-origin transport", async t => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return Response.json({ id: "world", worlds: [] });
  });
  await readWorldCatalog();
  await readWorld("a world/with?characters");
  assert.deepEqual(calls.map(call => call.path), ["/api/worlds", "/api/worlds/a%20world%2Fwith%3Fcharacters"]);
  for (const call of calls) {
    assert.equal(call.init?.credentials, "same-origin");
    assert.equal(call.init?.cache, "no-store");
    assert.equal(new Headers(call.init?.headers).has("Content-Type"), false);
    assert.ok(call.init?.signal instanceof AbortSignal);
    assert.equal(call.init.signal.aborted, false);
  }
});

test("admin reads and mutations retain routes, JSON bodies and optimistic revisions", async t => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return Response.json({ ok: true });
  });
  const catalog: AdminCatalog = { revision: 7, worlds: [], publishedRevision: 5, publishedAt: null };
  await readAdminSession();
  await readAdminCatalog();
  await saveCatalogDraft(catalog);
  await publishCatalogDraft(catalog.revision);
  assert.deepEqual(calls.map(call => [call.path, call.init?.method ?? "GET"]), [
    ["/api/session", "GET"], ["/api/admin/catalog", "GET"],
    ["/api/admin/catalog", "PUT"], ["/api/admin/publish", "POST"],
  ]);
  assert.deepEqual(JSON.parse(calls[2].init?.body as string), { revision: 7, worlds: [] });
  assert.deepEqual(JSON.parse(calls[3].init?.body as string), { revision: 7 });
  for (const call of calls) {
    assert.equal(call.init?.credentials, "same-origin");
    assert.equal(new Headers(call.init?.headers).get("Content-Type"), "application/json");
  }
});

test("shared transport preserves feature error messages and invalid JSON policies", async t => {
  const responses = [
    Response.json({ error: "Reload this draft." }, { status: 409 }),
    Response.json({ message: "Storage unavailable." }, { status: 503 }),
    new Response("unavailable", { status: 503 }),
    Response.json({ message: "Internal detail" }, { status: 503 }),
    new Response("invalid", { status: 200 }),
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift()!);
  await assert.rejects(readAdminCatalog(), /Reload this draft\./);
  await assert.rejects(readAdminCatalog(), /Storage unavailable\./);
  await assert.rejects(readAdminCatalog(), /The request could not be completed \(503\)\./);
  await assert.rejects(readWorldCatalog(), /The world library could not be opened\./);
  await assert.rejects(readWorldCatalog(), SyntaxError);
});

test("world requests abort after twelve seconds and clear completed-request timers", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let requestSignal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", (_path: string, init?: RequestInit) => {
    requestSignal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener("abort", () => reject(requestSignal!.reason), { once: true });
    });
  });
  const pending = readWorldCatalog();
  const rejection = assert.rejects(pending, { name: "AbortError" });
  t.mock.timers.tick(11_999);
  assert.equal(requestSignal?.aborted, false);
  t.mock.timers.tick(1);
  await rejection;
  assert.equal(requestSignal?.aborted, true);

  let completedSignal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", async (_path: string, init?: RequestInit) => {
    completedSignal = init?.signal;
    return Response.json({ worlds: [] });
  });
  await readWorldCatalog();
  t.mock.timers.tick(12_000);
  assert.equal(completedSignal?.aborted, false);
});

test("transport keeps caller headers and selected-world storage retains legacy reads", async t => {
  t.mock.method(globalThis, "fetch", async (_path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-Example"), "value");
    assert.equal(headers.get("Content-Type"), "application/custom+json");
    return Response.json({ ok: true });
  });
  await requestJson("/example", { headers: new Headers({ "X-Example": "value", "Content-Type": "application/custom+json" }) });

  const entries = new Map<string, string>([
    ["historical-lives:selected-world:v1", JSON.stringify({ id: "legacy-world" })],
    ["historical-lives:alexandria-sample:v3", "legacy-save"],
  ]);
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  assert.equal(readSelectedWorld(storage)?.id, "legacy-world");
  assert.equal(hasLegacyWorldSave(storage), true);
  const selected = readSelectedWorld(storage)!;
  persistSelectedWorld(storage, selected);
  assert.equal(entries.get("everfolk:selected-world:v1"), JSON.stringify(selected));
  assert.ok(entries.has("historical-lives:selected-world:v1"));
});
