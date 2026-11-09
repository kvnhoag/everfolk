import type { ActivityAvailability, Choice, LifeState, WorldPack } from "../src/types.ts";
import { buildSkillTree } from "./skill-tree.ts";
import { getSkillImpact } from "./skill-impact.ts";
import { activeEarlyInfluences, previewEarlyInfluences } from "./early-influences.ts";
import type { EarlyInfluence } from "./early-influences.ts";

/** A display projection only: previewing never rolls an outcome or spends an action. */
export function compactSkillPreview(world: WorldPack, life: LifeState, choice?: Choice | null, activities: readonly ActivityAvailability[] = []) {
  const model = buildSkillTree(world, life, activities);
  const changes = choice ? getSkillImpact(choice, life, world) : [];
  const early = choice ? previewEarlyInfluences(choice, world, life) : [];
  const futureSkills = new Map<string, number>();
  for (const influence of early) for (const skill of influence.skills) futureSkills.set(skill.id, Math.max(futureSkills.get(skill.id) ?? 1, skill.multiplier));
  const affected = new Set(changes.map(change => change.id));
  for (const id of futureSkills.keys()) affected.add(id);
  const context = new Set(affected);
  function parents(id: string) {
    for (const edge of model.edges.filter(edge => edge.to === id)) {
      if (context.has(edge.from)) continue;
      context.add(edge.from);
      parents(edge.from);
    }
  }
  for (const id of affected) parents(id);
  return { ...model, changes, affected, context, previewing: Boolean(choice), earlyInfluences: early, futureSkills };
}

/** Pick one useful branch without changing the authored tree or the life. */
export function compactSkillView(model: ReturnType<typeof compactSkillPreview>, life: LifeState, selectedBranch?: string, previewOnly = false) {
  const score = (branch: string) => {
    const nodes = model.nodes.filter(node => node.branch === branch);
    return {
      relevant: nodes.some(node => node.careers.some(career => career.job.id === life.character?.jobId)),
      progress: nodes.reduce((sum, node) => sum + node.progress, 0) / (nodes.length || 1),
    };
  };
  const preferred = model.branches.reduce<string | undefined>((best, branch) => {
    if (!best) return branch;
    const previous = score(best), candidate = score(branch);
    return Number(candidate.relevant) > Number(previous.relevant) || candidate.relevant === previous.relevant && candidate.progress > previous.progress ? branch : best;
  }, undefined);
  const branch = selectedBranch && model.branches.includes(selectedBranch) ? selectedBranch : preferred;
  const affectedBranches = new Set(model.nodes.filter(node => model.affected.has(node.id)).map(node => node.branch));
  const nodes = previewOnly ? model.nodes.filter(node => model.context.has(node.id))
    : model.previewing ? model.nodes.filter(node => affectedBranches.has(node.branch) || model.context.has(node.id))
    : model.nodes.filter(node => node.branch === branch);
  return { branch, nodes, branches: model.branches.filter(branch => nodes.some(node => node.branch === branch)) };
}

export interface ProgressFeedback {
  key: string;
  skills: { id: string; label: string; delta: number; value: number; max: number }[];
  accomplishments: { id: string; name: string; title: string }[];
  influences?: EarlyInfluence[];
}

/** Report observed changes, including resolved follow-ups, rather than the previewed range. */
export function choiceProgressFeedback(before: LifeState, after: LifeState, world: WorldPack): ProgressFeedback | null {
  if (before.worldFingerprint !== after.worldFingerprint || before.seed !== after.seed || after.commands.length <= before.commands.length ||
    !after.commands.slice(before.commands.length).some(command => command.type === "choose")) return null;
  const skills = Object.entries(world.character?.skills ?? {}).flatMap(([id, definition]) => {
    const initial = before.character?.skills[id] ?? definition.min;
    const value = after.character?.skills[id] ?? definition.min;
    return value === initial ? [] : [{ id, label: definition.label, delta: value - initial, value, max: definition.max }];
  });
  const previous = new Set((before.accomplishments ?? []).map(record => record.id));
  const accomplishments = (after.accomplishments ?? []).filter(record => !previous.has(record.id)).map(({ id, name, title }) => ({ id, name, title }));
  const influences = activeEarlyInfluences(world, after).filter(item => !before.flags[item.flag]);
  return skills.length || accomplishments.length || influences.length ? { key: `${after.worldFingerprint}:${after.seed}:${after.commands.length}`, skills, accomplishments, ...(influences.length ? { influences } : {}) } : null;
}
