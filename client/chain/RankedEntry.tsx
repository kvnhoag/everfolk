import { useEffect, useId, useState } from "react";
import type { LifeView } from "../../chain/types.ts";
import BornInto from "./BornInto.tsx";
import { bornIntoLines, type OwnersByToken } from "./born-into-model.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import type { LivesContract } from "./types.ts";
import "./ranked-entry.css";

export interface RankedEntryProps {
  backend: ChainBackend;
  /** Hands the started life to the ranked session. Absent until the session is wired (Task 17). */
  onBegin?(life: LifeView): void | Promise<void>;
}

async function ownersOf(contract: LivesContract, life: LifeView): Promise<OwnersByToken> {
  const owners = await Promise.all(life.figure_picks.map(async pick => [pick.token_id, (await contract.token(pick.token_id))?.owner_id] as const));
  return Object.fromEntries(owners.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

/** Start (or return to) a ranked life, then show the world it is born into. */
export default function RankedEntry({ backend, onBegin }: RankedEntryProps) {
  const { contract, accountId } = backend;
  const headingId = useId();
  const [life, setLife] = useState<LifeView | null>(null);
  const [owners, setOwners] = useState<OwnersByToken>({});
  const [resumed, setResumed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    void contract.activeLifeOf(accountId).then(async active => {
      if (cancelled || !active) return;
      const found = await ownersOf(contract, active);
      if (!cancelled) { setLife(active); setOwners(found); setResumed(true); }
    }).catch(() => { /* Starting fresh still works; errors surface on the next action. */ });
    return () => { cancelled = true; };
  }, [contract, accountId]);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError("");
    try { await action(); } catch (cause) { setError(errorText(cause, fallback)); } finally { setBusy(false); }
  }

  const start = () => run(async () => {
    const started = await contract.startLife(backend.worldVersion);
    setOwners(await ownersOf(contract, started));
    setLife(started);
    setResumed(false);
  }, "Your ranked life could not start. Try again in a moment.");

  const giveUp = () => run(async () => {
    if (!life) return;
    await contract.abandonLife(life.life_id);
    setLife(null);
    setNotice("That life is closed. It can't be kept, and a new one opens after a short wait.");
  }, "That life could not be closed.");

  function begin() {
    if (!life) return;
    if (!onBegin) { setNotice("Ranked play isn't open in this build yet. Your place in this world is kept."); return; }
    void run(async () => { await onBegin(life); }, "This life could not begin. Try again in a moment.");
  }

  return <div className="ranked-entry">
    <section className="chain-card ranked-entry-intro" aria-labelledby={headingId}>
      <p className="chain-kicker">Live another story, for keeps</p>
      <h1 id={headingId} tabIndex={-1}>Ranked life</h1>
      <p>One life that counts. Famous figures owned by other players shape the city you are born into, and people from their lives may step in at your big decisions.</p>
      <ul className="ranked-entry-rules">
        <li>No rewinds. Each choice stands.</li>
        <li>Other players' characters can help you when it matters.</li>
        <li>When your life ends, you can keep it. Everyone who shaped it shares the fee.</li>
      </ul>
      {!life && <div className="chain-actions">
        {accountId
          ? <button className="chain-primary" type="button" disabled={busy} onClick={() => { void start(); }}>{busy ? "Starting…" : "Start a ranked life"}<span aria-hidden="true">→</span></button>
          : <button className="chain-primary" type="button" disabled={busy} onClick={() => { void run(backend.connect, "The wallet could not connect."); }}>Connect a NEAR wallet<span aria-hidden="true">→</span></button>}
      </div>}
      {accountId && <p className="chain-fine">Playing as {accountId}</p>}
      {error && <p className="chain-error" role="alert">{error}</p>}
      {notice && <p className="chain-notice" role="status">{notice}</p>}
    </section>
    {life && <BornInto lines={bornIntoLines(life.figure_picks, owners)} beginLabel={resumed ? "Continue this life" : "Begin this life"} busy={busy} onBegin={begin} onGiveUp={() => { void giveUp(); }} />}
  </div>;
}
