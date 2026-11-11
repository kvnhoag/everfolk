export interface DeclineChoiceProps {
  cooldownMinutes: number;
  busy?: boolean;
  error?: string;
  onKeep(): void;
  onClose(): void;
  onBack(): void;
}

/** After "Not this time": the life stays open on chain until it is minted or closed. */
export default function DeclineChoice({ cooldownMinutes, busy = false, error, onKeep, onClose, onBack }: DeclineChoiceProps) {
  return <section className="chain-card" aria-labelledby="decline-title">
    <h1 id="decline-title" tabIndex={-1}>Not this time</h1>
    <p>This life stays yours. You can mint it later from <strong>Ranked life</strong> on the main menu, as long as you don't start another.</p>
    <p>Closing it lets you begin a new ranked life after {cooldownMinutes} minutes. A closed life can never be minted.</p>
    {error && <p className="chain-error" role="alert">{error}</p>}
    <div className="chain-actions">
      <button className="chain-primary" type="button" disabled={busy} onClick={onKeep}>Keep it for later<span aria-hidden="true">→</span></button>
      <button className="chain-secondary" type="button" disabled={busy} onClick={onClose}>Close this life</button>
      <button className="chain-secondary" type="button" disabled={busy} onClick={onBack}>Back to the mint</button>
    </div>
  </section>;
}
