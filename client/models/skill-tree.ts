import type { ActivityAvailability, CharacterActivity, Condition, JobDefinition, LifeState, SkillDefinition, WorldPack } from "../../src/types.ts";
import { getSkillImpact } from "./skill-impact.ts";
import { formatYear } from "../../src/calendar.ts";
import { royalAudienceAllowed } from "../../src/royalty.ts";
import { isPrivilegedLife } from "../../src/aristocracy.ts";

export type SkillState = "locked" | "ready" | "learning" | "mastered";
export interface SkillRequirement { id: string; label: string; value: number; required: number; met: boolean }
export interface SkillCareer { job: JobDefinition; requirements: SkillRequirement[]; ageMet: boolean; thresholdsMet: boolean; activities: ActivityAvailability[] }
export interface SkillNode {
  id: string; label: string; description: string; branch: string; tier: number;
  value: number; min: number; max: number; progress: number; state: SkillState;
  requirements: SkillRequirement[]; minAge: number; ageMet: boolean;
  training: ActivityAvailability[]; canPractice: boolean; careers: SkillCareer[]; paidWork: ActivityAvailability[];
}
export interface SkillEdge { from: string; to: string; threshold: number; met: boolean }
export interface SkillTreeModel { nodes: SkillNode[]; edges: SkillEdge[]; branches: string[]; otherTraining: ActivityAvailability[] }

/** Keep future, unlearned paths in the wiki rather than the current skill view.
 * Temporary action, cash and choice restrictions never hide earned progress. */
export function currentSkillTree(model: SkillTreeModel): SkillTreeModel {
  const nodes = model.nodes.filter(node => node.state !== "locked" || node.value > node.min);
  const visible = new Set(nodes.map(node => node.id));
  return {
    nodes,
    edges: model.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to)),
    branches: model.branches.filter(branch => nodes.some(node => node.branch === branch)),
    otherTraining: model.otherTraining,
  };
}

const knownBranches: Record<string, string> = {
  craft: "Crafts", pottery: "Crafts", carving: "Crafts", sculpture: "Crafts",
  literacy: "Letters & ideas", oratory: "Letters & ideas", philosophy: "Letters & ideas",
  reckoning: "Numbers & sky", astronomy: "Numbers & sky", astrology: "Numbers & sky",
  seamanship: "Practical service", warfare: "Practical service",
};
const descriptions: Record<string, string> = {
  craft: "Learn to use tools, measure materials and repair everyday objects.",
  pottery: "Shape clay, fire useful vessels and learn a potter’s trade.",
  carving: "Cut patterns and useful forms into wood and stone.",
  sculpture: "Work with proportion and detail to shape figures in stone or clay.",
  literacy: "Read letters and keep simple written records.",
  oratory: "Practice speaking clearly before a group and making a case.",
  philosophy: "Study arguments, ask questions and discuss different schools of thought.",
  reckoning: "Count goods, compare measures and keep accounts.",
  astronomy: "Observe the sky and learn to calculate the movements of stars and planets.",
  astrology: "Study the period’s methods of interpreting celestial signs.",
  seamanship: "Handle ropes, sails and the daily work aboard a boat.",
  warfare: "Practice weapons, formations and the discipline of military service.",
};

/** Only lower bounds that every successful branch necessarily satisfies become edges.
 * This is a display fallback for old packs, never an additional simulation rule. */
export function guaranteedSkillRequirements(condition?: Condition): Record<string, number> {
  if (!condition) return {};
  if (condition.type === "skill") {
    return (condition.op === "gte" || condition.op === "eq") && condition.value > 0
      ? { [condition.skill]: condition.value } : {};
  }
  if (condition.type !== "all" && condition.type !== "any") return {};
  const parts = condition.conditions.map(guaranteedSkillRequirements);
  if (condition.type === "all") {
    const result: Record<string, number> = {};
    for (const part of parts) for (const [id, value] of Object.entries(part)) result[id] = Math.max(result[id] ?? 0, value);
    return result;
  }
  if (!parts.length) return {};
  return Object.fromEntries(Object.keys(parts[0]).filter(id => parts.every(part => id in part))
    .map(id => [id, Math.min(...parts.map(part => part[id]))]));
}

