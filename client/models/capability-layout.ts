import catalog from "../../design/skill-tree/catalog.json" with { type: "json" };
import type { CapabilityNode } from "../../src/capabilities/types.ts";

/** Geometry is independent of life state: earning a node never moves a path. */
export const CAPABILITY_NODES = catalog.nodes as unknown as CapabilityNode[];
export const CAPABILITY_BRANCHES = ["Farming", "Artisan", "Philosophy", "Trade"] as const;
export const CAPABILITY_NODE_WIDTH = 112;
export const CAPABILITY_NODE_HEIGHT = 102;
export const CAPABILITY_COLUMN_STEP = 142;

export interface PositionedCapability { node: CapabilityNode; x: number; y: number }
export interface CapabilityLink { from: string; to: string; path: string }
export interface CapabilityBand { branch: string; top: number; bottom: number; titleY: number }
export interface CapabilityLayout {
  width: number; height: number; nodes: PositionedCapability[];
  links: CapabilityLink[]; bands: CapabilityBand[];
}

const BANDS: readonly CapabilityBand[] = [
  { branch: "Farming", top: 54, bottom: 344, titleY: 77 },
  { branch: "Artisan", top: 359, bottom: 801, titleY: 383 },
  { branch: "Philosophy", top: 816, bottom: 1113, titleY: 840 },
  { branch: "Trade", top: 1128, bottom: 1324, titleY: 1152 },
];

function lane(node: CapabilityNode): number {
  if (node.branch === "Farming") {
    if (node.id === "F3S" || node.specialization === "Cultivation") return 146;
    if (node.id === "F3W" || node.specialization === "Resilience") return 286;
    return 216;
  }
  if (node.branch === "Artisan") {
    if (node.specialization === "Clothing") return 452;
    if (node.specialization === "Sculpture") return 732;
    return 592;
  }
  if (node.branch === "Philosophy") {
    if (node.specialization === "Research") return 907;
    if (node.specialization === "Civic practice") return 1047;
    return 977;
  }
  return 1245;
}

export function buildCapabilityLayout(nodes: readonly CapabilityNode[] = CAPABILITY_NODES): CapabilityLayout {
  const positioned = nodes.map(node => ({ node, x: 100 + (node.depth - 1) * CAPABILITY_COLUMN_STEP, y: lane(node) }));
  const byId = new Map(positioned.map(node => [node.node.id, node]));
  const links = positioned.flatMap(to => to.node.prerequisites.all.flatMap(id => {
    const from = byId.get(id);
    if (!from) return [];
    const x1 = from.x + 27, x2 = to.x - 27;
    const bend = Math.max(32, (x2 - x1) * .5);
    return [{ from: id, to: to.node.id, path: `M ${x1} ${from.y} C ${x1 + bend} ${from.y}, ${x2 - bend} ${to.y}, ${x2} ${to.y}` }];
  }));
  return { width: 1480, height: 1340, nodes: positioned, links, bands: BANDS.map(band => ({ ...band })) };
}

/** Arrow keys follow real dependencies before using a nearby lane. */
export function nextCapabilityNode(layout: CapabilityLayout, currentId: string, key: string): string | null {
  const current = layout.nodes.find(item => item.node.id === currentId);
  if (!current) return layout.nodes[0]?.node.id ?? null;
  if (key === "Home") return layout.nodes.find(item => item.node.branch === current.node.branch)?.node.id ?? null;
  if (key === "End") return [...layout.nodes].reverse().find(item => item.node.branch === current.node.branch)?.node.id ?? null;
  const toward = key === "ArrowRight" ? layout.nodes.filter(item => item.node.prerequisites.all.includes(currentId))
    : key === "ArrowLeft" ? layout.nodes.filter(item => current.node.prerequisites.all.includes(item.node.id)) : [];
  if (toward.length) return toward.sort((a, b) => Math.abs(a.y - current.y) - Math.abs(b.y - current.y))[0].node.id;
  if (!["ArrowUp", "ArrowDown"].includes(key)) return null;
  const direction = key === "ArrowUp" ? -1 : 1;
  const candidates = layout.nodes.filter(item => (item.y - current.y) * direction > 0);
  const score = (item: PositionedCapability) => Math.abs(item.x - current.x) * 4 + Math.abs(item.y - current.y);
  return candidates.sort((a, b) => score(a) - score(b))[0]?.node.id ?? null;
}

export function capabilityAncestors(nodes: readonly CapabilityNode[], id: string): Set<string> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const result = new Set<string>();
  function visit(nodeId: string) {
    if (result.has(nodeId)) return;
    result.add(nodeId);
    for (const parent of byId.get(nodeId)?.prerequisites.all ?? []) visit(parent);
  }
  visit(id);
  return result;
}

export function capabilityNodeLabel(node: CapabilityNode, state: string): string {
  return `${node.title} · ${node.id} · depth ${node.depth} · ${node.specialization ?? node.branch} · ${state}`;
}
