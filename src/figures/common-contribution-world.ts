import type { Condition, WorldPack } from "../types.ts";

export const COMMON_CONTRIBUTION_WORLD_VERSION = "alexandria-lives-8";
export const DEEP_COMMON_CONTRIBUTION_WORLD_VERSION = "alexandria-figures-3";
const commonWork = {
  alexander: { title: "Campaign Stores Aide", traditionTitle: "Aide in Macedonian Supply Studies", work: "Sort and tally a small issue of campaign stores", description: "A checked tally of a small stores issue establishes useful entry-level campaign work." },
  aristotle: { title: "Inquiry Note Keeper", traditionTitle: "Keeper of Aristotelian Inquiry Notes", work: "Organise inquiry notes and check their labels", description: "An organised and checked set of inquiry notes assists the school before independent comparison is attempted." },
  euclid: { title: "Diagram Aide", traditionTitle: "Aide in Geometrical Diagram Studies", work: "Label and check an elementary geometrical diagram", description: "A labelled, checked elementary diagram provides a first practical contribution to geometrical study." },
  lysippos: { title: "Bronze Workshop Aide", traditionTitle: "Aide in Lysippan Workshop Practice", work: "Prepare clay and measure a small workshop study", description: "Prepared materials and a checked small study support the workshop before a complete measured model is undertaken." },
  menander: { title: "Rehearsal Aide", traditionTitle: "Aide in New Comedy Rehearsal", work: "Organise scene copies and record rehearsal cues", description: "Usable scene copies and checked rehearsal cues support a performance before revising a dramatic scene." },
} as const;
const earlierNode: Record<string, string> = { T3: "T1", P3: "P1", PS6: "P3", AS5: "A1" };
const earned = (achievement: string): Condition => ({ type: "accomplishment", achievement });
const withPrevious = (rule: Condition | undefined, achievement: string): Condition => ({ type: "all", conditions: [earned(achievement), ...(rule ? [rule] : [])] });

