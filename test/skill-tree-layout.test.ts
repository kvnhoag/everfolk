import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { buildSkillTree, layoutSkillTree } from "../client/models/skill-tree.ts";
import type { SkillNode, SkillPosition, SkillTreeLayout, SkillTreeModel } from "../client/models/skill-tree.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

function oldLayout(model: SkillTreeModel): SkillTreeLayout {
  const cardWidth = 158, cardHeight = 100, columnGap = 32, rowGap = 14, gutter = 100;
  const tierCount = Math.max(1, ...model.nodes.map(node => node.tier + 1));
  const positions: Record<string, SkillPosition> = {};
  let y = 36;
  const branches = model.branches.map(label => {
    const nodes = model.nodes.filter(node => node.branch === label);
    const rows = Math.max(1, ...Array.from({ length: tierCount }, (_, tier) => nodes.filter(node => node.tier === tier).length));
    const height = rows * (cardHeight + rowGap) + 14;
    const result = { label, y, height };
    for (let tier = 0; tier < tierCount; tier++) {
      const column = nodes.filter(node => node.tier === tier);
      column.forEach((node, index) => { positions[node.id] = { x: gutter + tier * (cardWidth + columnGap), y: y + 7 + index * (cardHeight + rowGap) + (rows - column.length) * (cardHeight + rowGap) / 2 }; });
    }
    y += height; return result;
  });
  return { width: gutter + tierCount * (cardWidth + columnGap) - columnGap + 18, height: y + 8, cardWidth, cardHeight, tierCount,
    tierX: Array.from({ length: tierCount }, (_, tier) => gutter + tier * (cardWidth + columnGap)), positions, branches };
}
/** Independent proper-segment intersection check, ignoring common endpoints. */
function crossings(model: SkillTreeModel, layout: SkillTreeLayout): number {
  let count = 0;
  const turn = (a: SkillPosition, b: SkillPosition, c: SkillPosition) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lines = model.edges.map(edge => ({ edge,
    a: { x: layout.positions[edge.from].x + layout.cardWidth, y: layout.positions[edge.from].y + layout.cardHeight / 2 },
    b: { x: layout.positions[edge.to].x - 4, y: layout.positions[edge.to].y + layout.cardHeight / 2 },
  }));
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const x = lines[i], y = lines[j];
    if ([x.edge.from, x.edge.to].some(id => id === y.edge.from || id === y.edge.to)) continue;
    if (turn(x.a, x.b, y.a) * turn(x.a, x.b, y.b) < 0 && turn(y.a, y.b, x.a) * turn(y.a, y.b, x.b) < 0) count++;
  }
  return count;
}
function clearCards(model: SkillTreeModel, layout: SkillTreeLayout): void {
  for (const node of model.nodes) {
    const p = layout.positions[node.id], band = layout.branches.find(branch => branch.label === node.branch)!;
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.equal(p.x, layout.tierX[node.tier]);
    assert.ok(p.y >= band.y && p.y + layout.cardHeight <= band.y + band.height, `${node.id} left its labelled band.`);
    assert.ok(p.x >= 0 && p.x + layout.cardWidth <= layout.width && p.y + layout.cardHeight <= layout.height);
    for (const other of model.nodes.filter(item => item.id !== node.id)) {
      const q = layout.positions[other.id];
      assert.ok(p.x + layout.cardWidth <= q.x || q.x + layout.cardWidth <= p.x || p.y + layout.cardHeight <= q.y || q.y + layout.cardHeight <= p.y, `${node.id} overlaps ${other.id}.`);
    }
  }
}
function fixture(): SkillTreeModel {
  const node = (id: string, tier: number, branch = "A"): SkillNode => ({ id, label: id, tier, branch, description: "Layout fixture", value: 0, min: 0, max: 100,
    progress: 0, state: "locked", requirements: [], minAge: 0, ageMet: true, training: [], canPractice: false, careers: [], paidWork: [] });
  return { branches: ["A"], nodes: [node("a", 0), node("b", 0), node("c", 1), node("d", 1)],
    edges: [{ from: "a", to: "d", threshold: 10, met: false }, { from: "b", to: "c", threshold: 10, met: false }], otherTraining: [] };
}
function shipped(): SkillTreeModel {
  const engine = createEngine(pack), life = engine.start("skill-layout");
  return buildSkillTree(engine.world, life, engine.getActivities(life));
}

test("connected Alexandria branches sit together and eliminate the fixed-order link crossings", () => {
  const model = shipped(), before = oldLayout(model), after = layoutSkillTree(model);
  assert.deepEqual(after.branches.map(branch => branch.label), ["Crafts", "Practical service", "Letters & ideas", "Numbers & sky", "Performance"]);
  assert.ok(crossings(model, before) > 0, "The original layout must reproduce the reported tangled links.");
  assert.equal(crossings(model, after), 0);
  assert.ok(after.tierX[1] - after.tierX[0] - after.cardWidth >= 48, "Connectors need a usable gutter.");
  clearCards(model, after);
});

test("within-tier row ordering untangles a crossed pair without changing tiers or dependencies", () => {
  const model = fixture(), snapshot = structuredClone(model);
  assert.equal(crossings(model, oldLayout(model)), 1);
  const after = layoutSkillTree(model);
  assert.equal(crossings(model, after), 0);
  assert.deepEqual(model, snapshot);
  clearCards(model, after);
});

test("ordering is deterministic across progress, availability and shuffled node/edge input", () => {
  const model = shipped(), before = structuredClone(model), expected = layoutSkillTree(model);
  const progressed = structuredClone(model);
  progressed.nodes.reverse(); progressed.edges.reverse();
  progressed.nodes.forEach(node => { node.value = 100; node.progress = 1; node.state = "mastered"; node.canPractice = true; });
  progressed.edges.forEach(edge => { edge.met = true; });
  assert.deepEqual(layoutSkillTree(progressed), expected);
  assert.deepEqual(layoutSkillTree(model), expected);
  assert.deepEqual(model, before);
});

test("custom branch labels, disconnected roots, missing branch metadata and cyclic links remain bounded", () => {
  const model = fixture();
  model.branches = ["Custom coast", "Empty label"];
  model.nodes[0].branch = "Custom coast"; model.nodes[1].branch = "Remote workshop";
  model.nodes[2].branch = "Custom coast"; model.nodes[3].branch = "Remote workshop";
  model.edges.push({ from: "d", to: "a", threshold: 1, met: true });
  const layout = layoutSkillTree(model);
  assert.deepEqual(new Set(layout.branches.map(branch => branch.label)), new Set(["Custom coast", "Remote workshop", "Empty label"]));
  assert.deepEqual(layoutSkillTree(model), layout);
  clearCards(model, layout);
  const empty = layoutSkillTree({ nodes: [], edges: [], branches: [], otherTraining: [] });
  assert.ok(Number.isFinite(empty.width) && Number.isFinite(empty.height));
  assert.deepEqual(empty.positions, {});
});
