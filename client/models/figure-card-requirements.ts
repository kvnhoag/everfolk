import type { FigureCardRank, FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import { getFigureCardProgress, type FigureCardProgress } from "../../src/figures/card-progress.ts";
import { matchesCondition } from "../../src/conditions.ts";
import type { Condition, LifeState, WorldPack } from "../../src/types.ts";
import { figureContributionStageCopy, figureContributionTitleCopy } from "../../chain/catalog/figure-contribution-copy.ts";
import { formatYear } from "../../src/calendar.ts";

export interface FigureCardRequirement { id: string; label: string; detail?: string; met?: boolean }
export interface FigureCardRequirementsInput {
  figure: FigureRosterEntry;
  mode: "principal" | "contribution";
  rank: FigureCardRank;
  world?: WorldPack;
  life?: LifeState;
  progress?: FigureCardProgress;
}
const definingWork: Record<FigureRosterEntry["id"], string> = {
  alexander: "Complete the contribution ladder and secure a successful decisive campaign settlement.",
  aristotle: "Complete the contribution ladder and an independently checked body of inquiry and teaching.",
  euclid: "Complete the contribution ladder and a reviewed deductive collection with taught constructions.",
  lysippos: "Complete the contribution ladder and an independently reviewed monumental bronze programme.",
  pytheas: "Complete the contribution ladder and an independently checked navigation account with teaching copies.",
  menander: "Complete the contribution ladder and an independent cycle of revised, publicly staged comedies.",
  demetrius: "Complete the contribution ladder and the separately assessed siege-engineering capstone.",
  theophrastus: "Complete the contribution ladder and a reviewed comparative botanical account across seasons.",
  zeno: "Complete the contribution ladder and the separately assessed ethical-inquiry capstone.",
  ptolemy: "Complete the contribution ladder and the separately assessed government capstone.",
  cleomenes: "Complete the contribution ladder and an audited grain and revenue programme.",
};
const promotionWork = {
  "rhodes-captured": { label: "Capture Rhodes successfully", detail: "The alternate-history capture must succeed. Siege machinery or the historical negotiated settlement remains Epic." },
  "ptolemaic-dynasty-founded": { label: "Found the Ptolemaic dynasty", detail: "Successfully establish independent hereditary government and a working succession settlement; a royal claim or date alone is insufficient." },
  "stoic-school-established": { label: "Establish an independently functioning Stoic school", detail: "The funded school must sustain its teaching, students and independent programme. This remains the working Legendary criterion." },
} as const;
const readable = (value: string) => value.replaceAll("-", " ");
const comparison = (value: string) => ({ eq: "exactly", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[value] ?? value);
function achievementTitle(world: WorldPack, id: string): string {
  return figureContributionTitleCopy(world.legacy?.achievements.find(item => item.id === id)?.title ?? readable(id));
}
function workActivity(world: WorldPack, action: string) {
  return world.character?.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === action)));
}
function conditionLabel(world: WorldPack, condition: Condition): string {
  switch (condition.type) {
    case "capability": return `${condition.learned === false ? "Do not hold" : "Learn"} ${world.deepCapabilities?.rules.find(item => item.id === condition.node)?.title ?? world.capabilities?.nodes.find(item => item.id === condition.node)?.title ?? condition.node}`;
    case "vocation": return `Complete ${condition.count} qualifying work year${condition.count === 1 ? "" : "s"}`;
    case "accomplishment": return `Earn ${achievementTitle(world, condition.achievement)}${condition.minYears ? ` and allow ${condition.minYears} year${condition.minYears === 1 ? "" : "s"} to pass` : ""}`;
    case "skill": return `${world.character?.skills[condition.skill]?.label ?? readable(condition.skill)} ${comparison(condition.op)} ${condition.value}`;
    case "stat": return `${world.stats[condition.stat]?.label ?? readable(condition.stat)} ${comparison(condition.op)} ${condition.value}`;
    case "age": return `Age ${comparison(condition.op)} ${condition.value}`;
    case "year": return `${formatYear(condition.value)} ${{ gte: "or later", gt: "or later (excluding that year)", lte: "or earlier", lt: "or earlier (excluding that year)", eq: "exactly", ne: "excluded" }[condition.op]}`;
    case "cash": case "debt": return `${condition.type === "cash" ? "Cash" : "Debt"} ${comparison(condition.op)} ${condition.value} ${world.economy?.currency.short ?? ""}`.trim();
    case "material": return `${readable(condition.item)} ${comparison(condition.op)} ${condition.value}`;
    case "job": return condition.job ? `Work as ${world.character?.jobs.find(item => item.id === condition.job)?.title ?? readable(condition.job)}` : "Leave the current occupation";
    case "origin": return `Begin in ${world.origins.find(item => item.id === condition.origin)?.title ?? readable(condition.origin)}`;
    case "flag": return `${readable(condition.flag)}: ${condition.value ? "required" : "must be absent"}`;
    case "all": return condition.conditions.map(item => conditionLabel(world, item)).join("; ");
    case "any": return `Meet one of: ${condition.conditions.map(item => conditionLabel(world, item)).join(" / ")}`;
    case "not": return condition.condition.type === "accomplishment" ? `No previous attempt: ${achievementTitle(world, condition.condition.achievement)}` : `Must not meet: ${conditionLabel(world, condition.condition)}`;
    default: return `Meet the authored ${readable(condition.type)} requirement`;
  }
}
function conditionKey(condition: Condition): string {
  switch (condition.type) {
    case "all": case "any": return `${condition.type}:${condition.conditions.map(conditionKey).sort().join("|")}`;
    case "not": return `not:${conditionKey(condition.condition)}`;
    case "capability": return `capability:${condition.node}`;
    case "vocation": return `work:${condition.action}`;
    case "accomplishment": return `achievement:${condition.achievement}`;
    case "skill": return `skill:${condition.skill}:${condition.op}`;
    case "stat": return `stat:${condition.stat}:${condition.op}`;
    case "year": case "age": case "cash": case "debt": return `${condition.type}:${condition.op}`;
    default: return JSON.stringify(condition);
  }
}
function conditionRows(world: WorldPack, condition: Condition, rows: Map<string, FigureCardRequirement>, gates: Map<string, Condition>, life?: LifeState, visitedWork = new Set<string>()) {
  if (condition.type === "all") {
    for (const child of condition.conditions) conditionRows(world, child, rows, gates, life, visitedWork);
    return;
  }
  // Claim guards keep an award single-use; they are not historical work to perform.
  // Failed one-shot attempts are materially different and remain explicit.
  if (condition.type === "not" && condition.condition.type === "accomplishment" && !condition.condition.achievement.endsWith("-attempt")) return;
  const id = conditionKey(condition);
  const previous = gates.get(id);
  if (previous && "op" in previous && "value" in previous && "op" in condition && "value" in condition) {
    if ((condition.op === "gte" || condition.op === "gt") && previous.value >= condition.value ||
        (condition.op === "lte" || condition.op === "lt") && previous.value <= condition.value) return;
  }
  gates.set(id, condition);
  const activity = condition.type === "vocation" ? workActivity(world, condition.action) : undefined;
  rows.set(id, { id, label: conditionLabel(world, condition), ...(activity ? { detail: activity.text } : {}), met: life ? matchesCondition(condition, life) : undefined });
  // Work actions may have stricter access windows than their title-claim activity.
  if (condition.type === "vocation" && activity?.when && !visitedWork.has(condition.action)) {
    visitedWork.add(condition.action);
    conditionRows(world, activity.when, rows, gates, life, visitedWork);
  }
}

