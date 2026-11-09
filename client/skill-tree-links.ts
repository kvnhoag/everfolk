import type { SkillEdge, SkillPosition, SkillTreeLayout, SkillTreeModel } from "./skill-tree.ts";

export interface SkillLink extends SkillEdge { points: SkillPosition[]; path: string }
interface Box { id: string; left: number; right: number; top: number; bottom: number }
const same = (a: SkillPosition, b: SkillPosition) => a.x === b.x && a.y === b.y;

function simplify(points: SkillPosition[]): SkillPosition[] {
  const result: SkillPosition[] = [];
  for (const point of points) {
    if (result.length && same(result.at(-1)!, point)) continue;
    while (result.length > 1) {
      const a = result.at(-2)!, b = result.at(-1)!;
      if (a.x === b.x && b.x === point.x || a.y === b.y && b.y === point.y) result.pop();
      else break;
    }
    result.push(point);
  }
  return result;
}

function blocked(points: SkillPosition[], boxes: Box[], edge: SkillEdge): boolean {
  return points.slice(1).some((b, index) => {
    const a = points[index];
    return boxes.some(box => {
      const padding = box.id === edge.from || box.id === edge.to ? 0 : 7;
      const left = box.left - padding, right = box.right + padding, top = box.top - padding, bottom = box.bottom + padding;
      return a.x === b.x
        ? a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom
        : a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
    });
  });
}

/** Penalise crossings and shared strokes before choosing the shorter clear route. */
function routeCost(points: SkillPosition[], routed: SkillLink[]): number {
  let length = 0, overlap = 0;
  const crossings = new Set<string>();
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index], horizontal = a.y === b.y;
    length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    for (const link of routed) for (let j = 1; j < link.points.length; j++) {
      const c = link.points[j - 1], d = link.points[j], otherHorizontal = c.y === d.y;
      if (horizontal === otherHorizontal) {
        if (horizontal && a.y === c.y) overlap += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)));
        if (!horizontal && a.x === c.x) overlap += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)));
        continue;
      }
      const x = horizontal ? c.x : a.x, y = horizontal ? a.y : c.y;
      if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x) || y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y) ||
        x < Math.min(c.x, d.x) || x > Math.max(c.x, d.x) || y < Math.min(c.y, d.y) || y > Math.max(c.y, d.y)) continue;
      const point = { x, y };
      if ([points[0], points.at(-1)!].some(p => same(p, point)) && [link.points[0], link.points.at(-1)!].some(p => same(p, point))) continue;
      crossings.add(`${link.from}:${link.to}:${x}:${y}`);
    }
  }
  return crossings.size * 10_000 + overlap * 8 + length + (points.length - 2) * 14;
}