/** Add entry-level work only in new packs; retained world IDs keep their original ladders. */
export function buildCommonContributionWorld(base: WorldPack): WorldPack {
  if (!["alexandria-lives-7", "alexandria-figures-2"].includes(base.version) || !base.figurePaths?.length || !base.character || !base.legacy || !base.vocations ||
      base.figurePaths.some(path => path.contributionTiering !== "below-principal" || path.contributionStartRank !== undefined)) {
    throw new Error("Common Legendary contributions require a retained lives-7 or figures-2 contribution world.");
  }
  const world = structuredClone(base);
  world.version = base.version === "alexandria-lives-7" ? COMMON_CONTRIBUTION_WORLD_VERSION : DEEP_COMMON_CONTRIBUTION_WORLD_VERSION;
  world.description += " Fixed Legendary figure contributions begin with a separate Common project before Uncommon, Rare and Epic work.";
  for (const path of world.figurePaths!) {
    if (path.baseRank !== "Legendary") continue;
    const display = commonWork[path.id as keyof typeof commonWork];
    if (!display || path.stages.map(stage => stage.rank).join(",") !== "Uncommon,Rare,Epic") throw new Error(`Missing retained Legendary contribution ladder for ${path.id}.`);
    const first = path.stages[0], originalWork = world.vocations!.actions[first.workActionId];
    const firstClaim = world.character!.activities.find(activity => activity.id === first.activityId);
    const firstWork = world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === first.workActionId)));
    const firstAchievement = world.legacy!.achievements.find(item => item.id === first.achievementId);
    const route = world.legacy!.routes.find(item => item.id === `figure-${path.id}`);
    if (!firstClaim || !firstWork || !firstAchievement || !route?.stages || !originalWork || originalWork.kind !== "work") throw new Error(`Missing retained work definitions for ${path.id}.`);
    const achievementId = `fig-${path.id}-common`, activityId = `figure-${path.id}-claim-common`, workActionId = `fig-${path.id}-common-work`, workActivityId = `v-${workActionId}`;
    const initialRule = (rule: Condition): Condition => {
      if (rule.type === "all" || rule.type === "any") return { ...rule, conditions: rule.conditions.map(initialRule) };
      if (rule.type === "not") return { ...rule, condition: initialRule(rule.condition) };
      if (rule.type === "accomplishment" && rule.achievement === first.achievementId) return { ...rule, achievement: achievementId };
      if (rule.type === "vocation" && rule.action === first.workActionId) return { ...rule, action: workActionId, count: 1 };
      if (rule.type === "capability" && earlierNode[rule.node]) return { ...rule, node: earlierNode[rule.node] };
      if (rule.type === "skill" && rule.op === "gte") return { ...rule, value: Math.floor(rule.value / 2) };
      return structuredClone(rule);
    };
    const work = { ...structuredClone(originalWork), fee: Math.floor(originalWork.fee / 2), pay: Math.floor(originalWork.pay / 2),
      inputs: Object.fromEntries(Object.entries(originalWork.inputs ?? {}).map(([item, quantity]) => [item, Math.max(1, Math.ceil(quantity / 2))])) };
    world.vocations!.actions[workActionId] = work;
    const currency = world.economy?.currency.short ?? "coins";
    const materials = Object.entries(work.inputs).map(([item, quantity]) => `${quantity} ${item}`).join(", ");
    const quote = `${work.fee} ${currency} fee, ${work.pay} ${currency} paid${materials ? `; consumes ${materials}` : ""}; one work year`;
    const workActivity = structuredClone(firstWork);
    workActivity.id = workActivityId;
    workActivity.text = `${display.work} (${quote})`;
    workActivity.when = firstWork.when ? initialRule(firstWork.when) : undefined;
    for (const outcome of workActivity.outcomes) {
      outcome.id = `${workActivityId}-done`;
      outcome.text = `${display.work}. The completed work, actual inputs and payment are recorded.`;
      for (const effect of outcome.effects) if (effect.type === "vocation" && effect.action === first.workActionId) effect.action = workActionId;
    }
    const requires = initialRule(first.requires);
    const claim = structuredClone(firstClaim);
    claim.id = activityId;
    claim.text = `Record the Common contribution: ${display.title}`;
    claim.when = structuredClone(requires);
    for (const outcome of claim.outcomes) {
      outcome.id = `${activityId}-accepted`;
      outcome.text = `${display.description} The completed project is accepted as a Common contribution; the principal figure title remains a separate achievement.`;
      for (const effect of outcome.effects) if (effect.type === "accomplishment" && effect.achievement === first.achievementId) effect.achievement = achievementId;
    }
    world.character!.activities.push(workActivity, claim);
    world.legacy!.achievements.push({ ...structuredClone(firstAchievement), id: achievementId, title: display.traditionTitle, description: `${display.description} The player-facing title distinguishes the figure's working circle from a later tradition.`, nameTemplate: `{name}: ${display.traditionTitle}` });
    route.achievementIds.splice(route.achievementIds.indexOf(first.achievementId), 0, achievementId);
    route.stages.unshift({ title: "Common contribution", achievementIds: [achievementId] });
    if (path.id === "menander") {
      const previous = "A usable dramatic scene and rehearsal notes are the first contribution.";
      const revised = "A usable dramatic scene and rehearsal notes build on the initial rehearsal contribution.";
      first.description = first.description.replace(previous, revised);
      firstAchievement.description = firstAchievement.description.replace(previous, revised);
      for (const outcome of firstClaim.outcomes) outcome.text = outcome.text.replace(previous, revised);
    }
    for (const outcome of firstClaim.outcomes) outcome.text = outcome.text.replace("as a Uncommon contribution", "as an Uncommon contribution");
    first.requires = withPrevious(first.requires, achievementId);
    firstClaim.when = withPrevious(firstClaim.when, achievementId);
    firstWork.when = withPrevious(firstWork.when, achievementId);
    path.stages.unshift({ rank: "Common", title: display.title, traditionTitle: display.traditionTitle, description: display.description, achievementId, activityId, workActionId, workYears: 1, requires });
    path.contributionStartRank = "Common";
  }
  return world;
}
