import { useState } from "react";

export const STEWARD_NOTE = "Steward settings are not connected yet.";

/** Owner controls only. Callbacks are optional so this never calls a contract by itself. */
export default function StewardSettings({ owner, did = [], onDelegate, onRevoke }: {
  owner: boolean;
  did?: readonly string[];
  onDelegate?: () => void;
  onRevoke?: () => void;
}) {
  const [note, setNote] = useState("");
  if (!owner) return null;
  function act(run?: () => void) {
    if (run) run();
    else setNote(STEWARD_NOTE);
  }
  return <section className="chain-card" aria-label="Steward">
    <h2>Steward</h2>
    <p>Delegate this life, see what the steward did, or take it back. Nothing here signs or spends.</p>
    {did.length > 0 ? <ul>{did.map(line => <li key={line}>{line}</li>)}</ul> : <p className="chain-fine">No steward actions yet.</p>}
    <div className="chain-actions">
      <button type="button" onClick={() => act(onDelegate)}>Delegate</button>
      <button type="button" onClick={() => act(onRevoke)}>Revoke</button>
    </div>
    {note && <p className="chain-fine" role="status">{note}</p>}
  </section>;
}
