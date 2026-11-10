import { useId } from "react";
import type { ActionOption } from "./chain-copy.ts";
import { chainHref } from "./chain-route.ts";
import type { LifeReport as LifeReportModel } from "./life-report-model.ts";
import "./life-report.css";

export interface LifeReportProps {
  report: LifeReportModel;
  spanLine?: string;
  feeText: string;
  menu: readonly ActionOption[];
  selectedAction: string;
  busy?: boolean;
  error?: string;
  onSelectAction(actionId: string): void;
  onMint(): void;
  onDecline(): void;
}

/** "Who shaped your life", then "Mint this life?" with the fee and the action picker. */
export default function LifeReport({ report, spanLine, feeText, menu, selectedAction, busy = false, error, onSelectAction, onMint, onDecline }: LifeReportProps) {
  const headingId = useId();
  const mintId = useId();
  const shaped = report.rows.length > 0;
  return <div className="life-report">
    <section className="chain-card" aria-labelledby={headingId}>
      <p className="chain-kicker">Your life has ended{spanLine ? ` · ${spanLine}` : ""}</p>
      <h1 id={headingId} tabIndex={-1}>Who shaped your life</h1>
      <p>{shaped ? "These people's deeds reached your life. The share is how much each one shaped it." : "No one else shaped this life. It was all yours."}</p>
      {shaped && <ol className="life-report-rows">{report.rows.map(row => <li key={row.tokenId}>
        <div className="life-report-who">
          <a href={chainHref({ kind: "token", tokenId: row.tokenId })}>{row.who}</a>
          <span className={`chain-tag${row.kind === "figure" ? " is-figure" : ""}`}>{row.kindLabel}</span>
          {row.rarityLabel && <span className="chain-tag">{row.rarityLabel}</span>}
        </div>
        <p><strong>{row.actionName}.</strong> {row.actionLabel}</p>
        <div className="life-report-share" aria-label={`${row.percentText} of this life`}>
          <span className="life-report-bar" aria-hidden="true"><span style={{ width: `${row.percent}%` }} /></span>
          <strong>{row.percentText}</strong>
        </div>
      </li>)}</ol>}
      {report.unassignedPercent && <p className="chain-fine">Many small influences: {report.unassignedPercent} goes to the city.</p>}
    </section>
    <section className="chain-card life-report-mint" aria-labelledby={mintId}>
      <h2 id={mintId}>Mint this life?</h2>
      <p>Keep this life for {feeText} NEAR. {shaped ? "Half of it goes to the people above, by their share." : "No one shaped it, so the fee goes to the city."}</p>
      <fieldset className="life-report-actions" disabled={busy}>
        <legend>What will you do for the lives that meet you?</legend>
        {menu.map(option => <label key={option.id} className={option.id === selectedAction ? "is-selected" : ""}>
          <input type="radio" name="npc-action" value={option.id} checked={option.id === selectedAction} onChange={() => onSelectAction(option.id)} />
          <span><strong>{option.name}</strong><small>{option.description}</small></span>
        </label>)}
        <p className="chain-fine">If your life becomes a famous figure, you'll pick from that figure's deeds on its page.</p>
      </fieldset>
      {error && <p className="chain-error" role="alert">{error}</p>}
      <div className="chain-actions">
        <button className="chain-primary" type="button" disabled={busy || !selectedAction} onClick={onMint}>{busy ? "Minting…" : `Mint for ${feeText} NEAR`}<span aria-hidden="true">→</span></button>
        <button className="chain-secondary" type="button" disabled={busy} onClick={onDecline}>Not this time</button>
      </div>
    </section>
  </div>;
}
