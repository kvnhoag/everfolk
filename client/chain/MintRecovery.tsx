export interface MintRecoveryProps {
  busy?: boolean;
  error?: string;
  onRecover(): void;
  onBack(): void;
}

/** A committed mint keeps its original fee and outcome through retries and page reloads. */
export default function MintRecovery({ busy = false, error = "", onRecover, onBack }: MintRecoveryProps) {
  return <section className="chain-card">
    <h1 tabIndex={-1}>Finish keeping this life</h1>
    <p>Its mint fee is already committed. Complete the same mint without paying another mint fee.</p>
    {error && <p className="chain-error" role="alert">{error}</p>}
    <div className="chain-actions">
      <button className="chain-primary" type="button" disabled={busy} onClick={onRecover}>{busy ? "Completing…" : "Complete mint"}<span aria-hidden="true">→</span></button>
      <button className="chain-secondary" type="button" disabled={busy} onClick={onBack}>Back to Everfolk</button>
    </div>
  </section>;
}
