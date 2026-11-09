import assert from "node:assert/strict";
import test from "node:test";
import { handleApi } from "../server/api.ts";
import { createSeededPlayService } from "../server/seeded-play.ts";
import type { SeededPlaySnapshot } from "../server/seeded-play.ts";
import type { SeededPlayGrant, SeededScenarioDefinition } from "../src/seeded-play.ts";
import { contentFingerprint } from "../src/random.ts";
import type { WorldPack } from "../src/types.ts";

const HOST = "https://historical-game.example.test";

function world(): WorldPack {
  return {
    schemaVersion: 1, id: "api-origin-world", version: "1.0.0", title: "Fictional API origin",
    description: "A small authored scenario for seeded API tests, not historical evidence.",
    startYear: -384, maxAge: 4,
    stats: { knowledge: { label: "Knowledge", min: 0, max: 100, initial: 1 } },
    flags: { observed: { label: "Observed", initial: false } },
    origins: [{ id: "origin-household", title: "Teaching household", text: "An authored beginning.", weight: 1, effects: [] }],
    yearlyEffects: [],
    events: [{
      id: "origin-observation", title: "An origin's choice", text: "A choice belonging to this authored scenario.",
      trigger: { type: "age", at: 0 }, choices: [
        { id: "observe", text: "Make an observation", outcomes: [
          { id: "observation-accepted", text: "The observation holds.", weight: 3, effects: [{ type: "stat", stat: "knowledge", delta: 4 }, { type: "flag", flag: "observed", value: true }] },
          { id: "observation-revised", text: "The observation needs revision.", weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 2 }, { type: "flag", flag: "observed", value: true }] },
        ] },
        { id: "decline", text: "Leave it for later", outcomes: [{ id: "observation-left", text: "You continue ordinary work.", weight: 1, effects: [] }] },
      ],
    }],
    endings: [{ id: "complete", title: "Chapter complete", text: "The authored chapter closes." }],
    defaultEnding: "complete",
  };
}

