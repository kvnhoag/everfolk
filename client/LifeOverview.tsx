import { useId } from "react";
import { formatYear } from "../src/calendar.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { formatMoney } from "./wealth.ts";
import { formatWealthStanding, getWealthComparison } from "./wealth-comparison.ts";

/** The dashboard uses the world's actual attributes and currency. */
export default function LifeOverview({ life, world, onOpenWealth }: {
  life: LifeState; world: WorldPack; onOpenWealth(): void;
}) {
  const wealthId = useId();
  const wealth = getWealthComparison(world, life);
  return <section className="life-overview" aria-label="Life at a glance">
    <dl className={`life-overview-facts${wealth ? " has-wealth" : ""}`}>
      <div><dt>Age</dt><dd>{life.age}</dd></div>
      <div><dt>Year</dt><dd>{formatYear(life.year)}</dd></div>
      {!wealth && <div><dt>Life stage</dt><dd>{life.age < 18 ? "Growing up" : "Adult"}</dd></div>}
    </dl>
    {life.economy && wealth && <button type="button" className="overview-wealth" onClick={onOpenWealth} aria-label="Open total wealth and society comparison" aria-describedby={`${wealthId}-amount ${wealthId}-percentile ${wealthId}-cash`}>
      <span className="overview-wealth-metric"><span className="overview-wealth-label">Total wealth</span><strong id={`${wealthId}-amount`}>{formatMoney(wealth.netWorth, world)}</strong></span>
      <span className="overview-wealth-metric"><span className="overview-wealth-label">Society percentile</span><strong id={`${wealthId}-percentile`}>{formatWealthStanding(wealth.percentile)}</strong></span>
      <small className="overview-cash-note" id={`${wealthId}-cash`}>Cash available: {formatMoney(life.economy.cash, world)}</small>
      <span className="overview-wealth-details">Details <span aria-hidden="true">↗</span></span>
    </button>}
    <div className="life-overview-stats" aria-label="Life attributes">
      {Object.entries(world.stats).filter(([id]) => !life.economy || id !== world.economy?.stat).map(([id, definition]) => {
        const value = life.stats[id];
        const percent = definition.max > definition.min ? Math.max(0, Math.min(100, (value - definition.min) / (definition.max - definition.min) * 100)) : 0;
        return <div className={`overview-stat stat-${id}`} key={id}>
          <span className="overview-stat-label">{definition.label}</span>
          <div className="segmented-stat-track" role="meter" aria-label={definition.label} aria-valuemin={definition.min} aria-valuemax={definition.max} aria-valuenow={value}><span style={{ width: `${percent}%` }} /></div>
          <strong>{Number(value.toFixed(1))}</strong>
        </div>;
      })}
    </div>
  </section>;
}
