import type { CapabilityNode } from "../../src/capabilities/types.ts";

/**
 * The skill tree drawn as a half circle, like a fan opening upward: one shared root at the bottom centre (your life),
 * each branch a slice of the fan in its own colour, depth growing outward ring by ring, and each specialisation a
 * spoke of its own. The fan's shape is a 16:9 screen, so the whole tree fits one screen at a readable size. Lines inside a
 * branch never cross another spoke; a skill that needs another branch is reached along the gap beside its spoke.
 * Geometry is independent of life state: learning a skill never moves anything. Pure.
 */

export const RADIAL_WIDTH = 1340;
export const RADIAL_HEIGHT = 754;
const CX = RADIAL_WIDTH / 2;
const CY = RADIAL_HEIGHT - 62;
/** The fan spans from straight left (-90°) to straight right (90°). */
const FAN_START = -90;
const FAN_SPAN = 180;
const FIRST_RING = 112;
const RING_STEP = 46;
export const ROOT_RADIUS = 52;
export const NODE_RADIUS = 20;

export interface RadialNode { node: CapabilityNode; x: number; y: number; angle: number; radius: number }
export interface RadialLink { from: string; to: string; path: string; branch: string; crossover?: boolean }
export interface RadialLane { name: string; angle: number; x: number; y: number; anchor: "start" | "middle" | "end" }
export interface RadialSector { branch: string; color: string; start: number; end: number; labelX: number; labelY: number; lanes: RadialLane[] }
export interface RadialLayout {
  width: number; height: number; cx: number; cy: number;
  rings: number[]; nodes: RadialNode[]; links: RadialLink[]; rootLinks: RadialLink[]; sectors: RadialSector[];
}

/** One colour per branch, bright enough to stand out on the dark map. */
export const BRANCH_COLORS: Record<string, string> = { Physique: "#ef8354", Knowledge: "#5fb0ef", Handmade: "#73c97c", Trade: "#f0c24e" };
const FALLBACK_COLORS = ["#ef8354", "#5fb0ef", "#73c97c", "#f0c24e", "#c792ea", "#4fd1c5"];

/** Each branch's slice, by its centre angle (degrees clockwise from straight up). */
const SECTOR_CENTERS: Record<string, number> = { Physique: -67.5, Knowledge: -22.5, Handmade: 22.5, Trade: 67.5 };
/** Spokes for the specialisations. Military sits next to Knowledge, which it draws on. */
const LANE_ANGLES: Record<string, number> = {
  Cultivation: -84, Resilience: -70, "Military practice": -55, Conditioning: -55,
  "Civic practice": -35, Research: -10,
  Ceramics: 8, Sculpture: 22.5, Clothing: 37,
  "Commercial planning": 67.5,
};
/** Room kept between two skills on the same ring, in map units. */
const SIBLING_ROOM = NODE_RADIUS * 2 + 10;
/** A crossover runs along the gap this far beside its target's spoke. */
const GAP_OFFSET = 10;

export function ringRadius(depth: number): number {
  return FIRST_RING + (depth - 1) * RING_STEP;
}

function point(angle: number, radius: number): { x: number; y: number } {
  const radians = angle * Math.PI / 180;
  return { x: +(CX + radius * Math.sin(radians)).toFixed(1), y: +(CY - radius * Math.cos(radians)).toFixed(1) };
}

function sectorCenters(branches: readonly string[]): Map<string, number> {
  const known = branches.every(branch => branch in SECTOR_CENTERS);
  const span = FAN_SPAN / Math.max(1, branches.length);
  return new Map(branches.map((branch, index) => [branch, known ? SECTOR_CENTERS[branch] : FAN_START + span * (index + .5)]));
}

