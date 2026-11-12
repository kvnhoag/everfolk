import PixelIcon from "../components/PixelIcon.tsx";
import type { StorehouseFlow, StorehouseRow } from "./storehouse-model.ts";
import "./storehouse.css";

const EMPTY_NOTE = "Nothing recorded yet.";

function signed(delta: number): string {
  return (delta > 0 ? "+" : "−") + Math.abs(delta);
}

function Coming({ flows }: { flows: StorehouseFlow[] }) {
  return <div>
    <h4>Coming year</h4>
    <ul>{flows.map(flow => <li key={flow.text}>{signed(flow.delta)} {flow.text}</li>)}</ul>
  </div>;
}

function Row({ row }: { row: StorehouseRow }) {
  const amount = row.capacity === null ? String(row.amount) : `${row.amount} / ${row.capacity}`;
  return <li className="storehouse-row">
    <div className="storehouse-head">
      <PixelIcon name={row.icon} label={row.label} />
      <span className="storehouse-label">{row.label}</span>
      <span className="storehouse-amount">{amount}</span>
    </div>
    {row.coming.length > 0 && <Coming flows={row.coming} />}
    <div>
      <h4>Last year</h4>
      {row.lastYear.length > 0 ? <ul>{row.lastYear.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>{EMPTY_NOTE}</p>}
    </div>
  </li>;
}

export default function ResourceYearDetails({ rows }: { rows: StorehouseRow[] }) {
  return <section aria-label="Yearly resource details" className="aoe-drawer-section storehouse">
    <h3>Yearly resource details</h3>
    <ul className="storehouse-list">{rows.map(row => <Row key={row.id} row={row} />)}</ul>
  </section>;
}
