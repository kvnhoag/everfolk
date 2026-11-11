import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TradeCommand, TradeItem } from "../../src/demo/types.ts";
import { TRADE_ITEMS } from "../../src/demo/types.ts";
import { beginOrder, releaseOrder } from "./screen.ts";
import type { DemoScreen } from "./screen.ts";
import { itemLabel, levelLabel } from "./labels.ts";
import PixelIcon from "../PixelIcon.tsx";
import Storehouse from "./Storehouse.tsx";
import type { StorehouseRow } from "./storehouse-model.ts";
import { resourceIcon } from "./resources.ts";
import "./economy-panels.css";

export interface ComparisonSide {
  label: string;
  grainReceived: number;
  hungerAvoided: boolean;
  sourceName: string | null;
  ownerShare: string | null;
}

interface Props {
  screen: DemoScreen;
  storehouse?: StorehouseRow[] | null;
  cashText: string;
  autoPlay: boolean;
  pending?: boolean;
  comparison?: { withDeed: ComparisonSide; withoutDeed: ComparisonSide } | null;
  scenario?: { title: string; seed: string; summary: string } | null;
  onTrade(order: TradeCommand): string | null;
  onPlan(flaxPlots: number): string | null;
  onAutoPlay(on: boolean): void;
  onDelegate(agent: string | null): string | null;
  onOccupation?(id: string): void;
  onActivity?(id: string): void;
  training?: { id: string; label: string; reason: string | null }[];
  occupations?: { id: string; label: string; unavailable: boolean; reason: string | null }[];
}

