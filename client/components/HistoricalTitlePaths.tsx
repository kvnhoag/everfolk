import { useId } from "react";
import type { Condition, LegacyAchievementDefinition, LifeEvent, LifeState, WorldPack } from "../../src/types.ts";
import { matchesCondition } from "../../src/conditions.ts";
import { royalAudienceAllowed } from "../../src/royalty.ts";
import { formatYear } from "../../src/calendar.ts";
import { displayProse } from "../models/display-prose.ts";
import { formatMoney } from "../models/wealth.ts";
import "../styles/historical-title-paths.css";

interface Requirement { text: string; met: boolean }
type StageState = "earned" | "offered" | "eligible" | "locked" | "closed" | "resolved";

function requirements(condition: Condition | undefined, world: WorldPack, life: LifeState): Requirement[] {
  if (!condition) return [];
  if (condition.type === "all") return condition.conditions.flatMap(child => requirements(child, world, life));
  const describe = (rule: Condition): string => {
    switch (rule.type) {
      case "all": return rule.conditions.map(describe).join("; ");
      case "any": return rule.conditions.map(describe).join(" or ");
      case "skill": return `${world.character?.skills[rule.skill]?.label ?? rule.skill} ${rule.op === "gte" ? "at least " : rule.op === "lte" ? "at most " : ""}${rule.value}`;
      case "cash": return `${rule.value} ${world.economy?.currency.short ?? "cash"} available`;
      case "age": return `Age ${rule.op === "gte" ? "at least " : rule.op === "lte" ? "at most " : ""}${rule.value}`;
      case "year": return `${{ gte: "From", gt: "After", lte: "Through", lt: "Before", eq: "In", ne: "Outside" }[rule.op]} ${formatYear(rule.value)}`;
      case "accomplishment": return `${world.legacy?.achievements.find(item => item.id === rule.achievement)?.title ?? rule.achievement}${rule.minYears ? ` · completed ${rule.minYears}+ years earlier` : " · completed"}`;
      case "flag": return `${rule.value ? "" : "Without: "}${world.flags[rule.flag]?.label ?? "Required preparation"}`;
      case "royal": return `${world.royalty?.metrics[rule.metric].label ?? rule.metric} ${{ eq: "at", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[rule.op]} ${rule.metric === "treasury" ? formatMoney(rule.value, world) : rule.value}`;
      case "aristocrat": return `${world.aristocracy?.metrics[rule.metric].label ?? rule.metric} ${{ eq: "at", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[rule.op]} ${rule.metric === "treasury" ? formatMoney(rule.value, world) : rule.value}`;
      case "stat": return `${world.stats[rule.stat]?.label ?? rule.stat} ${rule.value}+`;
      case "not": return rule.condition.type === "accomplishment" ? "Not already collected" : `Without: ${describe(rule.condition)}`;
      case "job": return world.character?.jobs.find(job => job.id === rule.job)?.title ?? "Required employment";
      default: return "Required circumstances";
    }
  };
  return [{ text: describe(condition), met: matchesCondition(condition, life) }];
}

/** An expired mandatory date can close a path even while its older cards survive. */
function dateClosed(condition: Condition | undefined, life: LifeState): boolean {
  if (!condition) return false;
  if (condition.type === "all") return condition.conditions.some(child => dateClosed(child, life));
  if (condition.type === "any") return condition.conditions.every(child => dateClosed(child, life));
  if (condition.type !== "year" && condition.type !== "age") return false;
  const value = condition.type === "year" ? life.year : life.age;
  return condition.op === "lte" ? value > condition.value : condition.op === "lt" ? value >= condition.value : condition.op === "eq" ? value > condition.value : false;
}

/** Open-ended study paths have no personal contact window to describe as closed. */
function hasContactWindow(condition: Condition | undefined): boolean {
  if (!condition) return false;
  if (condition.type === "all") return condition.conditions.some(hasContactWindow);
  if (condition.type === "any") return condition.conditions.every(hasContactWindow);
  return condition.type === "year" && ["lte", "lt", "eq"].includes(condition.op);
}