function trains(activity: CharacterActivity, id: string): boolean {
  return activity.category === "training" && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "skill" && effect.skill === id && effect.delta > 0));
}

function gainsSkill(effects: CharacterActivity["outcomes"][number]["effects"], id: string): boolean {
  return effects.some(effect => effect.type === "skill" && effect.skill === id && effect.delta > 0);
}

/** Paid tasks never include accepting, leaving or changing an occupation. */
function isPaidWork(activity: CharacterActivity, world: WorldPack): boolean {
  if (activity.category !== "career" || activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job"))) return false;
  return activity.outcomes.some(outcome => {
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "cash" && effect.delta > 0 ||
        effect.type === "stat" && effect.stat === (world.economy?.stat ?? "wealth") && effect.delta > 0) return true;
    }
    return false;
  });
}

/** Display only requirements shared by every route; availability stays in the engine. */
export function skillActionRequirements(activity: CharacterActivity, world: WorldPack): string[] {
  const describe = (condition?: Condition): string[] => {
    if (!condition) return [];
    if (condition.type === "all") return [...new Set(condition.conditions.flatMap(describe))];
    if (condition.type === "any") {
      const alternatives = condition.conditions.map(describe);
      return alternatives.length ? alternatives[0].filter(note => alternatives.every(notes => notes.includes(note))) : [];
    }
    if (condition.type === "skill" && (condition.op === "gte" || condition.op === "eq") && condition.value > 0) {
      return [`${world.character?.skills[condition.skill]?.label ?? condition.skill} ${condition.value}`];
    }
    if (condition.type === "asset" && (condition.op === "gte" || condition.op === "eq") && condition.value > 0) {
      const asset = world.economy?.assets.find(asset => asset.id === condition.asset);
      return [`Own ${asset?.title.toLocaleLowerCase() ?? condition.asset}${condition.value > 1 ? ` (${condition.value})` : ""}`];
    }
    if (condition.type === "cash" && condition.op === "gte" && condition.value > 0) return [`Cash at least ${condition.value} ${world.economy?.currency.short ?? ""}`.trim()];
    if ((condition.type === "royal" || condition.type === "aristocrat") && condition.metric === "treasury" && condition.op === "gte" && condition.value > 0) {
      const config = condition.type === "royal" ? world.royalty : world.aristocracy;
      return [`${config?.metrics.treasury.label ?? "Household treasury"} at least ${condition.value} ${world.economy?.currency.short ?? ""}`.trim()];
    }
    if (condition.type === "year" && condition.value !== 0) {
      const relation = { gte: "From", gt: "After", lt: "Before", lte: "Through", eq: "In", ne: undefined }[condition.op];
      return relation ? [`${relation} ${formatYear(condition.value)}`] : [];
    }
    return [];
  };
  return [
    ...(activity.minAge ? [`Age ${activity.minAge}+`] : []),
    ...describe(activity.when),
    ...((activity.cooldownYears ?? 1) > 1 ? [`Every ${activity.cooldownYears} years`] : []),
  ];
}

/** Canonical training avoids mistaking a secondary skill gain for a separate route. */
function trainingFor(id: string, definition: SkillDefinition, activities: readonly ActivityAvailability[]): ActivityAvailability[] {
  const exact = definition.trainingActivity && activities.find(activity => activity.id === definition.trainingActivity);
  const conventional = activities.find(activity => activity.id === `train-${id}` && trains(activity, id));
  return exact ? [exact] : conventional ? [conventional] : activities.filter(activity => trains(activity, id));
}

