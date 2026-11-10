import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import { buildSkillTree, layoutSkillTree } from "../client/skill-tree.ts";
import { layoutSkillLinks } from "../client/skill-tree-links.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.24.0.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.4.0.json" with { type: "json" };

for (const world of [current, previous, legacy] as WorldPack[]) test(`${world.version} draws every requirement without crossed links or strokes through cards`, () => {
  const engine = createEngine(world), life = engine.start("skill-link-audit");
  const model = buildSkillTree(world, life, engine.getActivities(life)), layout = layoutSkillTree(model);
  const before = JSON.stringify({ world, life, model, layout });
  const links = layoutSkillLinks(model, layout);
  assert.deepEqual(links.map(edge => `${edge.from}:${edge.to}`).sort(), model.edges.map(edge => `${edge.from}:${edge.to}`).sort());
  for (const link of links) {
    for (let i = 1; i < link.points.length; i++) {
      const a = link.points[i - 1], b = link.points[i];
      assert.ok(a.x === b.x || a.y === b.y, "connectors have straight horizontal/vertical segments");
      for (const node of model.nodes) {
        const p = layout.positions[node.id], right = p.x + layout.cardWidth, bottom = p.y + layout.cardHeight;
        const intersects = a.x === b.x
          ? a.x > p.x && a.x < right && Math.max(a.y, b.y) > p.y && Math.min(a.y, b.y) < bottom
          : a.y > p.y && a.y < bottom && Math.max(a.x, b.x) > p.x && Math.min(a.x, b.x) < right;
        assert.equal(intersects, false, `${link.from} → ${link.to} passes through ${node.id}`);
      }
      for (const point of [a, b]) assert.ok(point.x >= 0 && point.x <= layout.width && point.y >= 0 && point.y <= layout.height);
    }
  }
  for (let left = 0; left < links.length; left++) for (let right = left + 1; right < links.length; right++) {
    const first = links[left], second = links[right];
    for (let i = 1; i < first.points.length; i++) for (let j = 1; j < second.points.length; j++) {
      const a = first.points[i - 1], b = first.points[i], c = second.points[j - 1], d = second.points[j];
      if ((a.x === b.x) === (c.x === d.x)) {
        const overlap = a.x === b.x
          ? a.x === c.x && Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) > Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
          : a.y === c.y && Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) > Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
        assert.equal(overlap, false, `${first.from} → ${first.to} shares an ambiguous stroke with ${second.from} → ${second.to}`);
        continue;
      }
      const x = a.x === b.x ? a.x : c.x, y = a.y === b.y ? a.y : c.y;
      const intersects = x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y) &&
        x >= Math.min(c.x, d.x) && x <= Math.max(c.x, d.x) && y >= Math.min(c.y, d.y) && y <= Math.max(c.y, d.y);
      assert.equal(intersects, false, `${first.from} → ${first.to} crosses ${second.from} → ${second.to}`);
    }
  }
  assert.equal(JSON.stringify({ world, life, model, layout }), before, "routing changes presentation only");
  const reordered = { ...model, nodes: model.nodes.slice().reverse(), edges: model.edges.slice().reverse() };
  assert.deepEqual(layoutSkillLinks(reordered, layout).map(({ from, to, path }) => ({ from, to, path })), links.map(({ from, to, path }) => ({ from, to, path })), "input ordering cannot shuffle connection lanes");
});