function request(path = "", method = "GET", value?: unknown, user: string | null = "alice", extra: Record<string, string> = {}): Request {
  const headers = new Headers();
  if (user) {
    // The API trusts these only because hosted Sites dispatch supplies them.
    headers.set("oai-authenticated-user-id", user);
    headers.set("oai-authenticated-user-email", `${user}@example.test`);
  }
  if (method !== "GET") { headers.set("Origin", HOST); headers.set("Content-Type", "application/json"); }
  for (const [key, content] of Object.entries(extra)) headers.set(key, content);
  return new Request(`${HOST}/api/seeded-play${path}`, { method, headers, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}

function setup() {
  const scenario: SeededScenarioDefinition = { id: "fictional-origin", version: "1.0.0", title: "A fictional origin", world: world() };
  const grant: SeededPlayGrant = {
    id: "owned-origin-1", token: { network: "testnet", contractId: "origins.testnet", tokenId: "origin-1" },
    allowSeededPlay: true, scenarioId: scenario.id, scenarioVersion: scenario.version,
    worldFingerprint: contentFingerprint(scenario.world), seed: "nft-recorded-origin-1",
  };
  const owners = new Map<string, readonly SeededPlayGrant[]>([["alice", [grant]]]);
  const calls: string[] = [];
  let fail = false;
  const service = createSeededPlayService({ scenarios: [scenario], entitlements: {
    async listOwnedGrants(subject) {
      calls.push(subject.userId);
      if (fail) throw new Error("PRIVATE_PROVIDER_FAILURE_MUST_NOT_LEAK");
      return owners.get(subject.userId) ?? [];
    },
  } });
  const env = { SEEDED_PLAY: service };
  const call = (path = "", method = "GET", value?: unknown, user: string | null = "alice", extra: Record<string, string> = {}) => handleApi(request(path, method, value, user, extra), env);
  return { scenario, grant, owners, calls, service, env, call, failProvider() { fail = true; } };
}

async function started(fixture: ReturnType<typeof setup>, user = "alice"): Promise<SeededPlaySnapshot> {
  const response = await fixture.call("/start", "POST", { grantId: fixture.grant.id }, user);
  assert.equal(response.status, 200);
  return response.json() as Promise<SeededPlaySnapshot>;
}

test("seeded API stays invisible by default and requires no content database", async () => {
  const fixture = setup();
  for (const [req, env] of [
    [request("", "GET", undefined, null), {}],
    [request("", "GET"), {}],
    [request("", "GET", undefined, null), fixture.env],
  ] as const) {
    const response = await handleApi(req, env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { available: false, origins: [] });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.deepEqual(fixture.calls, []);
  assert.equal((await handleApi(request("/start", "POST", { grantId: fixture.grant.id }, null), fixture.env)).status, 401);
  assert.equal((await handleApi(request("/start", "POST", { grantId: fixture.grant.id }), {})).status, 403);
});

test("only current owned allow-seeded-play grants reveal origins", async () => {
  const fixture = setup();
  fixture.owners.set("alice", [fixture.grant, { ...fixture.grant, id: "not-permitted", allowSeededPlay: false }]);
  const response = await fixture.call();
  assert.equal(response.status, 200);
  const listing = await response.json() as { available: boolean; origins: { grantId: string; originId: string }[] };
  assert.equal(listing.available, true);
  assert.deepEqual(listing.origins.map(origin => origin.grantId), [fixture.grant.id]);
  assert.equal(listing.origins[0].originId, "origin-household");
  assert.ok(!JSON.stringify(listing).includes(fixture.grant.seed));
  const other = await fixture.call("", "GET", undefined, "bob");
  assert.deepEqual(await other.json(), { available: false, origins: [] });
  assert.equal((await fixture.call("/start", "POST", { grantId: "not-permitted" })).status, 403);
  assert.equal((await fixture.call("/start", "POST", { grantId: fixture.grant.id }, "bob")).status, 403);
});

test("start binds seed, authored household and calendar without accepting client overrides", async () => {
  const fixture = setup();
  const snapshot = await started(fixture);
  assert.equal(snapshot.mode, "seeded-play");
  assert.equal(snapshot.freshAchievementClaimEligible, false);
  assert.equal(snapshot.life.seed, fixture.grant.seed);
  assert.equal(snapshot.life.originId, "origin-household");
  assert.equal(snapshot.life.year, -384);
  assert.equal(snapshot.world.startYear, -384);
  assert.deepEqual(snapshot.choices.map(choice => choice.id), ["observe", "decline"]);
  for (const changed of [
    { grantId: fixture.grant.id, seed: "a-better-seed" },
    { grantId: fixture.grant.id, originId: "royal-household" },
    { grantId: fixture.grant.id, world: fixture.scenario.world },
  ]) assert.equal((await fixture.call("/start", "POST", changed)).status, 422);
  assert.deepEqual((await started(fixture)).life, snapshot.life);
});

test("mutation requests require same-origin JSON even for an entitled account", async () => {
  const fixture = setup();
  const body = { grantId: fixture.grant.id };
  for (const headers of [
    { Origin: "https://attacker.example.test" },
    { "Sec-Fetch-Site": "cross-site" },
  ]) assert.equal((await fixture.call("/start", "POST", body, "alice", headers)).status, 403);
  assert.equal((await fixture.call("/start", "POST", body, "alice", { "Content-Type": "text/plain" })).status, 415);
  const req = request("/start", "POST", body); req.headers.delete("Origin");
  assert.equal((await handleApi(req, fixture.env)).status, 403);
});

test("server commands, load and repeated deterministic replay preserve the recorded life", async () => {
  const fixture = setup(), initial = await started(fixture);
  const body = { grantId: fixture.grant.id, save: initial.save, command: { type: "choose", choice: "observe" } };
  const response = await fixture.call("/step", "POST", body);
  assert.equal(response.status, 200);
  const next = await response.json() as SeededPlaySnapshot;
  assert.equal(next.life.flags.observed, true);
  assert.equal(next.life.seed, initial.life.seed);
  assert.equal(next.life.commands.length, 1);
  assert.equal(next.life.phase, "ready");
  const repeated = await fixture.call("/step", "POST", body);
  assert.deepEqual((await repeated.json() as SeededPlaySnapshot).life, next.life);
  const loaded = await fixture.call("/load", "POST", { grantId: fixture.grant.id, save: next.save });
  assert.equal(loaded.status, 200);
  assert.deepEqual((await loaded.json() as SeededPlaySnapshot).life, next.life);
  const advanced = await fixture.call("/step", "POST", { grantId: fixture.grant.id, save: next.save, command: { type: "advance" } });
  assert.equal(advanced.status, 200);
  assert.equal((await advanced.json() as SeededPlaySnapshot).life.year, -383);
  assert.equal(fixture.calls.length, 5);
});

test("different valid choices branch within one NFT-recorded seed", async () => {
  const fixture = setup(), initial = await started(fixture);
  const outcomes: SeededPlaySnapshot[] = [];
  for (const choice of ["observe", "decline"]) {
    const response = await fixture.call("/step", "POST", { grantId: fixture.grant.id, save: initial.save, command: { type: "choose", choice } });
    assert.equal(response.status, 200); outcomes.push(await response.json() as SeededPlaySnapshot);
  }
  assert.equal(outcomes[0].life.seed, outcomes[1].life.seed);
  assert.notEqual(outcomes[0].life.flags.observed, outcomes[1].life.flags.observed);
  assert.notEqual(outcomes[0].save, outcomes[1].save);
});

test("revocation denies prior saves and every subsequent mutation", async () => {
  const fixture = setup(), initial = await started(fixture);
  fixture.owners.set("alice", []);
  for (const [path, body] of [
    ["/start", { grantId: fixture.grant.id }],
    ["/load", { grantId: fixture.grant.id, save: initial.save }],
    ["/step", { grantId: fixture.grant.id, save: initial.save, command: { type: "choose", choice: "observe" } }],
  ] as const) assert.equal((await fixture.call(path, "POST", body)).status, 403);
  assert.deepEqual(await (await fixture.call()).json(), { available: false, origins: [] });
});

test("a transfer moves access to the current owner without changing the recorded seed", async () => {
  const fixture = setup(), initial = await started(fixture);
  fixture.owners.set("alice", []); fixture.owners.set("bob", [fixture.grant]);
  assert.equal((await fixture.call("/load", "POST", { grantId: fixture.grant.id, save: initial.save }, "alice")).status, 403);
  const bobStart = await started(fixture, "bob");
  assert.deepEqual(bobStart.life, initial.life);
  const bobLoad = await fixture.call("/load", "POST", { grantId: fixture.grant.id, save: initial.save }, "bob");
  assert.equal(bobLoad.status, 200);
  assert.deepEqual((await bobLoad.json() as SeededPlaySnapshot).life, initial.life);
});

test("caller NFT claims and header flags cannot grant ownership", async () => {
  const fixture = setup();
  const spoofHeaders = { "X-NFT-Owned": "true", "X-Seeded-Play": "true", "X-Wallet-Id": "alice.testnet" };
  assert.equal((await fixture.call("/start", "POST", { grantId: fixture.grant.id }, "bob", spoofHeaders)).status, 403);
  assert.equal((await fixture.call("/start", "POST", { grantId: fixture.grant.id, allowSeededPlay: true, nft: fixture.grant.token }, "bob", spoofHeaders)).status, 422);
  assert.deepEqual(await (await fixture.call("", "GET", undefined, "bob", spoofHeaders)).json(), { available: false, origins: [] });
});

test("a save cannot cross grants, tokens or nested seed bindings", async () => {
  const fixture = setup(), initial = await started(fixture);
  const second: SeededPlayGrant = { ...fixture.grant, id: "owned-origin-2", token: { ...fixture.grant.token, tokenId: "origin-2" } };
  fixture.owners.set("alice", [fixture.grant, second]);
  assert.equal((await fixture.call("/load", "POST", { grantId: second.id, save: initial.save })).status, 422);
  for (const alter of [
    (save: Record<string, any>) => { save.save.seed = "forged-seed"; },
    (save: Record<string, any>) => { save.token.tokenId = "forged-token"; },
    (save: Record<string, any>) => { save.worldFingerprint = "fnv1a64-0000000000000000"; },
    (save: Record<string, any>) => { save.save.commands = [{ type: "set-stats", knowledge: 100 }]; },
  ]) {
    const save = JSON.parse(initial.save); alter(save);
    assert.equal((await fixture.call("/load", "POST", { grantId: fixture.grant.id, save: JSON.stringify(save) })).status, 422);
  }
});

test("missing scenario revisions and changed provider fingerprints never fall back", async () => {
  const fixture = setup();
  for (const changed of [
    { ...fixture.grant, scenarioVersion: "2.0.0" },
    { ...fixture.grant, worldFingerprint: "fnv1a64-0000000000000000" },
  ]) {
    fixture.owners.set("alice", [changed]);
    assert.deepEqual(await (await fixture.call()).json(), { available: false, origins: [] });
    assert.equal((await fixture.call("/start", "POST", { grantId: fixture.grant.id })).status, 409);
  }
});

test("provider failures and duplicate grant/token records fail closed", async () => {
  const fixture = setup();
  for (const grants of [
    [fixture.grant, fixture.grant],
    [fixture.grant, { ...fixture.grant, id: "duplicate-token-other-id" }],
  ]) {
    fixture.owners.set("alice", grants);
    assert.equal((await fixture.call()).status, 503);
    assert.equal((await fixture.call("/start", "POST", { grantId: fixture.grant.id })).status, 503);
  }
  fixture.owners.set("alice", [fixture.grant]); fixture.failProvider();
  for (const [path, method, body] of [["", "GET", undefined], ["/start", "POST", { grantId: fixture.grant.id }]] as const) {
    const response = await fixture.call(path, method, body);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("PRIVATE_PROVIDER_FAILURE"));
  }
});

test("malformed requests, unsupported commands and methods do not start a different life", async () => {
  const fixture = setup(), initial = await started(fixture);
  assert.equal((await fixture.call("/unknown")).status, 404);
  assert.equal((await fixture.call("/start")).status, 405);
  assert.equal((await fixture.call("", "POST", { grantId: fixture.grant.id })).status, 405);
  for (const value of [null, [], "not-an-object"]) assert.equal((await fixture.call("/start", "POST", value)).status, 400);
  for (const value of [{}, { grantId: "" }, { grantId: fixture.grant.id, extra: true }]) assert.equal((await fixture.call("/start", "POST", value)).status, 422);
  const malformed = request("/start", "POST");
  const rawRequest = new Request(malformed, { body: "{" });
  assert.equal((await handleApi(rawRequest, fixture.env)).status, 400);
  for (const command of [
    { type: "start", seed: "replacement" }, { type: "choose", choice: "observe", seed: "replacement" },
    { type: "choose", choice: "missing-choice" }, { type: "advance" }, null,
  ]) assert.equal((await fixture.call("/step", "POST", { grantId: fixture.grant.id, save: initial.save, command })).status, 422);
  assert.deepEqual((await started(fixture)).life, initial.life);
});

test("request size is bounded by actual bytes, not a caller's claimed content length", async () => {
  const fixture = setup();
  assert.equal((await fixture.call("/start", "POST", { grantId: fixture.grant.id }, "alice", { "Content-Length": "8000001" })).status, 413);
  const req = request("/start", "POST", { grantId: fixture.grant.id, padding: "x".repeat(8_000_000) }, "alice", { "Content-Length": "1" });
  assert.equal((await handleApi(req, fixture.env)).status, 413);
});
