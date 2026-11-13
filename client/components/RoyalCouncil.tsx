import type { ActivityAvailability, Condition, LifeState, RoyalMetric, WorldPack } from "../../src/types.ts";
import { isRoyalLife } from "../../src/royalty.ts";
import { matchesCondition } from "../../src/conditions.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import HouseholdTitlePaths from "./HouseholdTitlePaths.tsx";
import { isHouseholdTitleProject } from "../models/household-title-paths.ts";
import { formatMoney } from "../models/wealth.ts";
import "../styles/wealth.css";
import "../styles/character-panel.css";
import "../styles/royal-council.css";

const responsibilities: Record<Exclude<RoyalMetric, "treasury">, string> = {
  influence: "Diplomatic ties and standing with the court",
  stability: "Support within your household and its estates",
  security: "Readiness of guards and protection of the house",
  succession: "Clarity of the family's future leadership",
};

export default function RoyalCouncil({ life, world, activities, onActivity }: {
  life: LifeState; world: WorldPack; activities: readonly ActivityAvailability[]; onActivity(id: string): void;
}) {
  if (!isRoyalLife(world, life) || !world.royalty || !life.royalty) return null;
  const rules = world.royalty;
  const metrics = life.royalty;
  const annualTreasury = rules.yearlyEffects.filter(effect => effect.metric === "treasury").reduce((total, effect) => total + effect.delta, 0);
  const pressures = (world.yearlyRules ?? []).filter(rule => rule.audience === "royal").map(rule => ({
    ...rule, active: matchesCondition(rule.when, life),
  }));
  const activePressures = pressures.filter(rule => rule.active);
  const treasuryPressures = activePressures.filter(rule => rule.effects.some(effect => effect.type === "royal" && effect.metric === "treasury"));
  const projectedTreasury = annualTreasury + activePressures.flatMap(rule => rule.effects).reduce((total, effect) => total + (effect.type === "royal" && effect.metric === "treasury" ? effect.delta : 0), 0);
  const describeCondition = (condition?: Condition): string => {
    if (!condition) return "Every year";
    if (condition.type === "all" || condition.type === "any") return condition.conditions.map(describeCondition).join(condition.type === "all" ? " · " : " or ");
    if (condition.type === "not") return `Without: ${describeCondition(condition.condition)}`;
    if (condition.type === "accomplishment") return `${world.legacy?.achievements.find(item => item.id === condition.achievement)?.title ?? condition.achievement} earned${condition.minYears ? ` ${condition.minYears}+ years ago` : ""}`;
    if (condition.type === "royal" || condition.type === "age") {
      const label = condition.type === "royal" ? rules.metrics[condition.metric].label : "Age";
      const value = condition.type === "royal" && condition.metric === "treasury" ? formatMoney(condition.value, world) : condition.value;
      const comparison = { eq: "at", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[condition.op];
      return `${label} ${comparison} ${value}`;
    }
    return "Other household conditions";
  };
  const royalActions = activities.filter(activity => activity.audience === "royal" && activity.category !== "training" && !isHouseholdTitleProject(activity));
  return <section className="wealth-panel royal-council" aria-label="Royal council">
    <header className="character-section-heading"><span>Royal household</span><h3>Royal council</h3><p>Guide your family's standing, protect its estates and prepare the next generation to lead.</p></header>
    <div className="wealth-net-worth household-treasury"><span>ROYAL TREASURY</span><strong>{formatMoney(metrics.treasury, world)}</strong><p>{life.age < rules.minAge ? `Your relatives oversee the house until age ${rules.minAge}.` : "Available for household obligations and council decisions."}</p></div>
    <div className="wealth-budget household-yearly-budget"><h4>Yearly budget</h4><dl><div><dt>House receipts after regular obligations</dt><dd>{annualTreasury >= 0 ? "+" : ""}{formatMoney(annualTreasury, world)}</dd></div>{treasuryPressures.map(rule => <div key={rule.id}><dt>{describeCondition(rule.when)}</dt><dd>{rule.effects.flatMap(effect => effect.type === "royal" && effect.metric === "treasury" ? [`${effect.delta >= 0 ? "+" : ""}${formatMoney(effect.delta, world)}`] : []).join(" · ") || "Standing affected"}</dd></div>)}<div className="household-budget-total"><dt>Estimated yearly balance</dt><dd>{life.age < rules.minAge ? `From age ${rules.minAge}` : `${projectedTreasury >= 0 ? "+" : ""}${formatMoney(projectedTreasury, world)}`}</dd></div></dl><p>Uses current conditions at the start of the year. Decisions, ageing and events can change the result.</p></div>
    <div className="character-skill-grid household-standing">{(Object.keys(responsibilities) as Exclude<RoyalMetric, "treasury">[]).map(metric => {
      const definition = rules.metrics[metric];
      const value = metrics[metric];
      return <div className={`character-skill${value <= 30 ? " household-standing-strained" : ""}`} key={metric}>
        <div className="character-skill-heading"><span>{definition.label}</span><strong>{Number(value.toFixed(1))}<small> / {definition.max}</small></strong></div>
        <meter aria-label={definition.label} min={definition.min} max={definition.max} value={value} />
        <span>{responsibilities[metric]}</span>
      </div>;
    })}</div>
    {life.age >= rules.minAge && <p className="wealth-muted">Annual pressures: {rules.yearlyEffects.filter(effect => effect.metric !== "treasury" && effect.delta !== 0).map(effect => `${rules.metrics[effect.metric].label} ${effect.delta > 0 ? "+" : ""}${effect.delta}`).join(" · ") || "No fixed decline"}. Council decisions can strengthen these foundations.</p>}
    {pressures.length > 0 && <details className="household-conditions" open={activePressures.length > 0}>
      <summary>Household conditions <span>{activePressures.length ? `${activePressures.length} active now` : "View thresholds"}</span></summary>
      <ul>{pressures.map(rule => <li key={rule.id} className={rule.active ? "is-active" : undefined}>
        <div><span>{rule.active ? "Active now" : "Applies when"}</span><strong>{describeCondition(rule.when)}</strong></div>
        <p>{rule.effects.flatMap(effect => effect.type === "royal" ? [`${rules.metrics[effect.metric].label} ${effect.delta >= 0 ? "+" : ""}${effect.metric === "treasury" ? formatMoney(effect.delta, world) : effect.delta}`] : []).join(" · ")} per year</p>
      </li>)}</ul>
    </details>}
    <HouseholdTitlePaths world={world} life={life} activities={activities} onActivity={onActivity} />
    <h4 className="household-decisions-heading">Council decisions</h4><p className="wealth-muted">Choose one major activity each year. Decisions use the royal treasury. Treasury-funded lessons are available in Skills.</p>
    <div className="personal-activity-list">{royalActions.map(activity => <button type="button" key={activity.id} disabled={!activity.available} onClick={() => onActivity(activity.id)} className="personal-activity">
      <span className="personal-activity-heading"><strong>{activity.text}</strong><span className="personal-activity-state">{activity.available ? "Choose" : "Locked"}</span></span><ChoiceImpact choice={activity} life={life} world={world} showSkillChanges />
      {!activity.available && activity.reason && <span className="personal-activity-reason">{activity.reason}</span>}
    </button>)}</div>
    <p className="wealth-model-note">You belong to a minor royal branch. Family leadership and succession do not grant Egypt's throne.</p>
  </section>;
}
