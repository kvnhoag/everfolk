import { useEffect, useMemo, useState } from "react";
import type { PlantingCheck } from "../models/planting-check.ts";
import { TRADE_ITEMS, type TradeItem } from "../../src/demo/types.ts";
import PixelIcon from "../components/PixelIcon.tsx";
import SectionHelp from "../components/SectionHelp.tsx";
import { itemLabel } from "./labels.ts";
import type { DemoScreen } from "./screen.ts";
import ResourceYearDetails from "./Storehouse.tsx";
import type { StorehouseRow } from "./storehouse-model.ts";

/** This year's personal action, as the drawer's Work card shows it. */
export interface WorkStatus {
  /** The action can still be spent this year. */
  open: boolean;
  /** One line: what is left to do, or why nothing is. */
  note: string;
}

export interface InventoryDrawerProps {
  screen: DemoScreen;
  rows: StorehouseRow[] | null;
  selectedItem: TradeItem | null;
  holding(item: TradeItem): number;
  work?: WorkStatus | null;
  onClose(): void;
  onPlan?(flaxPlots: number): string | null;
  /** What a plan would do, checked before Set planting. */
  checkPlan?(flaxPlots: number): PlantingCheck;
  onTrade?(item: TradeItem): void;
  onWork?(): void;
}

/** The split of the household's plots, one square per plot, grain first. */
function PlotSquares({ plots, flax }: { plots: number; flax: number }) {
  return <span className="aoe-plot-squares" aria-hidden="true">
    {Array.from({ length: plots }, (_, index) => <span key={index} className={index < plots - flax ? "is-grain" : "is-flax"} />)}
  </span>;
}

function PlantingTask({ screen, onPlan, checkPlan }: { screen: DemoScreen; onPlan(flaxPlots: number): string | null; checkPlan?(flaxPlots: number): PlantingCheck }) {
  const { plots } = screen.household;
  const [flax, setFlax] = useState(screen.household.flaxPlots);
  const [notice, setNotice] = useState("");
  useEffect(() => { setFlax(screen.household.flaxPlots); }, [screen.household.flaxPlots]);
  const change = (next: number) => { setFlax(Math.max(0, Math.min(plots, next))); setNotice(""); };
  const unchanged = flax === screen.household.flaxPlots;
  // Checked as the split changes, so a plan the game would refuse never needs a click to find out.
  const check = useMemo(() => checkPlan?.(flax) ?? { reason: null, warnings: [] }, [checkPlan, flax, screen]);
  return <article className="aoe-task aoe-planting-row has-section-help" aria-labelledby="aoe-task-planting">
    <SectionHelp hint="planting" />
    <h4 id="aoe-task-planting"><PixelIcon name="res-grain" size={14} />Plan your fields</h4>
    <p className="aoe-task-how">Grain plots feed {screen.household.mouths} {screen.household.mouths === 1 ? "mouth" : "mouths"} and pay the rent. Flax plots grow flax to spin into linen and sell. The split counts for the next harvest.</p>
    <div className="aoe-plot-plan">
      <PlotSquares plots={plots} flax={flax} />
      <span className="aoe-plot-count"><strong>{plots - flax}</strong> grain · <strong>{flax}</strong> flax</span>
      <span className="aoe-stepper" role="group" aria-label="Flax plots next year">
        <button type="button" aria-label="One less flax plot" disabled={flax <= 0} onClick={() => change(flax - 1)}>−</button>
        <output aria-live="polite">{flax} flax</output>
        <button type="button" aria-label="One more flax plot" disabled={flax >= plots} onClick={() => change(flax + 1)}>+</button>
      </span>
    </div>
    {(check.reason || check.warnings.length > 0) && <ul className="aoe-plan-check" aria-label="Before you set this plan">
      {check.reason && <li className="is-blocked"><PixelIcon name="lock" size={12} label="Cannot set" />{check.reason}</li>}
      {check.warnings.map(line => <li key={line}><PixelIcon name="warn" size={12} label="Warning" />{line}</li>)}
    </ul>}
    <div className="aoe-task-actions">
      <button type="button" className="aoe-task-primary" disabled={unchanged || Boolean(check.reason)} onClick={() => setNotice(onPlan(flax) ?? "Planting set for the next harvest.")}>Set planting</button>
      {notice && <span className="aoe-plan-notice" role="status">{notice}</span>}
      {!notice && unchanged && <span className="aoe-task-hint">Use − and + to change the split.</span>}
    </div>
  </article>;
}

