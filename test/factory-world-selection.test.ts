import assert from "node:assert/strict";
import test from "node:test";
import { compilePublishedWorld, getBuiltinCatalog, getBuiltinWorld } from "../server/content.ts";
import type { PublishedWorld } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";
import { selectFactoryWorld } from "../client/factory-world-selection.ts";
import classical from "../worlds/alexandria-0.32.0.json" with { type: "json" };
import older from "../worlds/alexandria-0.25.0.json" with { type: "json" };

function factory(pack: unknown): PublishedWorld {
  const world = getBuiltinCatalog(pack).worlds[0];
  return { id: world.id, revisionId: `pack-${contentFingerprint(world.pack)}`, pack: world.pack, routes: world.routes };
}

test("new births use the current bundled factory for an exact older official pack in either era", () => {
  for (const pack of [classical, older]) {
    const published = factory(pack), before = structuredClone(published);
    const selected = selectFactoryWorld(published);
    assert.deepEqual(selected, getBuiltinWorld());
    assert.equal(selected.pack.version, "0.34.0");
    assert.ok(selected.pack.origins.some(origin => origin.id === "royal-household"));
    assert.deepEqual(published, before);
  }
});

test("an untouched published factory revision refreshes using its canonical publication identity", () => {
  for (const pack of [classical, older]) {
    const published = compilePublishedWorld(getBuiltinCatalog(pack).worlds[0]);
    assert.notEqual(published.revisionId, factory(pack).revisionId);
    assert.equal(selectFactoryWorld(published).pack.version, "0.34.0");
    const unexpectedRevision = { ...published, revisionId: "pack-unrecognized-publication" };
    assert.equal(selectFactoryWorld(unexpectedRevision), unexpectedRevision);
  }
});

test("resuming a begun official life preserves its exact pack while explicit new life refreshes", () => {
  const published = factory(classical);
  assert.equal(selectFactoryWorld(published, { hasBegunLife: true }), published);
  assert.deepEqual(selectFactoryWorld(published, { hasBegunLife: true, fresh: true }), getBuiltinWorld());
  assert.deepEqual(selectFactoryWorld(published, { hasBegunLife: false }), getBuiltinWorld());
});

test("the already current factory selection remains the same object", () => {
  const published = getBuiltinWorld();
  assert.equal(selectFactoryWorld(published), published);
});

test("edited or unrelated packs remain selected even when they claim a factory version", () => {
  const edited = factory(classical);
  edited.pack.origins[0].text += " A custom household.";
  assert.equal(selectFactoryWorld(edited), edited);
  const ownRevision = { ...edited, revisionId: `pack-${contentFingerprint(edited.pack)}` };
  assert.equal(selectFactoryWorld(ownRevision), ownRevision);
  const unrelated = { ...factory(classical), id: "another-world" };
  assert.equal(selectFactoryWorld(unrelated), unrelated);
});

test("mismatching and unrecognized revision identities never select the current factory", () => {
  const mismatched = { ...factory(classical), revisionId: factory(older).revisionId };
  assert.equal(selectFactoryWorld(mismatched), mismatched);
  const unknown = { ...factory(classical), revisionId: "pack-not-an-archived-revision" };
  assert.equal(selectFactoryWorld(unknown), unknown);
  const malformed = { ...factory(classical), pack: null } as unknown as PublishedWorld;
  assert.equal(selectFactoryWorld(malformed), malformed);
});

test("route edits and visual sidecars keep a custom published selection intact", () => {
  const routes = factory(classical);
  routes.routes[0].enabled = false;
  assert.equal(selectFactoryWorld(routes), routes);
  const visuals = { ...factory(classical), eventVisuals: { "the-first-household": { scene: "infancy" } } } as PublishedWorld;
  assert.equal(selectFactoryWorld(visuals), visuals);
});