/** Read-only orthogonal routing: separate ports, clear gutters and no strokes behind cards. */
export function layoutSkillLinks(model: SkillTreeModel, layout: SkillTreeLayout): SkillLink[] {
  const boxes = model.nodes.map(node => {
    const p = layout.positions[node.id];
    return { id: node.id, left: p.x, right: p.x + layout.cardWidth, top: p.y, bottom: p.y + layout.cardHeight };
  });
  const columns = [...new Set(boxes.map(box => box.left))].sort((a, b) => a - b);
  const corridors = [...new Set([12, ...boxes.flatMap(box => [box.top - 13, box.bottom + 13]), layout.height - 8])]
    .filter(y => y >= 8 && y <= layout.height - 8).sort((a, b) => a - b);
  const branchOf = new Map(model.nodes.map(node => [node.id, node.branch]));
  const skip = (edge: SkillEdge) => columns.indexOf(layout.positions[edge.to].x) - columns.indexOf(layout.positions[edge.from].x) > 1;
  const side = (edge: SkillEdge) => {
    const branch = branchOf.get(edge.from), center = layout.positions[edge.from].y;
    const neighbours = model.edges.flatMap(link => branchOf.get(link.from) === branch && branchOf.get(link.to) !== branch ? [layout.positions[link.to].y]
      : branchOf.get(link.to) === branch && branchOf.get(link.from) !== branch ? [layout.positions[link.from].y] : []);
    return neighbours.length && neighbours.reduce((sum, y) => sum + y, 0) / neighbours.length < center ? 1 : -1;
  };
  const portOrder = (edge: SkillEdge, outgoing: boolean) => skip(edge) ? side(edge) * 1_000_000 : layout.positions[outgoing ? edge.to : edge.from].y;
  const outgoing = (id: string) => model.edges.filter(edge => edge.from === id).sort((a, b) => portOrder(a, true) - portOrder(b, true) || a.to.localeCompare(b.to));
  const incoming = (id: string) => model.edges.filter(edge => edge.to === id).sort((a, b) => portOrder(a, false) - portOrder(b, false) || a.from.localeCompare(b.from));
  const edges = model.edges.slice().sort((a, b) => {
    const span = (edge: SkillEdge) => Math.abs(layout.positions[edge.to].x - layout.positions[edge.from].x);
    const rise = (edge: SkillEdge) => Math.abs(layout.positions[edge.to].y - layout.positions[edge.from].y);
    return span(a) - span(b) || rise(b) - rise(a) || layout.positions[a.from].y - layout.positions[b.from].y || a.from.localeCompare(b.from) || a.to.localeCompare(b.to);
  });
  const routed: SkillLink[] = [];
  for (const edge of edges) {
    const from = layout.positions[edge.from], to = layout.positions[edge.to];
    const children = outgoing(edge.from), parents = incoming(edge.to);
    // Keep fan-out ports off neighbouring input levels, avoiding ambiguous T junctions.
    const portOffset = children.length > 1 ? Math.min(4, layout.cardHeight / (2 * (children.length + 1))) : 0;
    const start = { x: from.x + layout.cardWidth, y: from.y + portOffset + layout.cardHeight * (children.findIndex(item => item.to === edge.to) + 1) / (children.length + 1) };
    const end = { x: to.x - 4, y: to.y + layout.cardHeight * (parents.findIndex(item => item.from === edge.from) + 1) / (parents.length + 1) };
    const next = columns.find(x => x > from.x) ?? layout.width;
    const previous = columns.slice().reverse().find(x => x < to.x);
    const sourceGap = next - start.x, targetGap = to.x - (previous === undefined ? to.x - 32 : previous + layout.cardWidth);
    const offsets = (gap: number) => [...new Set(gap >= 24 ? [8, gap * .25, gap * .5, gap * .75, gap - 8] : [gap / 2])].sort((a, b) => a - b);
    const sources = offsets(sourceGap).map(offset => start.x + offset);
    const targets = offsets(targetGap).map(offset => to.x - offset);
    const candidates: SkillPosition[][] = [];
    if (to.x > from.x && next === to.x) for (const x of sources) candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]);
    const clearRows = skip(edge) ? corridors.filter(y => side(edge) < 0 ? y < Math.min(from.y, to.y) - 7 : y > Math.max(from.y, to.y) + layout.cardHeight + 7) : corridors;
    for (const source of sources) for (const target of targets) for (const y of clearRows) {
      candidates.push([start, { x: source, y: start.y }, { x: source, y }, { x: target, y }, { x: target, y: end.y }, end]);
    }
    let best: SkillPosition[] | undefined, bestCost = Infinity;
    for (const candidate of candidates) {
      const points = simplify(candidate);
      if (blocked(points, boxes, edge)) continue;
      const cost = routeCost(points, routed);
      if (cost < bestCost) { best = points; bestCost = cost; }
    }
    // Column-aligned layouts always have an outside corridor; retain a visible edge for legacy/custom layouts.
    const points = best ?? [start, { x: sources[0], y: start.y }, { x: sources[0], y: 8 }, { x: targets[0], y: 8 }, { x: targets[0], y: end.y }, end];
    routed.push({ ...edge, points, path: points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ") });
  }
  return routed;
}