function TradeTask({ screen, onTrade }: { screen: DemoScreen; onTrade?(item: TradeItem): void }) {
  const closed = screen.market.reasons[0];
  return <article className="aoe-task" aria-labelledby="aoe-task-trade">
    <h4 id="aoe-task-trade"><PixelIcon name="commerce" size={14} />Trade</h4>
    <p className="aoe-task-how">One market visit a year: buy or sell grain and goods. Keep enough grain for the household.</p>
    <div className="aoe-task-actions">
      <button type="button" className="aoe-task-primary" disabled={Boolean(closed) || !onTrade} onClick={() => onTrade?.("grain")}>Go to the market →</button>
      <span className={closed ? "aoe-task-hint is-closed" : "aoe-task-hint"}>{closed ?? "1 visit available this year."}</span>
    </div>
  </article>;
}

function WorkTask({ work, onWork }: { work: WorkStatus; onWork?(): void }) {
  return <article className="aoe-task" aria-labelledby="aoe-task-work">
    <h4 id="aoe-task-work"><PixelIcon name="res-labour" size={14} />Work &amp; practice</h4>
    <p className="aoe-task-how">Your yearly action and this year’s focus decide what you practise; that is how skills grow.</p>
    <div className="aoe-task-actions">
      <button type="button" className="aoe-task-primary" disabled={!onWork} onClick={onWork}>{work.open ? "Choose this year’s action →" : "See your focus →"}</button>
      <span className={work.open ? "aoe-task-hint" : "aoe-task-hint is-closed"}>{work.note}</span>
    </div>
  </article>;
}

function Holdings({ screen, holding, selectedItem, onTrade }: Pick<InventoryDrawerProps, "screen" | "holding" | "selectedItem" | "onTrade">) {
  const closed = screen.market.reasons[0];
  return <div className="aoe-drawer-section">
    <header className="aoe-drawer-header"><div><span className="aoe-drawer-eyebrow">GOODS &amp; PRICES</span><h3>What you hold</h3></div></header>
    <div className="aoe-holdings-grid">
      {TRADE_ITEMS.map(item => {
        const held = holding(item);
        const quote = screen.market.quotes.find(entry => entry.item === item);
        return <div key={item} className={`aoe-holding-card${selectedItem === item ? " is-selected" : ""}${held > 0 ? " has-stock" : ""}`}>
          <div className="aoe-holding-top">
            <PixelIcon name={`res-${item}`} size={14} />
            <span className="aoe-holding-name">{itemLabel(item)}</span>
            <strong className="aoe-holding-qty">{held}</strong>
          </div>
          {quote && <div className="aoe-holding-meta">
            <span>Sell {quote.buy} · Buy {quote.sell} dr</span>
            {onTrade && <button type="button" className="aoe-holding-trade" disabled={Boolean(closed)} title={closed ?? `Open the market with ${itemLabel(item).toLowerCase()} selected`} onClick={() => onTrade(item)}>Trade →</button>}
          </div>}
        </div>;
      })}
    </div>
    {closed && <p className="aoe-holdings-note">{closed}</p>}
  </div>;
}

/** Inventory & Granary: this year's tasks first, then the store ledger, then goods with their prices. */
export default function InventoryDrawer({ screen, rows, selectedItem, holding, work = null, onClose, onPlan, checkPlan, onTrade, onWork }: InventoryDrawerProps) {
  return <div className="aoe-inventory-drawer" role="region" aria-label="Inventory and granary details">
    <header className="aoe-drawer-header aoe-drawer-top">
      <div><span className="aoe-drawer-eyebrow">THIS YEAR</span><h3>What you can do</h3></div>
      <button type="button" className="aoe-drawer-close" onClick={onClose}>Close ×</button>
    </header>
    <div className="aoe-year-tasks">
      {onPlan && <PlantingTask screen={screen} onPlan={onPlan} checkPlan={checkPlan} />}
      <TradeTask screen={screen} onTrade={onTrade} />
      {work && <WorkTask work={work} onWork={onWork} />}
    </div>
    {screen.legacyHelp?.map(help => <aside className="aoe-legacy-banner" key={`${help.tokenId}:${help.age}`}>
      <strong>A past life kept a granary for you</strong>
      <p>{help.text}</p>
      <a href={`#token/${help.tokenId}`}>Meet the farmer · Life NFT #{help.tokenId}</a>
    </aside>)}
    {rows && <ResourceYearDetails rows={rows} />}
    <Holdings screen={screen} holding={holding} selectedItem={selectedItem} onTrade={onTrade} />
  </div>;
}
