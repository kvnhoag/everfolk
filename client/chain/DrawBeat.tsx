import type { Draw } from "../../chain/types.ts";
import { drawBeatView } from "./born-into-model.ts";
import { chainHref } from "./chain-route.ts";
import "./ranked-entry.css";

export interface DrawBeatProps {
  draw: Draw | null;
  pending: boolean;
  owner?: string;
  onContinue(): void;
}

/** The short beat at a key decision: who in the city stepped in, or nobody. */
export default function DrawBeat({ draw, pending, owner, onContinue }: DrawBeatProps) {
  const view = drawBeatView(draw, pending, owner);
  return <section className={`chain-card draw-beat is-${view.status}`} role="status" aria-live="polite">
    <p className="draw-beat-title">{view.title}</p>
    {view.status === "drawn" && view.tokenId
      ? <div className="draw-beat-who">
          <strong><a href={chainHref({ kind: "token", tokenId: view.tokenId })}>{view.who}</a></strong>
          <span className="chain-tag">{view.rarityLabel}</span>
          <p><em>{view.actionName}.</em> {view.detail}</p>
        </div>
      : <p className="draw-beat-detail">{view.detail}</p>}
    <button className="chain-primary" type="button" disabled={view.status === "waiting"} onClick={onContinue}>{view.status === "waiting" ? "Waiting…" : "Make your choice"}<span aria-hidden="true">→</span></button>
  </section>;
}
