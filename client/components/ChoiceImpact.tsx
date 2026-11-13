import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { getAccomplishmentPreviews, getAristocratImpact, getChoiceImpact, getRoyalImpact } from "../models/choice-impact.ts";
import ImpactValue from "./ImpactValue.tsx";
import PixelIcon from "./PixelIcon.tsx";
import { getMoneyImpact } from "../models/wealth.ts";
import { getOpportunityPreview } from "../../src/outcomes.ts";
import { severeHealthRisk, formatHealthRisk } from "../models/health-risk.ts";
import { loanEffectNotes } from "../models/loan-summary.ts";
import { getMasteryPreviews } from "../models/mastery.ts";
import { getSkillImpact } from "../models/skill-impact.ts";
import { resolvePartner } from "../../src/people.ts";
import { socialRoleImpact } from "../models/social-role-impact.ts";
import { previewEarlyInfluences, practiceBonus } from "../models/early-influences.ts";
import "../styles/choice-impact.css";
import "../styles/early-influences.css";

/** Only existing people are named. Preview deltas use the same sequential bounds as play. */
function closenessEffects(choice: Choice, life: LifeState, world: WorldPack): { label: string; min: number; max: number }[] {
  const ties = life.character?.relationships;
  if (!world.relationships || !life.character || !ties) return [];
  const initial = Object.fromEntries(Object.entries(ties.partners).map(([id, tie]) => [id, tie.closeness]));
  const results = choice.outcomes.map(outcome => {
    const partners = { ...initial };
    const children = Object.fromEntries(Object.entries(ties.children).map(([id, tie]) => [id, tie.closeness]));
    let current = life.character!.partnerId;
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "relationship") current = effect.partner;
      if (effect.type === "divorce" || effect.type === "end-courtship") current = null;
      if (effect.type !== "closeness") continue;
      if (effect.target === "partner") {
        const id = effect.partner ?? current;
        if (id && partners[id] !== undefined) partners[id] = Math.max(0, Math.min(100, partners[id] + effect.delta));
      } else for (const id of Object.keys(children)) children[id] = Math.max(0, Math.min(100, children[id] + effect.delta));
    }
    return { partners, children };
  });
  const changes = Object.keys(initial).flatMap(id => {
    const deltas = results.map(result => result.partners[id] - initial[id]);
    const min = Math.min(...deltas), max = Math.max(...deltas);
    const person = resolvePartner(world, life, id);
    return min === 0 && max === 0 ? [] : [{ label: `${person?.name ?? "Partner"} · closeness`, min, max }];
  });
  const childDeltas = results.flatMap(result => Object.entries(ties.children).map(([id, tie]) => result.children[id] - tie.closeness));
  if (childDeltas.length) {
    const min = Math.min(...childDeltas), max = Math.max(...childDeltas);
    if (min !== 0 || max !== 0) changes.push({ label: "Children · closeness", min, max });
  }
  return changes;
}

function healthEffects(choice: Choice, life: LifeState, world: WorldPack): { text: string; gain: boolean }[] {
  if (!world.health || !life.health) return [];
  const initial = new Map(life.health.conditions.map(condition => [condition.id, condition.care]));
  const branches = choice.outcomes.map(outcome => {
    const active = new Map(initial);
    const added = new Set<string>();
    let helped = false;
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "condition" && !active.has(effect.condition)) { active.set(effect.condition, 0); added.add(effect.condition); }
      if (effect.type === "care") for (const [id, care] of active) {
        const value = Math.max(0, Math.min(1, care + effect.amount));
        if (value > care) helped = true;
        active.set(id, value);
      }
    }
    return { added, helped };
  });
  const changes = world.health.conditions.flatMap(condition => {
    const count = branches.filter(branch => branch.added.has(condition.id)).length;
    return count ? [{ text: `${count === branches.length ? "Condition" : "Risk"}: ${condition.title}`, gain: false }] : [];
  });
  const helped = branches.filter(branch => branch.helped).length;
  if (helped) changes.push({ text: helped === branches.length ? "Recovery support" : "Possible recovery support", gain: true });
  return changes;
}

