import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilityLayout, CAPABILITY_NODES, CAPABILITY_BRANCHES, CAPABILITY_NODE_WIDTH, CAPABILITY_NODE_HEIGHT, capabilityAncestors, capabilityNodeLabel, nextCapabilityNode } from "../client/models/capability-layout.ts";

test("the visible atlas contains all 74 authored nodes and every prerequisite connector", () => {
  const layout = buildCapabilityLayout();
  assert.equal(layout.nodes.length, 74);
  assert.equal(new Set(layout.nodes.map(item => item.node.id)).size, 74);
  assert.deepEqual(layout.bands.map(band => band.branch), [...CAPABILITY_BRANCHES]);
  const expected = CAPABILITY_NODES.flatMap(node => node.prerequisites.all.map(parent => `${parent}>${node.id}`)).sort();
  assert.deepEqual(layout.links.map(link => `${link.from}>${link.to}`).sort(), expected);
  assert.equal(layout.links.filter(link => link.to === "F4").length, 2, "both Farming foundations must visibly join");
});

test("every node is reachable from an authored foundation and parents flow left to right", () => {
  const layout = buildCapabilityLayout();
  const visited = new Set(CAPABILITY_NODES.filter(node => !node.prerequisites.all.length).map(node => node.id));
  for (let depth = 1; depth <= 10; depth++) for (const item of layout.nodes.filter(item => item.node.depth === depth)) {
    assert.ok(item.node.prerequisites.all.every(id => visited.has(id)), `${item.node.id} has reachable parents`);
    visited.add(item.node.id);
  }
  assert.equal(visited.size, 74);
  for (const link of layout.links) {
    const from = layout.nodes.find(item => item.node.id === link.from)!, to = layout.nodes.find(item => item.node.id === link.to)!;
    assert.ok(from.x < to.x, `${link.from} → ${link.to}`);
    assert.match(link.path, /^M /);
  }
  for (const branch of CAPABILITY_BRANCHES) assert.equal(Math.max(...layout.nodes.filter(item => item.node.branch === branch).map(item => item.node.depth)), 10);
});

test("the atlas keeps every label and touch target apart and inside its canvas", () => {
  const layout = buildCapabilityLayout();
  for (let a = 0; a < layout.nodes.length; a++) {
    const first = layout.nodes[a];
    assert.ok(first.x - CAPABILITY_NODE_WIDTH / 2 >= 0 && first.x + CAPABILITY_NODE_WIDTH / 2 <= layout.width, first.node.id);
    assert.ok(first.y - 32 >= 0 && first.y - 32 + CAPABILITY_NODE_HEIGHT <= layout.height, first.node.id);
    for (const second of layout.nodes.slice(a + 1)) {
      const overlap = Math.abs(first.x - second.x) < CAPABILITY_NODE_WIDTH && Math.abs(first.y - second.y) < CAPABILITY_NODE_HEIGHT;
      assert.equal(overlap, false, `${first.node.id} does not overlap ${second.node.id}`);
    }
  }
});

test("keyboard navigation follows branches, joins and neighbouring lanes", () => {
  const layout = buildCapabilityLayout();
  assert.equal(nextCapabilityNode(layout, "F3S", "ArrowRight"), "F4");
  assert.equal(nextCapabilityNode(layout, "F3W", "ArrowRight"), "F4");
  assert.equal(nextCapabilityNode(layout, "F3S", "ArrowDown"), "F3W");
  assert.equal(nextCapabilityNode(layout, "F3W", "ArrowUp"), "F3S");
  assert.equal(nextCapabilityNode(layout, "AT8", "ArrowLeft"), "AT7");
  assert.equal(nextCapabilityNode(layout, "PP10", "Home"), "P1");
  assert.equal(nextCapabilityNode(layout, "T1", "End"), "T10");
  assert.equal(nextCapabilityNode(layout, "T10", "ArrowRight"), null);
  assert.equal(nextCapabilityNode(layout, "F1", "Enter"), null, "Enter retains native button selection");
});

test("highlighted lineage includes both sides of a real join without unrelated specialties", () => {
  const ancestors = capabilityAncestors(CAPABILITY_NODES, "FC10");
  assert.ok(ancestors.has("F3S") && ancestors.has("F3W") && ancestors.has("FC10"));
  assert.equal(ancestors.has("FR5"), false);
  assert.equal(ancestors.has("A1"), false);
  const title = capabilityNodeLabel(CAPABILITY_NODES.find(node => node.id === "PS10")!, "Locked");
  assert.match(title, /Original inquiry.*PS10.*depth 10.*Research.*Locked/);
});