export function practiceBlockReason(activity: ActivityAvailability, life: LifeState): string | undefined {
  if (life.phase === "ended") return "This life has ended.";
  if (life.phase === "choice") return "Make the pending choice first.";
  if (activity.usesYearlyActivity !== false && life.character?.lastActivityAge === life.age) return "Action used. Available next year.";
  return activity.available ? undefined : activity.reason ?? "Unavailable right now.";
}

/** A read-only projection of the current rules and engine-supplied availability. */
export function buildSkillTree(world: WorldPack, life: LifeState, activities: readonly ActivityAvailability[]): SkillTreeModel {
  if (!world.character || !life.character) return { nodes: [], edges: [], branches: [], otherTraining: [] };
  const definitions = world.character.skills;
  const current = life.character.skills;
  // Read unlock metadata even in a choice preview that has no activity buttons.
  const declaredActivities = world.character.activities.filter(activity => royalAudienceAllowed(world, life, activity.audience)).map(activity => ({ ...activity, available: false }));
  const requirement = (id: string, required: number): SkillRequirement => ({ id, label: definitions[id]?.label ?? id, value: current[id] ?? definitions[id]?.min ?? 0, required, met: (current[id] ?? definitions[id]?.min ?? 0) >= required });
  const nodes = Object.entries(definitions).map(([id, definition]): SkillNode => {
    const training = trainingFor(id, definition, activities);
    const declaredTraining = trainingFor(id, definition, declaredActivities);
    // Multiple fallback routes must share a prerequisite before it becomes an edge.
    const fallback = declaredTraining.length ? guaranteedSkillRequirements({ type: "any", conditions: declaredTraining.map(activity => activity.when ?? { type: "all", conditions: [] }) }) : {};
    const requirements = Object.entries(definition.prerequisites ?? fallback)
      .filter(([parent, threshold]) => parent !== id && parent in definitions && threshold > 0)
      .map(([parent, threshold]) => requirement(parent, threshold));
    const minAge = declaredTraining.length ? Math.min(...declaredTraining.map(activity => activity.minAge ?? 0)) : 0;
    const value = current[id] ?? definition.min;
    const ageMet = life.age >= minAge;
    const unlocked = ageMet && requirements.every(item => item.met);
    const careers = world.character!.jobs.filter(job => !isPrivilegedLife(world, life) && (id in (job.requirements ?? {}) || gainsSkill(job.yearlyEffects, id))).map((job): SkillCareer => {
      const requirements = Object.entries(job.requirements ?? {}).map(([skill, threshold]) => requirement(skill, threshold));
      return {
        job, requirements, ageMet: life.age >= job.minAge,
        thresholdsMet: life.age >= job.minAge && requirements.every(item => item.met),
        activities: activities.filter(activity => activity.category === "career" && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === job.id))),
      };
    });
    return {
      id, label: definition.label, description: definition.description ?? descriptions[id] ?? `Develop ${definition.label.toLocaleLowerCase()} through practice.`,
      branch: definition.branch ?? knownBranches[id] ?? "Other studies", tier: definition.tier ?? 0,
      value, min: definition.min, max: definition.max, progress: Math.max(0, Math.min(1, (value - definition.min) / (definition.max - definition.min || 1))),
      requirements, minAge, ageMet, training, careers,
      paidWork: activities.filter(activity => isPaidWork(activity, world) &&
        (id in guaranteedSkillRequirements(activity.when) || activity.outcomes.some(outcome => gainsSkill(outcome.effects, id))))
        .sort((left, right) => Number(right.available) - Number(left.available)),
      state: value >= definition.max ? "mastered" : !unlocked ? "locked" : value > definition.min ? "learning" : "ready",
      canPractice: unlocked && value < definition.max && training.some(activity => !practiceBlockReason(activity, life)),
    };
  });
  const byId = new Map(nodes.map(node => [node.id, node]));
  const resolved = new Map<string, number>();
  function tier(id: string, visiting = new Set<string>()): number {
    if (resolved.has(id)) return resolved.get(id)!;
    const node = byId.get(id)!;
    if (visiting.has(id)) return node.tier; // Legacy packs can have alternative-route cycles.
    const next = new Set(visiting).add(id);
    const value = Math.max(node.tier, 0, ...node.requirements.filter(item => !next.has(item.id)).map(item => tier(item.id, next) + 1));
    resolved.set(id, value);
    return value;
  }
  for (const node of nodes) node.tier = tier(node.id);
  const branchOrder = ["Crafts", "Letters & ideas", "Numbers & sky", "Practical service"];
  const branches = [...new Set(nodes.map(node => node.branch))].sort((a, b) => {
    const left = branchOrder.indexOf(a), right = branchOrder.indexOf(b);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
  });
  const assigned = new Set(nodes.flatMap(node => node.training.map(activity => activity.id)));
  return {
    nodes, branches,
    edges: nodes.flatMap(node => node.requirements.map(item => ({ from: item.id, to: node.id, threshold: item.required, met: item.met }))),
    otherTraining: activities.filter(activity => activity.category === "training" && !assigned.has(activity.id)),
  };
}