/** Spokes: known specialisations keep their angle; others spread evenly inside their branch's quarter. */
function laneAngles(nodes: readonly CapabilityNode[], centers: Map<string, number>, span: number): Map<string, number> {
  const lanes = new Map<string, number>();
  for (const [branch, center] of centers) {
    const names = [...new Set(nodes.filter(node => node.branch === branch && node.specialization).map(node => node.specialization!))];
    const unknown = names.filter(name => !(name in LANE_ANGLES) || !(branch in SECTOR_CENTERS));
    names.forEach(name => { if (!unknown.includes(name)) lanes.set(`${branch}/${name}`, LANE_ANGLES[name]); });
    unknown.forEach((name, index) => lanes.set(`${branch}/${name}`, center - span / 2 + span * (index + 1) / (unknown.length + 1)));
  }
  return lanes;
}

/** A skill's angle: its spoke, or for a trunk skill the middle of the spokes it leads to in its own branch. */
function nodeAngles(nodes: readonly CapabilityNode[], centers: Map<string, number>, lanes: Map<string, number>): Map<string, number> {
  const children = new Map<string, CapabilityNode[]>();
  for (const node of nodes) for (const parent of node.prerequisites.all) children.set(parent, [...(children.get(parent) ?? []), node]);
  const angles = new Map<string, number>();
  const visit = (node: CapabilityNode): number => {
    const known = angles.get(node.id);
    if (known !== undefined) return known;
    const lane = node.specialization ? lanes.get(`${node.branch}/${node.specialization}`) : undefined;
    const own = (children.get(node.id) ?? []).filter(child => child.branch === node.branch);
    const angle = lane ?? (own.length ? own.map(visit).reduce((sum, value) => sum + value, 0) / own.length : centers.get(node.branch) ?? 0);
    angles.set(node.id, angle);
    return angle;
  };
  nodes.forEach(visit);
  // Skills on one ring that would touch are spread apart around their middle, by arc length, not by angle.
  const groups = new Map<number, CapabilityNode[]>();
  for (const node of nodes) groups.set(node.depth, [...(groups.get(node.depth) ?? []), node]);
  for (const [depth, group] of groups) {
    const gap = SIBLING_ROOM / ringRadius(depth) * 180 / Math.PI;
    const sorted = [...group].sort((a, b) => angles.get(a.id)! - angles.get(b.id)!);
    for (let start = 0; start < sorted.length; start++) {
      let end = start;
      while (end + 1 < sorted.length && angles.get(sorted[end + 1].id)! - angles.get(sorted[end].id)! < gap) end++;
      if (end === start) continue;
      const cluster = sorted.slice(start, end + 1), middle = cluster.reduce((sum, node) => sum + angles.get(node.id)!, 0) / cluster.length;
      cluster.forEach((node, index) => angles.set(node.id, middle + (index - (cluster.length - 1) / 2) * gap));
      start = end;
    }
  }
  return angles;
}

function polar(angle: number, radius: number): string {
  const { x, y } = point(angle, radius);
  return `${x} ${y}`;
}

/** A link inside a branch: straight along a spoke, or a gentle bend from one spoke to the next ring's spoke. */
function branchPath(from: RadialNode, to: RadialNode): string {
  const start = from.radius + NODE_RADIUS, end = to.radius - NODE_RADIUS;
  if (Math.abs(from.angle - to.angle) < .5) return `M ${polar(from.angle, start)} L ${polar(to.angle, end)}`;
  const middle = (start + end) / 2;
  return `M ${polar(from.angle, start)} C ${polar(from.angle, middle)}, ${polar(to.angle, middle)}, ${polar(to.angle, end)}`;
}

/** A link from another branch: out of its source, along the gap beside the target's spoke, then into the target. */
function crossoverPath(from: RadialNode, to: RadialNode): string {
  let delta = from.angle - to.angle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  const gap = to.angle + Math.sign(delta || 1) * GAP_OFFSET;
  const leave = from.radius + NODE_RADIUS + 10, arrive = Math.max(leave + 10, to.radius - NODE_RADIUS - 14);
  return `M ${polar(from.angle, from.radius + NODE_RADIUS)} C ${polar(from.angle, leave + 20)}, ${polar(gap, leave)}, ${polar(gap, leave + 24)} `
    + `L ${polar(gap, arrive)} Q ${polar(gap, to.radius)}, ${polar(to.angle + Math.sign(delta || 1) * 4, to.radius)}`;
}

