import { useId, useState } from "react";
import "./ranked-entry.css";

/** Selects which mode the player enters from the main menu. */
export default function RankedMenuEntry({ checked, onChange }: { checked: boolean; onChange(checked: boolean): void }) {
  const helpId = useId();
  const [dismissed, setDismissed] = useState(false);
  return <div className="main-menu-ranked">
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="weave-switch-track" aria-hidden="true" />
      Weave Mode <span className="weave-switch-state" aria-hidden="true">{checked ? "On" : "Off"}</span>
    </button>
    <div className="weave-mode-help" data-dismissed={dismissed} onPointerEnter={() => setDismissed(false)}>
      <button type="button" aria-label="About Weave Mode" aria-describedby={helpId}
        onFocus={() => setDismissed(false)} onClick={() => setDismissed(false)}
        onKeyDown={event => { if (event.key === "Escape") setDismissed(true); }}>i</button>
      <div id={helpId} role="tooltip" className="weave-mode-tooltip">
        Weave Mode uses a NEAR wallet or email to sign in and play a life recorded on NEAR. No account? Play as guest below.
      </div>
    </div>
  </div>;
}
