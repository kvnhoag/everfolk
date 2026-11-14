import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { WorldPack } from "../src/types.ts";
import { BRANCH_COLORS, buildRadialLayout, NODE_RADIUS, RADIAL_HEIGHT, RADIAL_WIDTH, ringRadius } from "../client/models/capability-radial.ts";
import { CAPABILITY_NODES } from "../client/models/capability-layout.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const nodes = world.capabilities!.nodes;
const layout = buildRadialLayout(nodes);

test("every skill sits on its depth's ring inside a 16:9 fan, and no two skills overlap", () => {
  assert.ok(Math.abs(RADIAL_WIDTH / RADIAL_HEIGHT - 16 / 9) < .03, "the whole tree is shaped like a 16:9 screen");
  assert.equal(layout.nodes.length, nodes.length);
  for (const item of layout.nodes) {
    const distance = Math.hypot(item.x - layout.cx, item.y - layout.cy);
    assert.ok(Math.abs(distance - ringRadius(item.node.depth)) < 1, `${item.node.id} is on ring ${item.node.depth}`);
    assert.ok(item.x > NODE_RADIUS && item.x < RADIAL_WIDTH - NODE_RADIUS && item.y > NODE_RADIUS && item.y < layout.cy + NODE_RADIUS, `${item.node.id} is inside the fan`);
  }
  for (const a of layout.nodes) for (const b of layout.nodes) {
    if (a === b) continue;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= NODE_RADIUS * 2 + 2, `${a.node.id} and ${b.node.id} do not overlap`);
  }
});

test("all four branches grow from one shared root, each in its own slice of the fan and colour", () => {
  const firsts = nodes.filter(node => node.prerequisites.all.length === 0).map(node => node.id).sort();
  assert.deepEqual(layout.rootLinks.map(link => link.to).sort(), firsts);
  assert.deepEqual(layout.sectors.map(sector => sector.branch).sort(), ["Handmade", "Knowledge", "Physique", "Trade"]);
  for (const sector of layout.sectors) {
    assert.equal(sector.color, BRANCH_COLORS[sector.branch]);
    assert.equal(sector.end - sector.start, 45);
    for (const item of layout.nodes.filter(node => node.node.branch === sector.branch)) {
      assert.ok(item.angle >= sector.start - .01 && item.angle <= sector.end + .01, `${item.node.id} stays inside ${sector.branch}`);
    }
  }
  assert.equal(new Set(Object.values(BRANCH_COLORS)).size, 4, "each branch has a colour of its own");
});

test("each specialisation is its own spoke, and only links between branches are crossovers", () => {
  const spoke = (name: string) => new Set(layout.nodes.filter(item => item.node.specialization === name).map(item => item.angle.toFixed(1)));
  for (const name of ["Cultivation", "Resilience", "Research", "Civic practice", "Ceramics", "Sculpture", "Clothing", "Commercial planning"]) assert.equal(spoke(name).size, 1, `${name} is one straight spoke`);
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const link of layout.links) assert.equal(Boolean(link.crossover), byId.get(link.from)!.branch !== byId.get(link.to)!.branch);
  assert.ok(layout.links.some(link => link.from === "P1" && link.to === "M4" && link.crossover));
  const names = layout.sectors.flatMap(sector => sector.lanes.map(lane => lane.name));
  assert.ok(names.includes("Military practice"), "a shared spoke is named after the path that reaches furthest");
});

test("older worlds' skill catalogues still lay out without overlaps", () => {
  const older = buildRadialLayout(CAPABILITY_NODES);
  assert.equal(older.nodes.length, CAPABILITY_NODES.length);
  for (const a of older.nodes) for (const b of older.nodes) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= NODE_RADIUS * 2, `${a.node.id}/${b.node.id}`);
});
