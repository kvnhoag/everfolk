import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import { getChoiceImpact } from "./choice-impact.ts";
import ImpactValue from "./ImpactValue.tsx";
import { getMoneyImpact } from "./wealth.ts";
import "./choice-impact.css";

/** Immediate outcome effects only: reading a preview never advances the simulation. */
export default function ChoiceImpact({ choice, life, world }: { choice: Choice; life: LifeState; world: WorldPack }) {
  const impact = getChoiceImpact(choice, life, world);
  const changedStats = impact.stats.filter(stat => (stat.min !== 0 || stat.max !== 0) && !(world.economy && life.economy && stat.id === world.economy.stat));
  const moneyImpact = getMoneyImpact(choice, life, world);
  const hasRange = changedStats.some(stat => stat.variable) || moneyImpact.some(item => item.min !== item.max);
  if (changedStats.length === 0 && moneyImpact.length === 0 && !impact.canEndLife) return null;
  return <span className="choice-impact">
    <span className="sr-only">Direct stat effects.{hasRange ? " Ranges show possible outcomes." : ""} </span>
    <span className="choice-impact-list">
      {changedStats.map(stat => {
        return <span className="impact-stat" key={stat.id}>
          <span className="impact-stat-label">{stat.label}</span>{" "}<ImpactValue min={stat.min} max={stat.max} />
        </span>;
      })}
      {moneyImpact.map(item => <span className="impact-stat" key={`money-${item.id}`}><span className="impact-stat-label">{item.label}</span>{" "}<ImpactValue min={item.min} max={item.max} inverse={item.inverse} suffix={world.economy!.currency.short} /></span>)}
    </span>
    {impact.canEndLife && <span className="choice-impact-ending">{impact.deathRisk > 0 ? `Risk of death: ${impact.deathRisk < .0001 ? "less than 0.01" : Number((impact.deathRisk * 100).toFixed(2))}%.` : "A possible outcome ends this life."}</span>}
  </span>;
}
