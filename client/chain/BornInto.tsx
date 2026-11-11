import { useId } from "react";
import "./ranked-entry.css";

export interface BornIntoProps {
  lines: readonly string[];
  beginLabel?: string;
  busy?: boolean;
  onBegin(): void;
  onGiveUp?(): void;
}

/** "The world you are born into": the famous figures at work in this ranked life. */
export default function BornInto({ lines, beginLabel = "Begin this life", busy = false, onBegin, onGiveUp }: BornIntoProps) {
  const headingId = useId();
  return <section className="chain-card born-into" aria-labelledby={headingId}>
    <p className="chain-kicker">Alexandria, 350 BCE</p>
    <h2 id={headingId}>The world you are born into</h2>
    <ul className="born-into-lines">{lines.map(line => <li key={line}>{line}</li>)}</ul>
    <div className="chain-actions">
      <button className="chain-primary" type="button" disabled={busy} onClick={onBegin}>{beginLabel}<span aria-hidden="true">→</span></button>
      {onGiveUp && <button className="chain-secondary" type="button" disabled={busy} onClick={onGiveUp}>Give up this life</button>}
    </div>
  </section>;
}