export interface SkillPosition { x: number; y: number }
export interface SkillTreeLayout {
  width: number; height: number; cardWidth: number; cardHeight: number; tierCount: number;
  tierX: number[];
  positions: Record<string, SkillPosition>; branches: { label: string; y: number; height: number }[];
}

/** Place connected branch bands together, then reduce crossings within their
 * fixed tiers. Only topology affects ordering; proficiency never moves cards. */
export function layoutSkillTree(model: SkillTreeModel): SkillTreeLayout {
  const cardWidth = 158, cardHeight = 100, columnGap = 56, rowGap = 14, gutter = 100, top = 48;
  const tierCount = Math.max(1, ...model.nodes.map(node => node.tier + 1));
  const tierX = Array.from({ length: tierCount }, (_, tier) => gutter + tier * (cardWidth + columnGap));
  const byId = new Map(model.nodes.map(node => [node.id, node]));
  const labels = [...new Set([...model.branches, ...model.nodes.map(node => node.branch)])];
  const rank = new Map(labels.map((label, index) => [label, index]));
  const adjacency = new Map(labels.map(label => [label, new Set<string>()]));
  const edges = model.edges.filter(edge => byId.has(edge.from) && byId.has(edge.to));
  for (const edge of edges) {
    const from = byId.get(edge.from)!.branch, to = byId.get(edge.to)!.branch;
    if (from !== to) { adjacency.get(from)!.add(to); adjacency.get(to)!.add(from); }
  }
  // Connected components prevent an unrelated branch from splitting a link.
  // Iterative traversal also handles cycles in older/custom display graphs.
  const seen = new Set<string>(), component = new Map<string, number>();
  const order: string[] = [];
  for (const label of labels) {
    if (seen.has(label)) continue;
    const pending = [label], group: string[] = [];
    seen.add(label);
    while (pending.length) {
      const next = pending.pop()!;
      group.push(next);
      for (const neighbour of adjacency.get(next)!) if (!seen.has(neighbour)) { seen.add(neighbour); pending.push(neighbour); }
    }
    group.sort((a, b) => rank.get(a)! - rank.get(b)!);
    for (const member of group) component.set(member, order.length);
    order.push(...group);
  }
  const columns = new Map<string, string[][]>();
  for (const label of labels) columns.set(label, Array.from({ length: tierCount }, () => []));
  for (const node of [...model.nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) columns.get(node.branch)![node.tier].push(node.id);
  function place(): SkillTreeLayout {
    const positions: Record<string, SkillPosition> = {};
    let y = top;
    const branches = order.map(label => {
      const branchColumns = columns.get(label)!;
      const rows = Math.max(1, ...branchColumns.map(column => column.length));
      const height = rows * (cardHeight + rowGap) + 14;
      const branch = { label, y, height };
      branchColumns.forEach((column, tier) => column.forEach((id, index) => {
        positions[id] = { x: tierX[tier],
          y: y + 7 + index * (cardHeight + rowGap) + (rows - column.length) * (cardHeight + rowGap) / 2 };
      }));
      y += height;
      return branch;
    });
    return { width: gutter + tierCount * (cardWidth + columnGap) - columnGap + 18, height: y + 8, cardWidth, cardHeight, tierCount, tierX, positions, branches };
  }
  const orientation = (a: SkillPosition, b: SkillPosition, c: SkillPosition) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  function score(layout: SkillTreeLayout): [number, number] {
    const segments = edges.map(edge => ({ edge,
      from: { x: layout.positions[edge.from].x + cardWidth, y: layout.positions[edge.from].y + cardHeight / 2 },
      to: { x: layout.positions[edge.to].x - 4, y: layout.positions[edge.to].y + cardHeight / 2 },
    }));
    let crossings = 0;
    // Avoid quadratic work for unusually dense custom packs; their bounded
    // ordering search still shortens links using the same topology-only score.
    if (segments.length <= 256) for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i], b = segments[j];
      if (a.edge.from === b.edge.from || a.edge.to === b.edge.to || a.edge.from === b.edge.to || a.edge.to === b.edge.from) continue;
      if (orientation(a.from, a.to, b.from) * orientation(a.from, a.to, b.to) < 0 &&
        orientation(b.from, b.to, a.from) * orientation(b.from, b.to, a.to) < 0) crossings++;
    }
    return [crossings, segments.reduce((sum, segment) => sum + Math.abs(segment.to.y - segment.from.y), 0)];
  }
  const better = (a: [number, number], b: [number, number]) => a[0] < b[0] || a[0] === b[0] && a[1] < b[1];
  let layout = place(), best = score(layout), evaluations = 0;
  const tryChange = (change: () => void, undo: () => void): boolean => {
    if (++evaluations > 512) return false;
    change();
    const candidate = place(), candidateScore = score(candidate);
    if (better(candidateScore, best)) { layout = candidate; best = candidateScore; return true; }
    undo(); return false;
  };
  for (let pass = 0; pass < 8 && evaluations < 512; pass++) {
    let improved = false;
    for (let index = 0; index + 1 < order.length; index++) {
      if (component.get(order[index]) !== component.get(order[index + 1])) continue;
      const swap = () => { [order[index], order[index + 1]] = [order[index + 1], order[index]]; };
      improved = tryChange(swap, swap) || improved;
    }
    for (const label of order) for (const column of columns.get(label)!) {
      if (column.length < 2) continue;
      const original = [...column];
      const neighbours = (id: string) => edges.flatMap(edge => edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []);
      const barycentre = (id: string) => {
        const adjacent = neighbours(id);
        return adjacent.length ? adjacent.reduce((sum, next) => sum + layout.positions[next].y, 0) / adjacent.length : layout.positions[id].y;
      };
      const proposed = [...column].sort((a, b) => barycentre(a) - barycentre(b) || original.indexOf(a) - original.indexOf(b));
      improved = tryChange(() => { column.splice(0, column.length, ...proposed); }, () => { column.splice(0, column.length, ...original); }) || improved;
      for (let index = 0; index + 1 < column.length; index++) {
        const swap = () => { [column[index], column[index + 1]] = [column[index + 1], column[index]]; };
        improved = tryChange(swap, swap) || improved;
      }
    }
    if (!improved) break;
  }
  return layout;
}

/** Exact bounded skill previews, using the same effect order as the simulation. */
export function trainingSkillChanges(activity: ActivityAvailability, world: WorldPack, life: LifeState): { id: string; label: string; min: number; max: number }[] {
  return getSkillImpact(activity, life, world).map(({ variable: _variable, ...change }) => change);
}
