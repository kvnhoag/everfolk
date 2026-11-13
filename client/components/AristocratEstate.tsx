import type { ActivityAvailability, AristocratMetric, Condition, LifeState, WorldPack } from "../../src/types.ts";
import { isAristocratLife } from "../../src/aristocracy.ts";
import { matchesCondition } from "../../src/conditions.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import HouseholdTitlePaths from "./HouseholdTitlePaths.tsx";
import { isHouseholdTitleProject } from "../models/household-title-paths.ts";
import { formatMoney } from "../models/wealth.ts";
import "../styles/wealth.css";
import "../styles/character-panel.css";
import "../styles/royal-council.css";
import "../styles/aristocrat-estate.css";

const responsibilities: Record<Exclude<AristocratMetric, "treasury">, string> = {
  standing: "Reputation among patrons and neighboring households",
  prosperity: "Productivity of fields, stores and estate improvements",
  loyalty: "Trust in the estate's agreements and treatment of tenants",
  inheritance: "Clarity of the next generation's property and responsibilities",
};

export default function AristocratEstate({ life, world, activities, onActivity }: {
  life: LifeState; world: WorldPack; activities: readonly ActivityAvailability[]; onActivity(id: string): void;
}) {
  if (!isAristocratLife(world, life) || !world.aristocracy || !life.aristocracy) return null;
  const rules = world.aristocracy, metrics = life.aristocracy;
  const conditions = (world.yearlyRules ?? []).filter(rule => rule.audience === "aristocrat").map(rule => ({ ...rule, active: matchesCondition(rule.when, life) }));
  const activeConditions = conditions.filter(rule => rule.active);
  const treasuryConditions = activeConditions.filter(rule => rule.effects.some(effect => effect.type === "aristocrat" && effect.metric === "treasury"));
  const annualTreasury = rules.yearlyEffects.filter(effect => effect.metric === "treasury").reduce((total, effect) => total + effect.delta, 0);
  const projectedTreasury = annualTreasury + activeConditions.flatMap(rule => rule.effects).reduce((total, effect) => total + (effect.type === "aristocrat" && effect.metric === "treasury" ? effect.delta : 0), 0);
  const describeCondition = (condition?: Condition): string => {
    if (!condition) return "Every year";
    if (condition.type === "all" || condition.type === "any") return condition.conditions.map(describeCondition).join(condition.type === "all" ? " · " : " or ");
    if (condition.type === "not") return `Without: ${describeCondition(condition.condition)}`;
    if (condition.type === "accomplishment") return `${world.legacy?.achievements.find(item => item.id === condition.achievement)?.title ?? condition.achievement} earned${condition.minYears ? ` ${condition.minYears}+ years ago` : ""}`;
    if (condition.type === "aristocrat" || condition.type === "age") {
      const label = condition.type === "aristocrat" ? rules.metrics[condition.metric].label : "Age";
      const value = condition.type === "aristocrat" && condition.metric === "treasury" ? formatMoney(condition.value, world) : condition.value;
      const comparison = { eq: "at", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[condition.op];
      return `${label} ${comparison} ${value}`;
    }
    return "Other estate conditions";
  };
  const estateActions = activities.filter(activity => activity.audience === "aristocrat" && activity.category !== "training" && !isHouseholdTitleProject(activity));
  return <section className="wealth-panel royal-council aristocrat-estate" aria-label="Estate council">
    <header className="character-section-heading"><span>Aristocratic estate</span><h3>Estate council</h3><p>Improve your land, maintain tenant agreements and build a household that can pass to the next generation.</p></header>
    <div className="wealth-net-worth household-treasury"><span>ESTATE TREASURY</span><strong>{formatMoney(metrics.treasury, world)}</strong><p>{life.age < rules.minAge ? `Your relatives and stewards oversee the estate until age ${rules.minAge}.` : "Available for estate improvements, tenant relief and household obligations."}</p></div>
    <div className="wealth-budget household-yearly-budget"><h4>Yearly budget</h4><dl><div><dt>Estate receipts after regular obligations</dt><dd>{annualTreasury >= 0 ? "+" : ""}{formatMoney(annualTreasury, world)}</dd></div>{treasuryConditions.map(rule => <div key={rule.id}><dt>{describeCondition(rule.when)}</dt><dd>{rule.effects.flatMap(effect => effect.type === "aristocrat" && effect.metric === "treasury" ? [`${effect.delta >= 0 ? "+" : ""}${formatMoney(effect.delta, world)}`] : []).join(" · ") || "Standing affected"}</dd></div>)}<div className="household-budget-total"><dt>Estimated yearly balance</dt><dd>{life.age < rules.minAge ? `From age ${rules.minAge}` : `${projectedTreasury >= 0 ? "+" : ""}${formatMoney(projectedTreasury, world)}`}</dd></div></dl><p>Uses current conditions at the start of the year. Investment, tenant relations and events can change the return.</p></div>
    <div className="character-skill-grid household-standing">{(Object.keys(responsibilities) as Exclude<AristocratMetric, "treasury">[]).map(metric => {
      const definition = rules.metrics[metric], value = metrics[metric];
      return <div className={`character-skill${value <= 30 ? " household-standing-strained" : ""}`} key={metric}><div className="character-skill-heading"><span>{definition.label}</span><strong>{Number(value.toFixed(1))}<small> / {definition.max}</small></strong></div><meter aria-label={definition.label} min={definition.min} max={definition.max} value={value} /><span>{responsibilities[metric]}</span></div>;
    })}</div>
    {life.age >= rules.minAge && <p className="wealth-muted">Annual pressures: {rules.yearlyEffects.filter(effect => effect.metric !== "treasury" && effect.delta !== 0).map(effect => `${rules.metrics[effect.metric].label} ${effect.delta > 0 ? "+" : ""}${effect.delta}`).join(" · ") || "No fixed decline"}. A productive estate and reliable agreements support future income.</p>}
    {conditions.length > 0 && <details className="household-conditions" open={activeConditions.length > 0}><summary>Estate conditions <span>{activeConditions.length ? `${activeConditions.length} active now` : "View thresholds"}</span></summary><ul>{conditions.map(rule => <li key={rule.id} className={rule.active ? "is-active" : undefined}><div><span>{rule.active ? "Active now" : "Applies when"}</span><strong>{describeCondition(rule.when)}</strong></div><p>{rule.effects.flatMap(effect => effect.type === "aristocrat" ? [`${rules.metrics[effect.metric].label} ${effect.delta >= 0 ? "+" : ""}${effect.metric === "treasury" ? formatMoney(effect.delta, world) : effect.delta}`] : []).join(" · ")} per year</p></li>)}</ul></details>}
    <HouseholdTitlePaths world={world} life={life} activities={activities} onActivity={onActivity} />
    <h4 className="household-decisions-heading">Estate decisions</h4><p className="wealth-muted">Choose one major activity each year. Improvements, relief and patronage use the estate treasury. Treasury-funded lessons are available in Skills.</p>
    <div className="personal-activity-list">{estateActions.map(activity => <button type="button" key={activity.id} disabled={!activity.available} onClick={() => onActivity(activity.id)} className="personal-activity"><span className="personal-activity-heading"><strong>{activity.text}</strong><span className="personal-activity-state">{activity.available ? "Choose" : "Locked"}</span></span><ChoiceImpact choice={activity} life={life} world={world} showSkillChanges />{!activity.available && activity.reason && <span className="personal-activity-reason">{activity.reason}</span>}</button>)}</div>
    <p className="wealth-model-note">Stewards handle purchases and daily estate work. Your priorities shape its prosperity, relationships and inheritance.</p>
  </section>;
}