/** Full authored requirements remain stable as a life meets them; these rows never grant a card. */
export function buildFigureCardRequirements({ figure, mode, rank, world, life, progress: suppliedProgress }: FigureCardRequirementsInput): FigureCardRequirement[] {
  const progress = suppliedProgress ?? (world && life ? getFigureCardProgress(world, life, figure.id) : undefined);
  const pathProgress = progress?.pathProgress;
  const path = pathProgress?.definition ?? world?.figurePaths?.find(item => item.id === figure.id);
  const rows = new Map<string, FigureCardRequirement>();
  const gates = new Map<string, Condition>();
  const add = (row: FigureCardRequirement) => rows.set(row.id, row);
  const activityRules = (activityId: string, includeWhen = true) => {
    const activity = world?.character?.activities.find(item => item.id === activityId);
    if (!world || !activity) return;
    if (activity.minAge) add({ id: "age", label: `Age at least ${activity.minAge}`, met: life ? life.age >= activity.minAge : undefined });
    if (includeWhen && activity.when) conditionRows(world, activity.when, rows, gates, life);
  };
  if (mode === "principal") {
    add({ id: "unlock", label: definingWork[figure.id], ...(path ? { detail: path.capstone.description } : {}), met: life ? pathProgress?.capstone.earned === true : undefined });
    const variant = figure.variants.find(item => item.rank === rank);
    if (variant?.requiredMilestone) add({ id: "promotion:milestone", ...promotionWork[variant.requiredMilestone], met: life ? pathProgress?.promoted === true : undefined });
    if (world && path) {
      conditionRows(world, path.capstone.requires, rows, gates, life);
      activityRules(path.capstone.activityId);
      add({ id: "capstone:accepted", label: "Record the successful figure-defining capstone", detail: path.capstone.attemptAchievementId ? "Resolve the decisive operation successfully. There is one attempt; a failed result does not award the figure card." : "Submit the completed work and record its accepted outcome.", met: life ? pathProgress?.capstone.earned === true : undefined });
    }
    if (variant?.requiredMilestone) {
      if (world && path?.promotion) activityRules(path.promotion.activityId);
      else add({ id: "promotion:condition", label: variant.condition, met: life ? pathProgress?.promoted === true : undefined });
      add({ id: "promotion:accepted", label: "Record the successful Legendary outcome", detail: "The founding or campaign has one attempt. A failed outcome keeps the figure at Epic.", met: life ? pathProgress?.promoted === true : undefined });
    }
  } else {
    const stage = path?.stages.find(item => item.rank === rank) ?? (rank === "Epic" ? path?.legendaryContribution : undefined);
    if (stage) {
      const stageProgress = pathProgress?.stages.find(item => item.definition.rank === rank) ?? (rank === "Epic" ? pathProgress?.legendaryContribution : undefined);
      const met = life ? stageProgress?.earned === true : undefined;
      const displayedStage = figureContributionStageCopy(stage);
      const title = progress?.pathProgress?.encounterMode === "tradition" ? displayedStage.traditionTitle : displayedStage.title;
      add({ id: "unlock", label: `Complete and record ${title}.`, detail: stage.description, met });
      if (world) {
        conditionRows(world, stage.requires, rows, gates, life);
        activityRules(stage.activityId);
      }
      add({ id: "contribution:accepted", label: `Record the accepted ${rank} contribution title`, detail: "Complete this grade's projects and learned prerequisites; previewing the card awards nothing.", met });
    } else {
      const ladder = figure.baseRank === "Epic" ? ["Common", "Uncommon", "Rare"] : ["Common", "Uncommon", "Rare", "Epic"];
      const index = ladder.indexOf(rank);
      add({ id: "unlock", label: rank === "Epic" && figure.baseRank === "Epic" ? "Earn the successful Legendary figure outcome, then claim separate Epic contribution recognition." : `Complete and record the ${rank} contribution projects for ${figure.name}.` });
      add({ id: "contribution:projects", label: index >= 0 ? "Complete this grade’s qualifying projects with the required skills, funding and materials." : "Complete the senior Rare contribution before this separate recognition." });
      add({ id: "contribution:sequence", label: index > 0 ? `Earn the preceding ${ladder[index - 1]} contribution first.` : "Enter the figure's historical path or continuing tradition first." });
    }
  }
  return [...rows.values()];
}

/** New rows and changed text are compared to the previously selected rarity, not earned state. */
export function changedRequirementIds(previous: readonly FigureCardRequirement[], next: readonly FigureCardRequirement[]): string[] {
  const before = new Map(previous.map(row => [row.id, row]));
  return next.filter(row => {
    const old = before.get(row.id);
    return !old || old.label !== row.label || old.detail !== row.detail;
  }).map(row => row.id);
}