function awardingEvent(world: WorldPack, life: LifeState, achievement: LegacyAchievementDefinition): LifeEvent | undefined {
  const events = world.events.filter(event => event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievement.id))));
  return events.find(event => royalAudienceAllowed(world, life, event.audience)) ?? events[0];
}

function prerequisiteIds(condition: Condition | undefined): string[] {
  if (!condition) return [];
  if (condition.type === "accomplishment") return [condition.achievement];
  if (condition.type === "all" || condition.type === "any") return condition.conditions.flatMap(prerequisiteIds);
  return [];
}

function invitationEnded(condition: Condition | undefined, life: LifeState): boolean {
  if (!condition) return false;
  if (condition.type === "all") return condition.conditions.some(child => invitationEnded(child, life));
  if (condition.type === "any") return condition.conditions.every(child => invitationEnded(child, life));
  return condition.type === "flag" && condition.value === false && condition.flag.endsWith("-declined") && life.flags[condition.flag] === true;
}

/** Projects the authored event gates without offering an event or consuming RNG. */
export function buildHistoricalTitlePaths(world: WorldPack, life: LifeState) {
  const figures = new Map<string, { figure: { id: string; name: string }; achievements: LegacyAchievementDefinition[] }>();
  for (const achievement of world.legacy?.achievements ?? []) {
    if (!achievement.figure) continue;
    const path = figures.get(achievement.figure.id) ?? { figure: achievement.figure, achievements: [] };
    path.achievements.push(achievement);
    figures.set(achievement.figure.id, path);
  }
  return [...figures.values()].map(path => {
    const stages = path.achievements.map(achievement => {
      const event = awardingEvent(world, life, achievement);
      const earned = life.accomplishments?.some(record => record.achievementId === achievement.id) === true;
      const awardingChoice = event?.choices.find(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievement.id)));
      const offered = event?.id === life.pendingEventId && life.phase === "choice";
      const consumed = event && (life.eventCounts[event.id] ?? 0) >= (event.maxOccurrences ?? 1) && !offered;
      const lastAge = event ? life.lastEventAge[event.id] : undefined;
      const waitYears = event && lastAge !== undefined ? Math.max(0, (event.cooldownYears ?? 0) - (life.age - lastAge)) : 0;
      const due = event && (event.trigger.type === "random" || (event.trigger.type === "year" ? life.year : life.age) >= event.trigger.at);
      const allowed = event && royalAudienceAllowed(world, life, event.audience);
      const closed = life.phase === "ended" || dateClosed(event?.when, life) || invitationEnded(event?.when, life) || !allowed;
      const eligible = !closed && !consumed && !waitYears && due && matchesCondition(event?.when, life) && matchesCondition(awardingChoice?.when, life);
      const state: StageState = earned ? "earned" : closed ? "closed" : consumed ? "resolved" : offered ? "offered" : eligible ? "eligible" : "locked";
      const checks = [
        ...requirements(event?.when, world, life),
        ...requirements(awardingChoice?.when, world, life),
        ...(!offered && waitYears ? [{ text: `Next opportunity in ${waitYears} ${waitYears === 1 ? "year" : "years"}`, met: false }] : []),
      ];
      return { achievement, event, state, contactWindow: hasContactWindow(event?.when), prerequisites: prerequisiteIds(event?.when), requirements: [...new Map(checks.map(check => [`${check.text}:${check.met}`, check])).values()] };
    });
    // A consumed, unsuccessful prerequisite closes its dependent title rather
    // than suggesting that more skill can recreate a missed completed duty.
    for (const stage of stages) {
      if (stage.state === "earned") continue;
      if (stage.prerequisites.some(id => stages.some(prior => prior.achievement.id === id && (prior.state === "closed" || prior.state === "resolved")))) stage.state = "closed";
    }
    const titles = stages.filter(stage => stage.achievement.kind !== "ordinary");
    const branches = titles.map(title => {
      const ancestors = new Set<string>();
      const include = (id: string) => {
        if (ancestors.has(id)) return;
        ancestors.add(id);
        stages.find(stage => stage.achievement.id === id)?.prerequisites.forEach(include);
      };
      include(title.achievement.id);
      const branchStages = stages.filter(stage => ancestors.has(stage.achievement.id));
      const next = branchStages.find(stage => stage.state === "offered") ?? branchStages.find(stage => stage.state === "eligible") ?? branchStages.find(stage => stage.state === "locked");
      return { title, stages: branchStages, next, declined: invitationEnded(title.event?.when, life) };
    });
    const next = stages.find(stage => stage.state === "offered") ?? stages.find(stage => stage.state === "eligible") ?? stages.find(stage => stage.state === "locked");
    return { ...path, stages, titles, branches, next, earned: stages.filter(stage => stage.state === "earned").length };
  });
}

