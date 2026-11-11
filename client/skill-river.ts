import type { SkillEdge, SkillNode, SkillTreeModel } from './skill-tree.ts';

export const SKILL_RIVER_REVISION = 9;
export interface RiverGroup { label: string; nodes: SkillNode[]; stages: SkillNode[][] }
export interface RiverBox { x: number; y: number; width: number; height: number }

/** CSS containers own placement. Only authored metadata determines grouping. */
export function skillRiverGroups(model: SkillTreeModel): RiverGroup[] {
  const order = [...new Set([...model.branches, ...model.nodes.map(node => node.branch)])];
  return order.filter(label => model.nodes.some(node => node.branch === label)).map(label => {
    const nodes = model.nodes.filter(node => node.branch === label).sort((a,b) => a.tier - b.tier || a.id.localeCompare(b.id));
    const stageCount = Math.max(1, ...nodes.map(node => node.tier + 1));
    return { label, nodes, stages: Array.from({length:stageCount}, (_,tier) => nodes.filter(node => node.tier === tier)) };
  });
}

/** Supplementary conditions remain authored requirements; reveal them on exploration. */
export function isMainRiverEdge(edge: SkillEdge, model: SkillTreeModel): boolean {
  const from = model.nodes.find(node => node.id === edge.from), to = model.nodes.find(node => node.id === edge.to);
  return !!from && !!to && from.branch === to.branch && to.tier === from.tier + 1;
}

/** Conditions outside the nearby branch are explained in notes, never long links. */
export function skillRequirementNotes(node: SkillNode, model: SkillTreeModel) {
  return node.requirements.filter(requirement => !isMainRiverEdge({
    from:requirement.id, to:node.id, threshold:requirement.required, met:requirement.met,
  },model));
}

/** Anchored to measured buttons, never a fixed viewport or translated label. */
export function skillRiverPath(from: RiverBox, to: RiverBox, main: boolean): string {
  if (main) {
    const x = from.x + from.width/2, y = from.y + from.height + 2;
    const endX = to.x + to.width/2, endY = to.y - 4;
    return `M ${x} ${y} L ${endX} ${endY}`;
  }
  const right = to.x >= from.x;
  const x = right ? from.x+from.width+3 : from.x-3, y=from.y+from.height/2;
  const endX=right ? to.x-5 : to.x+to.width+5, endY=to.y+to.height/2;
  return `M ${x} ${y} L ${endX} ${endY}`;
}