function Field({ label, value }: { label: ReactNode; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export default function EconomyPanels({ screen, storehouse = null, cashText, autoPlay, pending = false, comparison = null, scenario = null, onTrade, onPlan, onAutoPlay, onDelegate, onOccupation, onActivity, training = [], occupations = [] }: Props) {
  const titleId = useId();
  const slot = useRef(false);
  const [item, setItem] = useState<TradeItem>("grain");
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [quantity, setQuantity] = useState(1);
  const [counterparty, setCounterparty] = useState<"merchant" | "army">("merchant");
  const [notice, setNotice] = useState("");
  const [flaxPlots, setFlaxPlots] = useState(screen.household.flaxPlots);
  const [agentName, setAgentName] = useState("");
  const quote = screen.market.quotes.find(entry => entry.item === item);
  const order: TradeCommand = { type: "trade", item, side, quantity, counterparty };
  useEffect(() => { slot.current = false; }, [screen.market.visitUsed, pending]);

  function confirmTrade() {
    if (screen.market.visitUsed || pending) return;
    if (!beginOrder(slot)) return;
    const reason = onTrade(order);
    if (reason) { releaseOrder(slot); setNotice(reason); }
    else setNotice("");
  }

  return <div className="demo-economy" aria-labelledby={titleId}>
    <h2 id={titleId} className="demo-economy-title">This year in the fields</h2>
    {storehouse && <Storehouse rows={storehouse} />}

    <section aria-label="This year">
      <h3>This year</h3>
      <dl className="demo-facts">
        <Field label="Flood" value={levelLabel(screen.year.flood)} />
        <Field label="Army" value={levelLabel(screen.year.army)} />
        <Field label="Road" value={levelLabel(screen.year.road)} />
      </dl>
      {screen.year.lines.length > 0 ? <ul>{screen.year.lines.map(line => <li key={line}>{line}</li>)}</ul> : <p>The year has not added a further effect.</p>}
    </section>

    <section aria-label="Household grain">
      <h3>Household grain</h3>
      <dl className="demo-facts">
        <Field label="Store" value={String(screen.household.grain)} />
        <Field label="Capacity" value={String(screen.household.capacity)} />
        <Field label="Mouths" value={String(screen.household.mouths)} />
        <Field label="Expected harvest" value={String(screen.household.expectedHarvest)} />
        <Field label="Expected spoilage" value={String(screen.household.expectedSpoilage)} />
        <Field label="Rent" value={String(screen.household.expectedRent)} />
        <Field label="Cash" value={cashText} />
      </dl>
      {screen.household.grain === 0 && <p>The store is empty.</p>}
      {screen.household.shortfallBps > 0 && <p>The household was short last year.</p>}
    </section>

    <section aria-label="Grain market">
      <h3>Grain market</h3>
      <p>One visit this year. This is not the NFT Market.</p>
      {screen.market.visitUsed && <p>You have already visited the market this year.</p>}
      {screen.market.reasons.map(reason => <p key={reason}>{reason}</p>)}
      <dl className="demo-facts">
        {screen.market.quotes.filter(entry => entry.item === "grain" || entry.item === item).map(entry => <Field key={entry.item} label={<><PixelIcon name={resourceIcon(entry.item)} size={16} /> {itemLabel(entry.item)} buy / sell</>} value={entry.buy + " / " + entry.sell} />)}
        <Field label="Merchant can buy" value={String(quote?.merchantCanBuy ?? 0)} />
        <Field label="Merchant holds" value={String(quote?.merchantStock ?? 0)} />
        <Field label="Army grain price" value={String(screen.market.armyGrainPrice)} />
        <Field label="Army contract" value={screen.market.armyOpen ? "Open" : "Not offered"} />
      </dl>
      <div className="demo-actions">
        <label>Good <PixelIcon name={resourceIcon(item)} size={16} /><select value={item} onChange={event => setItem(event.target.value as TradeItem)}>{TRADE_ITEMS.map(id => <option key={id} value={id}>{itemLabel(id)}</option>)}</select></label>
        <label>Side<select value={side} onChange={event => setSide(event.target.value as "buy" | "sell")}><option value="sell">Sell</option><option value="buy">Buy</option></select></label>
        <label>With<select value={counterparty} onChange={event => setCounterparty(event.target.value as "merchant" | "army")}><option value="merchant">Merchant</option><option value="army">Army</option></select></label>
        <label>Quantity<input inputMode="numeric" min={1} type="number" value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
        <button type="button" disabled={screen.market.visitUsed || pending || slot.current} onClick={confirmTrade}>Preview and confirm</button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>

    <section aria-label="Service">
      <h3>Farm or serve</h3>
      <p>{screen.service.serving ? "You are serving. Your labour is off the plot." : "You are on the farm. Serving would take your labour off the plot."}</p>
      <dl className="demo-facts">
        <Field label="Wages" value={String(screen.service.wage)} />
        <Field label="Rations" value={String(screen.service.ration)} />
        <Field label="Army purse" value={String(screen.service.purse)} />
        <Field label="Reputation" value={String(screen.service.reputation)} />
      </dl>
      {screen.service.purse <= 0 && <p>The army purse is short.</p>}
      {screen.service.readiness.length > 0 ? <ul>{screen.service.readiness.map(line => <li key={line}>{line}</li>)}</ul> : <p>Convoy readiness has not been set.</p>}
      {screen.service.shipment && <p>A convoy is waiting: {screen.service.shipment.cargo} measures of grain, stage {screen.service.shipment.stage}.</p>}
      <h4>Practice for your career</h4>
      <div className="demo-actions">{training.map(activity => <button key={activity.id} type="button" disabled={Boolean(activity.reason) || pending} title={activity.reason ?? undefined} data-activity={activity.id} onClick={() => onActivity?.(activity.id)}>{activity.label}</button>)}</div>
      {training.some(activity => activity.reason) && <p>Training uses your activity for the year. Age and skill requirements apply.</p>}
      {occupations.length > 0 && <div className="demo-actions">{occupations.map(job => <button key={job.id} type="button" aria-disabled={job.unavailable || undefined} onClick={() => { if (!job.unavailable) onOccupation?.(job.id); }}>
        {job.label}{job.unavailable ? " · Unavailable" : ""}
      </button>)}
      {occupations.filter(job => job.unavailable).map(job => <p key={job.id + "-reason"}>{job.label}: {job.reason}</p>)}</div>}
    </section>

    <section aria-label="Wider life">
      <h3>Fields, animals and stores</h3>
      <dl className="demo-facts">
        <Field label="Grain plots" value={String(screen.household.plots - screen.household.flaxPlots)} />
        <Field label="Flax plots" value={String(screen.household.flaxPlots)} />
        <Field label="Flax stored" value={String(screen.household.flax)} />
        <Field label="Linen" value={String(screen.household.linen)} />
        <Field label="Oxen" value={String(screen.household.animals.ox)} />
        <Field label="Donkeys" value={String(screen.household.animals.donkey)} />
      </dl>
      <div className="demo-actions">
        <label>Flax plots next year<input inputMode="numeric" min={0} max={screen.household.plots} type="number" value={flaxPlots} onChange={event => setFlaxPlots(Math.max(0, Number(event.target.value) || 0))} /></label>
        <button type="button" onClick={() => setNotice(onPlan(flaxPlots) ?? "Planting plan sent.")}>Set planting</button>
      </div>
      <h3>Holdings</h3>
      <ul>{screen.market.quotes.filter(entry => entry.item !== "grain" && entry.item !== "flax").map(entry => <li key={entry.item}>{itemLabel(entry.item)}: buy {entry.buy}, sell {entry.sell}. The market has not said why this price moved.</li>)}</ul>
      <h3>Community works</h3>
      <ul>{screen.works.works.map(work => <li key={work.id}><strong>{work.title}</strong> · {work.built ? "Finished" : work.progress + " of " + work.needed} · costs {work.cash} drachmas and {work.grain} grain{work.built ? " · effect is in place" : ""}</li>)}</ul>
      <p>Reputation {screen.works.reputation}. Changes are listed in the life record when they happen.</p>
    </section>

    <section aria-label="Townspeople">
      <h3>Who decided</h3>
      <ul>{screen.agents.map(agent => <li key={agent.role}>{agent.text}</li>)}</ul>
      {screen.offerText && <p>{screen.offerText} It is shown here until it arrives as a decision.</p>}
      <div className="demo-actions">
        <button type="button" aria-pressed={autoPlay} onClick={() => onAutoPlay(!autoPlay)}>{autoPlay ? "Auto-play is on" : "Auto-play is off"}</button>
        {autoPlay && <button type="button" onClick={() => onAutoPlay(false)}>Take back</button>}
        <label>Agent account<input value={agentName} onChange={event => setAgentName(event.target.value)} placeholder="account.testnet" /></label>
        <button type="button" onClick={() => setNotice(onDelegate(agentName.trim() || null) ?? "Delegation sent.")}>Hand decisions over</button>
        <button type="button" onClick={() => { setAgentName(""); setNotice(onDelegate(null) ?? "You took the decisions back."); }}>Take the decisions back</button>
      </div>
    </section>

    <section aria-label="Future paths">
      <h3>Future paths</h3>
      {screen.futurePaths.length === 0 ? <p>No future paths are listed for this world.</p> : <ul>{screen.futurePaths.map(path => <li key={path.id}><strong>{path.title}</strong> <span className="demo-badge">Unavailable</span><p>{path.description}</p>{path.prerequisites && <p>{path.prerequisites}</p>}<p>Not available in this demo.</p></li>)}</ul>}
    </section>

    {(scenario || comparison) && <section aria-label="Demo scenario">
      <h3>Demo scenario</h3>
      {scenario ? <p><strong>{scenario.title}</strong> · seed {scenario.seed}. {scenario.summary}</p> : <p>The prepared demo scenario is not loaded yet.</p>}
      {comparison ? <div className="demo-compare">
        <article><h4>{comparison.withDeed.label}</h4><p>Grain received {comparison.withDeed.grainReceived}. Hunger avoided: {comparison.withDeed.hungerAvoided ? "yes" : "no"}.</p><p>Source: {comparison.withDeed.sourceName ?? "none"}. Owner share: {comparison.withDeed.ownerShare ?? "none"}.</p></article>
        <article><h4>{comparison.withoutDeed.label}</h4><p>Grain received {comparison.withoutDeed.grainReceived}. Hunger avoided: {comparison.withoutDeed.hungerAvoided ? "yes" : "no"}.</p><p>Source: {comparison.withoutDeed.sourceName ?? "none"}. Owner share: {comparison.withoutDeed.ownerShare ?? "none"}.</p></article>
      </div> : <p>After a flood, the same life with and without an earlier farmer&apos;s deed will be compared here.</p>}
    </section>}
  </div>;
}
