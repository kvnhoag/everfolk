import EmailSignIn from "../demo/EmailSignIn.tsx";
import { useEffect, useId, useState } from "react";
import type { LifeView } from "../../chain/types.ts";
import ActiveLifeCard, { useActiveRankedLife } from "./ActiveLifeCard.tsx";
import { DEFAULT_MINT_FEE_YOCTO, REROLL_FEE_YOCTO, formatNear } from "./near-amount.ts";
import BornInto from "./BornInto.tsx";
import { bornIntoLines, type OwnersByToken } from "./born-into-model.ts";
import { errorText, type ChainBackend } from "./chain-backend.ts";
import type { LivesContract } from "./types.ts";
import MintRecovery from "./MintRecovery.tsx";
import { rankedSaveKey } from "./ranked-session.ts";
import "./ranked-entry.css";
import SignInPanel from "./SignInPanel.tsx";
import { accountLabel } from "./account-bar-model.ts";

export interface RankedEntryProps {
  backend: ChainBackend;
  onClosed?(): void;
  /** Hands the started life to the ranked session. Absent until the session is wired (Task 17). */
  onBegin?(life: LifeView): void | Promise<void>;
}

async function ownersOf(contract: LivesContract, life: LifeView): Promise<OwnersByToken> {
  const owners = await Promise.all(life.figure_picks.map(async pick => [pick.token_id, (await contract.token(pick.token_id))?.owner_id] as const));
  return Object.fromEntries(owners.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

/** Start (or return to) a ranked life, then show the world it is born into. */
export default function RankedEntry({ backend, onBegin, onClosed }: RankedEntryProps) {
  const { contract, accountId } = backend;
  const headingId = useId();
  const current = useActiveRankedLife(backend);
  const [terms, setTerms] = useState({ mint_fee: DEFAULT_MINT_FEE_YOCTO, reroll_fee: REROLL_FEE_YOCTO });
  const [life, setLife] = useState<LifeView | null>(null);
  const [owners, setOwners] = useState<OwnersByToken>({});
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [choseWallet, setChoseWallet] = useState(false);
  const { signin } = backend;
  /** Gas, wallet approvals and wallet help are shown only to players on the NEAR wallet path. */
  const walletPath = !signin || signin.method === "wallet" || choseWallet;

  useEffect(() => {
    setLife(current.active?.life ?? null);
    if (current.active) void ownersOf(contract, current.active.life).then(setOwners).catch(() => {});
  }, [current.active, contract]);
  useEffect(() => {
    let cancelled = false;
    void contract.mintTerms().then(value => { if (!cancelled) setTerms(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [contract]);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError("");
    try { await action(); } catch (cause) { setError(errorText(cause, fallback)); } finally { setBusy(false); }
  }

  const start = () => run(async () => {
    const started = await contract.startLife(backend.worldVersion);
    setOwners(await ownersOf(contract, started));
    setLife(started);
  }, "Your ranked life could not start. Try again in a moment.");

  const giveUp = () => run(async () => {
    if (!life) return;
    await contract.abandonLife(life.life_id);
    setLife(null);
    setClosing(false);
    onClosed?.();
    setNotice("That life is closed. It can't be kept, and a new one opens after a short wait.");
  }, "That life could not be closed.");

  const recover = () => run(async () => {
    if (!life) return;
    const completed = await contract.mintResult(life.life_id) ?? await contract.retryMint(life.life_id);
    try { window.localStorage.removeItem(rankedSaveKey(life.life_id)); } catch { /* The confirmed mint remains accessible on its token page. */ }
    window.location.hash = `token/${completed.token_id}`;
  }, "The mint could not finish. Please try again.");

  function begin() {
    if (!life) return;
    if (!onBegin) { setNotice("Ranked play isn't open in this build yet. Your place in this world is kept."); return; }
    void run(async () => { await onBegin(life); }, "This life could not begin. Try again in a moment.");
  }

  return <div className="ranked-entry">
    {life && life.status !== "minting" && current.active && current.active.progress.status !== "new" && <ActiveLifeCard life={life} progress={current.active.progress} busy={busy} onOpen={begin} onGiveUp={() => setClosing(true)} />}
    {closing && <section className="chain-card"><h2>Close this life permanently?</h2><p>You will lose the chance to mint this life. If you already paid for a pack or rerolls, those fees are shared with its source lives and the protocol treasury; they are not refunded.</p><div className="chain-actions"><button type="button" className="chain-secondary" disabled={busy} onClick={() => setClosing(false)}>Keep this life</button><button type="button" className="chain-primary" disabled={busy} onClick={() => { void giveUp(); }}>Close permanently</button></div></section>}

    <section className="chain-card ranked-entry-intro" aria-labelledby={headingId}>
      <p className="chain-kicker">Live another story, for keeps</p>
      <h1 id={headingId} tabIndex={-1}>Ranked life</h1>
      <p>One life that counts. Famous figures owned by other players shape the city you are born into, and people from their lives may step in at your big decisions.</p>
      <ul className="ranked-entry-rules">
        <li>No rewinds. Each choice stands.</li>
        <li>Other players' characters can help you when it matters.</li>
        <li>When your life ends, you can keep it. Everyone who shaped it shares the fee.</li>
      </ul>
      <ol className="ranked-steps"><li><strong>{signin ? "Sign in" : "Connect"}</strong><span>{signin ? "With your email, or a NEAR testnet wallet you already use." : "Use your existing NEAR testnet wallet. Meteor is supported."}</span></li><li><strong>Live</strong><span>{walletPath ? "No entry fee. NEAR gas applies to recorded decisions and checkpoints. No rewinds." : "No entry fee. No rewinds."}</span></li><li><strong>Open & choose</strong><span>When the life ends, open a 3-card pack for {formatNear(terms.mint_fee)} NEAR. Choose one card to mint. Each slot has one optional {formatNear(terms.reroll_fee)} NEAR reroll.</span></li></ol>
      <p className="chain-fine">Base and reroll fees share the same source-life and protocol treasury split. {walletPath ? "Wallet approvals show the cost before payment; gas is separate." : "You confirm each price before you pay."} Testnet tokens have no real monetary value.</p>
      {!life && !current.loading && !current.error && <div className="chain-actions">
        {accountId
          ? <button className="chain-primary" type="button" disabled={busy} onClick={() => { void start(); }}>{busy ? "Starting…" : "Start a ranked life"}<span aria-hidden="true">→</span></button>
          : signin ? <button className="chain-primary" type="button" disabled={busy || signingIn} onClick={() => setSigningIn(true)}>Sign in to play<span aria-hidden="true">→</span></button>
          : <><button className="chain-primary" type="button" disabled={busy} onClick={() => { void run(backend.connect, "The wallet could not connect."); }}>Connect a NEAR wallet<span aria-hidden="true">→</span></button><EmailSignIn /></>}
      </div>}
      {!accountId && signin && signingIn && <SignInPanel available={signin.available} onEmail={signin.emailFlow} onWallet={async () => { setChoseWallet(true); await signin.useWallet(); }} onClose={() => setSigningIn(false)} />}
      <div className="chain-actions"><a className="chain-secondary" href="#figures">Meet the figures</a><a className="chain-secondary" href="#mine">My lives</a></div>
      {accountId && <p className="chain-fine">Playing as {accountLabel(accountId, signin?.method ?? null, signin?.email ?? null)}</p>}
      {!accountId && backend.mode === "live" && walletPath && <details className="wallet-help">
        <summary>Using Meteor Wallet?</summary>
        <p>Ranked lives run on NEAR <strong>testnet</strong>. Meteor only lists testnet accounts it already holds in this browser. If it asks you to create a wallet, open Meteor, switch its network to <strong>Testnet</strong> and import your testnet account (recovery phrase or private key), or install the Meteor extension in this browser. Then connect again.</p>
        <p>MyNearWallet works too: sign in at testnet.mynearwallet.com first.</p>
      </details>}
      {current.loading && <p role="status">Finding your ranked life…</p>}
      {current.error && <p className="chain-error" role="alert">{current.error}</p>}
      {error && <p className="chain-error" role="alert">{error}</p>}
      {notice && <p className="chain-notice" role="status">{notice}</p>}
    </section>
    {life?.status === "minting" ? <MintRecovery busy={busy} error={error} onRecover={() => { void recover(); }} onBack={() => { window.location.hash = ""; }} /> : life && (!current.active || current.active.progress.status === "new") && <BornInto lines={bornIntoLines(life.figure_picks, owners)} beginLabel="Begin this life" busy={busy} onBegin={begin} onGiveUp={() => setClosing(true)} />}
  </div>;
}
