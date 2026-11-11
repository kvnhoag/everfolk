import type { ActivityAvailability, CharacterActivity, JobDefinition, LifeState, WorldPack } from "../../src/types.ts";
import { availability } from "../../src/demo/availability.ts";
import { UNAVAILABLE_REASON } from "../../src/demo/types.ts";
import { buildSkillTree, practiceBlockReason } from "./skill-tree.ts";
import { routeRequirements } from "./late-skill-routes.ts";

export type CareerState = "Ready" | "Locked" | "Unavailable" | "Current" | "Earned";
export interface CareerAction {
  activity: ActivityAvailability;
  reason: string | null;
  requirements: { text: string; met: boolean }[];
}
export interface CareerNode {
  job: JobDefinition;
  branch: string;
  skillIds: string[];
  foundationIds: string[];
  state: CareerState;
  economy: string[];
  actions: CareerAction[];
}

/** Job links are authored effects, not guesses based on activity names. */
function takesJob(activity: CharacterActivity, id: string): boolean {
  return activity.outcomes.some(outcome => {
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "job" && effect.job === id) return true;
    }
    return false;
  });
}

function careerEconomy(world: WorldPack, job: JobDefinition): string[] {
  const economy = world.economy;
  const income = job.yearlyEffects.reduce((sum, effect) => sum + (effect.type === "cash" ? effect.delta
    : effect.type === "stat" && effect.stat === economy?.stat ? effect.delta * economy.unitsPerPoint : 0), 0);
  const lines = income ? [`Yearly work income before household costs: ${income} ${economy?.currency.short ?? "cash"}.`] : [];
  if (world.demo && ["farmhand", "tenant-farmer", "grain-dealer"].includes(job.id)) {
    lines.push("Income comes from the harvest and sales, rather than a fixed wage. Farming improves the harvest; working the plot competes with service.");
    lines.push(`Rent takes ${world.demo.household.rentBps / 100}% of the harvest. Grain feeds the household before the surplus can be sold.`);
    if (job.id === "grain-dealer") lines.push(`The dealer adds ${world.demo.household.dealerExtraCapacity} grain capacity and can sell to the army when its market contract opens. Reckoning reduces storage losses.`);
  }
  if (world.demo && job.id === "soldier") {
    const service = world.demo.service;
    lines.push(`Base yearly wages: ${service.wage.quiet} / ${service.wage.recruiting} / ${service.wage.war} ${economy?.currency.short ?? "cash"} in quiet / recruitment / war years, paid only as far as the army purse allows.`);
    lines.push(`The army supplies up to ${service.ration} grain in rations. Service takes your labour off the farm; warfare and preparation affect convoy outcomes.`);
  }
  return lines.length ? lines : ["No fixed cash income is authored for this occupation."];
}

/** A generated, read-only map of the world's actual rules. Every action still goes through the engine. */
export function buildCareerEconomyTree(world: WorldPack, life: LifeState, activities: readonly ActivityAvailability[]) {
  const tree = buildSkillTree(world, life, activities);
  const bySkill = new Map(tree.nodes.map(node => [node.id, node]));
  const foundations = (ids: string[], seen = new Set<string>()): string[] => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      foundations(bySkill.get(id)?.requirements.map(item => item.id) ?? [], seen);
    }
    return [...seen];
  };
  const action = (declared: CharacterActivity): CareerAction => {
    const activity = activities.find(item => item.id === declared.id) ?? { ...declared, available: false, reason: "Not available in the current life state." };
    return {
      activity,
      reason: availability(world.demo, "activity", declared.id).status === "unavailable" ? UNAVAILABLE_REASON : practiceBlockReason(activity, life) ?? null,
      requirements: [
        ...(declared.minAge ? [{ text: `Age ${declared.minAge}+`, met: life.age >= declared.minAge }] : []),
        ...routeRequirements(declared.when, world, life),
      ],
    };
  };
  const careers = (world.character?.jobs ?? []).map((job): CareerNode => {
    const required = Object.entries(job.requirements ?? {}).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const grown = job.yearlyEffects.flatMap(effect => effect.type === "skill" && effect.delta > 0 ? [effect.skill] : []);
    const skillIds = [...new Set([...required, ...grown])];
    const actions = (world.character?.activities ?? []).filter(activity => takesJob(activity, job.id)).map(action);
    return {
      job, skillIds, foundationIds: foundations(skillIds), actions,
      branch: bySkill.get(skillIds[0])?.branch ?? "Other livelihoods",
      state: availability(world.demo, "job", job.id).status === "unavailable" ? "Unavailable"
        : life.character?.jobId === job.id ? "Current" : actions.some(item => !item.reason) ? "Ready" : "Locked",
      economy: careerEconomy(world, job),
    };
  });
  const routes = (world.legacy?.routes ?? []).map(route => {
    const nodes = (ids: string[]) => ids.flatMap(id => {
      const achievement = world.legacy?.achievements.find(item => item.id === id);
      if (!achievement) return [];
      const actions = (world.character?.activities ?? []).filter(activity => activity.outcomes.some(outcome =>
        outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id))).map(action);
      const state: CareerState = life.accomplishments?.some(record => record.achievementId === id) ? "Earned"
        : availability(world.demo, "accomplishment", id).status === "unavailable" ? "Unavailable"
        : actions.some(item => !item.reason) ? "Ready" : "Locked";
      return [{ achievement, actions, state }];
    });
    const staged = new Set(route.stages?.flatMap(stage => stage.achievementIds) ?? []);
    const entries = route.achievementIds.filter(id => !staged.has(id));
    return { ...route, foundationIds: foundations(route.skillIds), stages: [
      ...(entries.length ? [{ title: "First accomplishments", nodes: nodes(entries) }] : []),
      ...(route.stages ?? []).map(stage => ({ title: stage.title, nodes: nodes(stage.achievementIds) })),
    ] };
  });
  return {
    skills: tree.nodes, careers, routes,
    branches: [...new Set([...tree.branches, ...careers.map(node => node.branch)])],
    links: [
      ...tree.edges.map(edge => ({ from: `skill:${edge.from}`, to: `skill:${edge.to}`, required: edge.threshold, kind: "requires" as const })),
      ...careers.flatMap(node => Object.entries(node.job.requirements ?? {}).map(([id, required]) => ({ from: `skill:${id}`, to: `job:${node.job.id}`, required, kind: "requires" as const }))),
      ...careers.flatMap(node => node.job.yearlyEffects.flatMap(effect => effect.type === "skill" && effect.delta > 0
        ? [{ from: `job:${node.job.id}`, to: `skill:${effect.skill}`, required: 0, kind: "develops" as const }] : [])),
      ...routes.flatMap(route => route.jobIds.filter(id => careers.some(node => node.job.id === id)).map(id => ({ from: `job:${id}`, to: `route:${route.id}`, required: 0, kind: "path" as const }))),
    ],
    futurePaths: world.demo?.availability.futurePaths ?? [],
  };
}