function deepest(nodes: readonly CapabilityNode[], branch: string, specialization: string): number {
  return Math.max(0, ...nodes.filter(node => node.branch === branch && node.specialization === specialization).map(node => node.depth));
}

/** A spoke's name sits past its last skill and runs away from it, so it never overlaps the skill. */
function laneLabel(angle: number, outer: number): { x: number; y: number; anchor: RadialLane["anchor"] } {
  if (Math.abs(angle) < 12) return { ...point(angle, outer + 52), anchor: "middle" };
  return { ...point(angle, outer + 34), anchor: angle < 0 ? "end" : "start" };
}

export function buildRadialLayout(nodes: readonly CapabilityNode[]): RadialLayout {
  const branches = [...new Set(nodes.map(node => node.branch))];
  const centers = sectorCenters(branches);
  const span = FAN_SPAN / Math.max(1, branches.length);
  const lanes = laneAngles(nodes, centers, span);
  const angles = nodeAngles(nodes, centers, lanes);
  const placed: RadialNode[] = nodes.map(node => {
    const angle = angles.get(node.id) ?? 0, radius = ringRadius(node.depth);
    return { node, angle, radius, ...point(angle, radius) };
  });
  const byId = new Map(placed.map(item => [item.node.id, item]));
  const links = placed.flatMap(to => to.node.prerequisites.all.flatMap(id => {
    const from = byId.get(id);
    if (!from) return [];
    const crossover = from.node.branch !== to.node.branch;
    return [{ from: id, to: to.node.id, branch: to.node.branch, path: crossover ? crossoverPath(from, to) : branchPath(from, to), ...(crossover ? { crossover: true } : {}) }];
  }));
  // Every branch grows from the same root: the first skill of each path is joined to the centre.
  const rootLinks = placed.filter(item => item.node.prerequisites.all.length === 0)
    .map(item => ({ from: "root", to: item.node.id, branch: item.node.branch, path: `M ${polar(item.angle, ROOT_RADIUS)} L ${polar(item.angle, item.radius - NODE_RADIUS)}` }));
  const outer = ringRadius(Math.max(...nodes.map(node => node.depth)));
  const sectors = branches.map((branch, index) => {
    // Upper branches are named above their spokes; the two side branches in the bottom corners, clear of every spoke.
    const center = centers.get(branch)!, side = Math.abs(center) > 45;
    const label = side ? { x: CX + Math.sign(center) * (outer - 40), y: CY + 34 } : point(center, outer + 72);
    return {
      branch, color: BRANCH_COLORS[branch] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length], start: center - span / 2, end: center + span / 2,
      labelX: label.x, labelY: label.y,
      // Spokes shared by two specialisations (Conditioning leads into Military) are named after the one reaching furthest.
      lanes: [...lanes].filter(([key]) => key.startsWith(`${branch}/`)).map(([key, angle]) => ({ name: key.slice(branch.length + 1), angle, ...laneLabel(angle, outer) }))
        .sort((a, b) => deepest(nodes, branch, b.name) - deepest(nodes, branch, a.name))
        .filter((lane, position, all) => all.findIndex(other => Math.abs(other.angle - lane.angle) < .5) === position),
    };
  });
  return { width: RADIAL_WIDTH, height: RADIAL_HEIGHT, cx: CX, cy: CY, rings: Array.from({ length: 10 }, (_, index) => ringRadius(index + 1)),
    nodes: placed, links, rootLinks, sectors };
}

/** The pie slice of a branch, for its faint background wedge. */
export function sectorPath(sector: Pick<RadialSector, "start" | "end">, inner: number, outer: number): string {
  const large = sector.end - sector.start > 180 ? 1 : 0;
  return `M ${polar(sector.start, inner)} L ${polar(sector.start, outer)} A ${outer} ${outer} 0 ${large} 1 ${polar(sector.end, outer)} `
    + `L ${polar(sector.end, inner)} A ${inner} ${inner} 0 ${large} 0 ${polar(sector.start, inner)} Z`;
}
