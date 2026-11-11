import { useState } from "react";
import type { JournalEntry } from "../../src/types.ts";
import { errorText } from "./chain-backend.ts";
import { verifiedLifeChoices } from "./life-choices.ts";
import { practiceEvidence } from "./practice-verifier.ts";

export default function LifeChoices({ evidenceHref, practice = false }: { evidenceHref: string; practice?: boolean }) {
  const [rows, setRows] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function read() {
    if (rows || loading) return;
    setLoading(true); setError("");
    try {
      const hash = evidenceHref.split("/").at(-1) ?? "";
      const fetcher: typeof fetch = practice ? async () => {
        const record = practiceEvidence(hash);
        return new Response(JSON.stringify(record), { status: record ? 200 : 404 });
      } : fetch;
      setRows(await verifiedLifeChoices(hash, fetcher));
    }
    catch (cause) { setError(errorText(cause, "The life choices could not be loaded.")); }
    finally { setLoading(false); }
  }
  return <section className="chain-card"><h2>Choices in this life</h2>{practice && <p className="chain-fine">Practice record, checked locally. It lasts while this page stays open.</p>}<details onToggle={event => { if (event.currentTarget.open) void read(); }}><summary>{practice ? "Read the practice life record" : "Read the verified life record"}</summary>
    {loading && <p role="status">Checking the life record against its on-chain hash…</p>}
    {error && <><p className="chain-error" role="alert">{error}</p><button className="chain-secondary" onClick={() => { void read(); }} type="button">Try again</button></>}
    {rows && <ol className="life-choice-history">{rows.map((row, index) => <li key={index}><strong>Age {row.age}</strong><p>{row.text}</p></li>)}</ol>}
  </details></section>;
}
