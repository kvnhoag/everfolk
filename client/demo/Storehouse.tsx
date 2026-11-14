import PixelIcon from "../components/PixelIcon.tsx";
import { flowTotal, signedAmount, type FlowTone } from "./ledger-flows.ts";
import type { StorehouseRow } from "./storehouse-model.ts";
import "./storehouse.css";

interface Chip { key: string; label: string; icon: string; delta: number | null; tone: FlowTone; text: string }

function toneOf(delta: number): FlowTone {
  return delta > 0 ? "gain" : delta < 0 ? "loss" : "neutral";
}

/** One movement: an icon, a signed amount in green (in), red (out) or grey (no change), and a short label. */
function FlowChip({ chip }: { chip: Chip }) {
  const amount = chip.delta === null ? "" : signedAmount(chip.delta);
  return <li className={`flow-chip is-${chip.tone}`} title={chip.text}>
    <PixelIcon name={chip.icon} size={12} />
    {amount && <strong>{amount}</strong>}
    <span>{chip.label}</span>
  </li>;
}

function FlowLine({ caption, chips, total }: { caption: string; chips: Chip[]; total: number | null }) {
  return <div className="storehouse-flows">
    <span className="storehouse-caption">{caption}</span>
    <ul className="flow-chips" aria-label={caption}>{chips.map(chip => <FlowChip key={chip.key} chip={chip} />)}</ul>
    {total !== null && chips.length > 1 && <span className={`storehouse-net is-${toneOf(total)}`} title="Net change">= {signedAmount(total)}</span>}
  </div>;
}

function amountText(row: StorehouseRow): string {
  return row.capacity === null ? String(row.amount) : `${row.amount} / ${row.capacity}`;
}

function ActiveRow({ row }: { row: StorehouseRow }) {
  const coming: Chip[] = row.coming.map(flow => ({ key: flow.text, label: flow.text, icon: flow.icon, delta: flow.delta, tone: toneOf(flow.delta),
    text: `${flow.text}: ${signedAmount(flow.delta)} expected${flow.hint ? `. ${flow.hint}` : ""}` }));
  const last: Chip[] = row.lastYearFlows.map((flow, index) => ({ key: `${index}`, ...flow }));
  const full = row.capacity ? Math.min(100, Math.round(row.amount / row.capacity * 100)) : null;
  return <li className="storehouse-row">
    <div className="storehouse-head">
      <PixelIcon name={row.icon} label={row.label} size={16} />
      <span className="storehouse-label">{row.label}</span>
      <span className="storehouse-amount">{amountText(row)}</span>
      {full !== null && <span className={`storehouse-fill${full >= 100 ? " is-full" : ""}`} role="meter" aria-label={`${row.label} store ${full}% full`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={full}><span style={{ width: `${full}%` }} /></span>}
    </div>
    {row.alert && <p className={`storehouse-alert is-${row.alert.tone}`} role={row.alert.tone === "danger" ? "alert" : "status"}>
      <PixelIcon name="warn" size={12} label={row.alert.tone === "danger" ? "Over the limit" : "Will overflow"} />{row.alert.text}
    </p>}
    {coming.length > 0 && <FlowLine caption="Next harvest" chips={coming} total={flowTotal(coming)} />}
    {last.length > 0 && <FlowLine caption="Last year" chips={last} total={flowTotal(last)} />}
  </li>;
}

/**
 * The store ledger: every resource that moved shows what came in (green) and went out (red) as icon chips;
 * resources that did not move sit together as grey tiles, so nothing reads as a wall of text.
 */
export default function ResourceYearDetails({ rows }: { rows: StorehouseRow[] }) {
  const active = rows.filter(row => row.coming.length > 0 || row.lastYearFlows.length > 0);
  const quiet = rows.filter(row => !active.includes(row));
  return <section aria-label="Yearly resource details" className="aoe-drawer-section storehouse">
    <header className="storehouse-header">
      <h3>Store ledger</h3>
      <p className="storehouse-legend" aria-label="Colour key"><span className="is-gain">In</span><span className="is-loss">Out</span><span className="is-neutral">No change</span></p>
    </header>
    {active.length > 0 && <ul className="storehouse-list">{active.map(row => <ActiveRow key={row.id} row={row} />)}</ul>}
    {quiet.length > 0 && <div className="storehouse-quiet">
      <span className="storehouse-caption">No change last year</span>
      <ul>{quiet.map(row => <li key={row.id} title={`${row.label}: ${amountText(row)}, nothing came in or went out last year`}>
        <PixelIcon name={row.icon} label={row.label} size={12} /><span>{row.label}</span><strong>{amountText(row)}</strong>
      </li>)}</ul>
    </div>}
  </section>;
}