const stageLabels: Record<StageState, string> = {
  earned: "Collected", offered: "Event open now", eligible: "Eligible for next event", locked: "Preparation needed", closed: "Path closed", resolved: "Opportunity completed",
};

function stageLabel(stage: { state: StageState; contactWindow: boolean }): string {
  if (stage.contactWindow && stage.state === "eligible") return "Eligible for a visit";
  if (stage.contactWindow && stage.state === "closed") return "Contact closed";
  return stageLabels[stage.state];
}

export default function HistoricalTitlePaths({ world, life }: { world: WorldPack; life: LifeState }) {
  const id = useId();
  const paths = buildHistoricalTitlePaths(world, life);
  if (!paths.length) return null;
  const titleCount = paths.reduce((sum, path) => sum + path.titles.filter(stage => stage.state === "earned").length, 0);
  return <section className="historical-title-paths" aria-labelledby={`${id}-heading`}>
    <header><div><h3 id={`${id}-heading`}>Historical figure cards</h3><p>Complete each path’s required work to collect title and milestone sub-cards in your own name.</p></div><span>{titleCount} / {paths.reduce((sum, path) => sum + path.titles.length, 0)} title sub-cards collected</span></header>
    <div className="historical-title-grid">{paths.map(path => <details key={path.figure.id} className="historical-title-figure">
      <summary><strong>{path.figure.name}</strong><span>{path.earned} / {path.stages.length} sub-cards</span></summary>
      {path.branches.map(branch => <section className="historical-title-branch" key={branch.title.achievement.id}>
      <h4 className="historical-title-targets">{branch.title.achievement.title}</h4>
      <p className="historical-title-status">{branch.title.state === "earned" ? "Title collected. This record remains in your collection." : life.phase === "ended" ? "This life has ended. Collected cards remain in your collection." : branch.declined ? `This ${branch.title.contactWindow ? "invitation " : ""}path has ended. Collected cards remain in your collection.` : branch.title.state === "resolved" ? "Final review completed without this title. Accepted milestones remain collected." : branch.next ? `${stageLabel(branch.next)}: ${branch.next.event?.title ?? branch.next.achievement.title}` : `${branch.title.contactWindow ? "Contact window closed" : "This title path has ended"}. Collected cards remain in your collection.`}</p>
      <ol>{branch.stages.map(stage => <li key={stage.achievement.id} className={`historical-title-stage is-${stage.state}`}>
        <div><h5>{stage.achievement.title}</h5><span>{stageLabel(stage)}</span></div>
        {stage.state === "earned" ? <p>{stage.achievement.kind === "ordinary" ? "Milestone sub-card collected for this completed work." : "Title sub-card earned in this life."}</p> : <>
          <p>{displayProse(stage.achievement.description)}</p>
          {stage.state === "offered" && <p className="historical-title-invitation">Continue the open life event to {stage.contactWindow ? "answer this invitation" : "continue this path"}.</p>}
          {stage.state !== "closed" && stage.state !== "resolved" && stage.requirements.length > 0 && <ul aria-label={`${stage.achievement.title} requirements`}>{stage.requirements.map((requirement, index) => <li key={index} className={requirement.met ? "is-met" : "is-missing"}><span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>{requirement.text}</li>)}</ul>}
        </>}
      </li>)}</ol>
      </section>)}
    </details>)}</div>
    <p className="historical-title-note">These fictional paths recognize completed work in each figure’s historical tradition or setting. Preparing for a title does not guarantee recognition.</p>
  </section>;
}