/** Immediate outcome effects only: reading a preview never advances the simulation. */
export default function ChoiceImpact({ choice, life, world, hideSkills = true, showSkillChanges = false, emptyText }: { choice: Choice; life: LifeState; world: WorldPack; hideSkills?: boolean; showSkillChanges?: boolean; emptyText?: string }) {
  const impact = getChoiceImpact(choice, life, world);
  const changedStats = impact.stats.filter(stat => (stat.min !== 0 || stat.max !== 0) && !(world.economy && life.economy && stat.id === world.economy.stat));
  const moneyImpact = getMoneyImpact(choice, life, world);
  const royalImpact = [...getRoyalImpact(choice, life, world), ...getAristocratImpact(choice, life, world)];
  const accomplishments = getAccomplishmentPreviews(choice, life, world);
  const connections = closenessEffects(choice, life, world);
  const health = healthEffects(choice, life, world);
  const opportunity = getOpportunityPreview(world, life, choice);
  const severeRisk = severeHealthRisk(life, world, choice);
  const loanNotes = loanEffectNotes(choice, life, world);
  const mastery = hideSkills ? [] : getMasteryPreviews(choice, life, world);
  // Immediate proficiency changes can be shown without exposing future growth modifiers.
  const skillImpact = showSkillChanges || !hideSkills ? getSkillImpact(choice, life, world) : [];
  const early = hideSkills ? [] : previewEarlyInfluences(choice, world, life);
  const social = socialRoleImpact(choice, life, world);
  const hasRange = royalImpact.some(item => item.variable) || changedStats.some(stat => stat.variable) || skillImpact.some(item => item.variable) || moneyImpact.some(item => item.min !== item.max) || connections.some(item => item.min !== item.max);
  if (royalImpact.length === 0 && accomplishments.length === 0 && changedStats.length === 0 && skillImpact.length === 0 && mastery.length === 0 && moneyImpact.length === 0 && connections.length === 0 && health.length === 0 && !impact.canEndLife && !opportunity && !severeRisk && loanNotes.length === 0 && early.length === 0 && social.length === 0) return emptyText ? <span className="compact-skill-empty">{emptyText}</span> : null;
  return <span className="choice-impact">
    <span className="sr-only">Direct effects.{hasRange ? " Ranges show possible outcomes." : ""} </span>
    <span className="choice-impact-list">
      {royalImpact.map(item => <span className="impact-stat" key={`royal-${item.id}`}><span className="impact-stat-label">{item.label}</span>{" "}<ImpactValue min={item.min} max={item.max} suffix={item.id === "treasury" ? world.economy?.currency.short : undefined} /></span>)}
      {changedStats.map(stat => {
        return <span className={`impact-stat impact-attribute stat-${stat.id}`} key={stat.id}>
          <span className="impact-stat-label"><PixelIcon name={stat.id} size={12} />{stat.label}</span>{" "}<ImpactValue min={stat.min} max={stat.max} />
        </span>;
      })}
      {moneyImpact.map(item => <span className={`impact-stat impact-attribute stat-${world.economy!.stat}`} key={`money-${item.id}`}><span className="impact-stat-label"><PixelIcon name="coin" size={12} />{item.label}</span>{" "}<ImpactValue min={item.min} max={item.max} inverse={item.inverse} suffix={world.economy!.currency.short} /></span>)}
      {skillImpact.map(item => <span className="impact-stat impact-skill" key={`skill-${item.id}`}><span className="impact-stat-label"><PixelIcon name={item.id} size={14} />{item.label}</span>{" "}<ImpactValue min={item.min} max={item.max} /></span>)}
      {mastery.map(item => <span className="impact-stat impact-gain" key={`mastery-${item.target}-${item.id}`}>{item.label} cap {item.cap}{!opportunity && ` · ${Number((item.probability * 100).toFixed(1))}% chance`}</span>)}
      {connections.map(item => <span className="impact-stat" key={`closeness-${item.label}`}><span className="impact-stat-label">{item.label}</span>{" "}<ImpactValue min={item.min} max={item.max} /></span>)}
      {health.map(item => <span className={`impact-stat impact-${item.gain ? "gain" : "loss"}`} key={item.text}>{item.text}</span>)}
      {loanNotes.map(note => <span className="impact-stat" key={note}>{note}</span>)}
      {social.map(note => <span className={`impact-stat impact-${note.gain ? "gain" : "loss"}`} key={note.text}>{note.text}</span>)}
      {accomplishments.map(item => <span className="impact-stat impact-gain" key={`card-${item.id}`}>{item.kind === "ordinary" ? "Work card" : "Title card"}: {item.title} · {item.probability >= 1 ? "Awarded on acceptance" : `${Number((item.probability * 100).toPrecision(3))}% chance`}</span>)}
    </span>
    {early.map(item => <span className="choice-early-influence" key={item.routeId}><span>{item.possible ? "Possible early interest" : item.reinforced ? "Interest reinforced" : "Early interest"}: <strong>{item.title}</strong></span>{item.multiplier > 1 && <small>Future practice gains up to {practiceBonus(item.multiplier)}</small>}</span>)}
    {opportunity && <span className="choice-opportunity"><strong>{opportunity.label}: {Number((opportunity.probability * 100).toFixed(1))}%</strong>{!hideSkills && opportunity.factors.length > 0 && <span className="choice-opportunity-factors">{opportunity.factors.map((factor, index) => <span className={factor.multiplier >= 1 ? "opportunity-help" : "opportunity-hinder"} key={`${factor.reason}-${index}`}>{factor.reason}</span>)}</span>}</span>}
    {impact.canEndLife && <span className="choice-impact-ending">{impact.deathRisk > 0 ? `Risk of death: ${impact.deathRisk < .0001 ? "less than 0.01" : Number((impact.deathRisk * 100).toFixed(2))}%.` : "A possible outcome ends this life."}</span>}
    {severeRisk && <span className="choice-impact-ending">Risk of death from severe illness: {formatHealthRisk(severeRisk)} before the next birthday.</span>}
  </span>;
}
