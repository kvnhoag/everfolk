import { useId } from "react";
import { rankedEntryView } from "./born-into-model.ts";
import { useRankedAvailability } from "./chain-backend.ts";
import { chainHref } from "./chain-route.ts";
import "./ranked-entry.css";

/** Main menu button for ranked play. Closed, with a short reason, unless `/api/ranked/config` answers. */
export default function RankedMenuEntry() {
  const noteId = useId();
  const availability = useRankedAvailability();
  const view = rankedEntryView(availability);
  return <div className="main-menu-ranked">
    <button type="button" disabled={view.disabled} aria-describedby={noteId} onClick={() => { window.location.hash = chainHref({ kind: "ranked" }); }}>Ranked life<span aria-hidden="true">→</span></button>
    <p id={noteId}>{view.note}{availability === "available" && <> <a href={chainHref({ kind: "market" })}>Browse the market</a></>}</p>
  </div>;
}
