import { useId, useMemo } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { engineForLife } from "../lib/world-session.ts";
import { relationshipSupport } from "../../src/relationships.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { severeHealthRisk, formatHealthRisk } from "../models/health-risk.ts";
import { activityLoanOffer } from "../models/loan-access.ts";
import "../styles/health.css";

const careIds = new Set(["rest-for-recovery", "seek-a-healer", "ask-household-care"]);

/** Show recorded conditions and normal engine actions, without predicting a diagnosis. */
export default function LifeHealthPanel({ life, world, onActivity, compact = false }: {
  life: LifeState; world: WorldPack; onActivity: (id: string) => void; compact?: boolean;
}) {
  const titleId = useId();
  const actions = useMemo(() => world.health && life.health && life.character
    ? engineForLife(life).getActivities(life).filter(activity => careIds.has(activity.id)) : [], [life, world]);
  if (!world.health || !life.health || life.phase === "ended" || life.health.conditions.length === 0) return null;
  const score = life.stats[world.health.stat];
  const conditions = life.health.conditions.flatMap(condition => {
    const definition = world.health!.conditions.find(item => item.id === condition.id);
    return definition ? [{ condition, definition }] : [];
  });
  const urgent = conditions.some(({ condition, definition }) => condition.severe || score <= definition.fatalHealthThreshold + definition.healthLoss);
  const severeRisk = severeHealthRisk(life, world);
  return <section className={`life-health-panel${urgent ? " health-urgent" : ""}${compact ? " health-compact" : ""}`} aria-labelledby={titleId}>
    <header><h3 id={titleId}>Health &amp; recovery</h3><span>{urgent ? "Needs attention" : "Unwell"}</span></header>
    <ul className="health-condition-list">{conditions.map(({ condition, definition }) => <li key={condition.id}>
      <div><strong>{condition.severe ? `Severe ${definition.title.toLocaleLowerCase()}` : definition.title}</strong><span>Since age {condition.sinceAge}</span></div>
      <span className={`health-care-status${condition.care > 0 ? " is-arranged" : ""}`}>{condition.care > 0 ? "Care arranged" : "Needs care"}</span>
    </li>)}</ul>
    {severeRisk && <p className="health-care-note">Severe illness can be fatal before your next birthday. Current risk: {formatHealthRisk(severeRisk)}. Care can improve your chance of recovery.</p>}
    {relationshipSupport(world, life) > 0 && <p className="health-care-note">Your close household is helping with recovery.</p>}
    {!compact && <p className="health-care-note">Care can help recovery. These actions do not use your yearly activity.</p>}
    {actions.length > 0 && <div className="health-care-actions">{actions.map(activity => {
      const loanOffer = !activity.available && activityLoanOffer(world, life, activity);
      return <div className="health-care-action" key={activity.id}>
      <button type="button" disabled={!activity.available && !loanOffer} onClick={() => onActivity(activity.id)}>{activity.text}<span aria-hidden="true">↗</span></button>
      <ChoiceImpact choice={activity} life={life} world={world} />
      {!activity.available && activity.reason && <small>{activity.reason}</small>}
      {loanOffer && <small className="loan-funding-hint">Ask moneylender to fund care · View terms</small>}
    </div>; })}</div>}
  </section>;
}
