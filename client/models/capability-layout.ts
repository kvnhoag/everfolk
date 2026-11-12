import { ATTRIBUTE_BRANCHES, ATTRIBUTE_NODES } from "../../src/capabilities/attribute-catalog.ts";
import type { CapabilityNode } from "../../src/capabilities/types.ts";

/** Geometry is independent of life state: earning a node never moves a path. */
export const CAPABILITY_NODES = ATTRIBUTE_NODES;
export const CAPABILITY_BRANCHES = ATTRIBUTE_BRANCHES;
export const CAPABILITY_NODE_WIDTH = 112;
export const CAPABILITY_NODE_HEIGHT = 102;
export const CAPABILITY_COLUMN_STEP = 142;

export interface PositionedCapability { node: CapabilityNode; x: number; y: number }
export interface CapabilityLink { from: string; to: string; path: string; crossover?: boolean }
export interface CapabilityBand { branch: string; top: number; bottom: number; titleY: number }
export interface CapabilityLayout {
  width: number; height: number; nodes: PositionedCapability[];
  links: CapabilityLink[]; bands: CapabilityBand[];
}

const BANDS: readonly CapabilityBand[] = [
  { branch: "Physique", top: 54, bottom: 484, titleY: 77 },
  { branch: "Knowledge", top: 499, bottom: 796, titleY: 523 },
  { branch: "Handmade", top: 811, bottom: 1253, titleY: 835 },
  { branch: "Trade", top: 1268, bottom: 1464, titleY: 1292 },
];

function lane(node: CapabilityNode): number {
  if (node.branch === "Physique") {
    if(node.specialization==="Conditioning" || node.specialization==="Military practice")return 426;
    if (node.id === "F3S" || node.specialization === "Cultivation") return 146;
    if (node.id === "F3W" || node.specialization === "Resilience") return 286;
    return 216;
  }
  if (node.branch === "Handmade") {
    if (node.specialization === "Clothing") return 904;
    if (node.specialization === "Sculpture") return 1184;
    return 1044;
  }
  if (node.branch === "Knowledge") {
    if (node.specialization === "Research") return 590;
    if (node.specialization === "Civic practice") return 730;
    return 660;
  }
  return 1385;
}

export function buildCapabilityLayout(nodes: readonly CapabilityNode[] = CAPABILITY_NODES): CapabilityLayout {
  const positioned = nodes.map(node => ({ node, x: 100 + (node.depth - 1) * CAPABILITY_COLUMN_STEP, y: lane(node) }));
  const byId = new Map(positioned.map(node => [node.node.id, node]));
  const links = positioned.flatMap(to => to.node.prerequisites.all.flatMap(id => {
    const from = byId.get(id);
    if (!from) return [];
    const x1 = from.x + 27, x2 = to.x - 27;
    const bend = Math.max(32, (x2 - x1) * .5);
    const crossover=from.node.branch!==to.node.branch;
    const path=id==='P4'&&to.node.id==='M8'
      ? `M ${from.x} ${from.y-32} V 514 H ${to.x-71} V ${to.y} H ${x2}`
      : `M ${x1} ${from.y} C ${x1 + bend} ${from.y}, ${x2 - bend} ${to.y}, ${x2} ${to.y}`;
    return [{ from: id, to: to.node.id, path, ...(crossover?{crossover:true}:{}) }];
  }));
  return { width: 1480, height: 1480, nodes: positioned, links, bands: BANDS.map(band => ({ ...band })) };
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
